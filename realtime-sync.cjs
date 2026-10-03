/**
 * realtime-sync.cjs
 * ------------------------------------------------------------------
 * طبقة مزامنة لحظية شاملة:
 *   1) تراقب كل الموديلات عبر MongoDB Change Streams، يعني أي تعديل من أي route
 *      أو سكربت أو Compass يوصل لكل المستخدمين فوراً، بدون ما تحط io.emit بكل route.
 *   2) تشغّل قواعد ربط (Cascade Rules) بين الأقسام (موظف جديد => راتب + إشعار ...).
 *
 * متطلبات:
 *   - MongoDB Atlas أو أي Replica Set (Change Streams لا تعمل على mongod منفرد).
 *   - socket.io على نفس السيرفر.
 *
 * الاستخدام في server.js (بعد تعريف الموديلات وإنشاء io):
 *   const setupRealtime = require('./realtime-sync.cjs');
 *   setupRealtime({ io, models: { Product, Order, ... }, jwtSecret: process.env.JWT_SECRET });
 */

// اسم الموديل عندك  =>  اسم الحالة في AppContext
const KEY_MAP = {
  Product: 'products',
  Order: 'orders',
  Support: 'requests',
  Mail: 'mails',
  Notification: 'notifications',
  Customer: 'customers',
  Transaction: 'accountingTransactions',
  Ticket: 'tickets',
  Sale: 'salesLog',
  Employee: 'employees',
  Achievement: 'achievements',
  Announcement: 'announcements',
  WorkHour: 'workHours',
  AttendanceLog: 'attendanceLogs',
  Settings: 'settings',
  Salary: 'salaries',
  Task: 'tasks',
  DocumentModel: 'documents',
  Coupon: 'coupons',
};

// هذه فقط يشوفها الزبائن (واجهة المتجر). الباقي للموظفين فقط.
const PUBLIC_KEYS = new Set(['products', 'announcements']);
const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'sales', 'support', 'employee', 'staff']);

module.exports = function setupRealtime({ io, models, jwtSecret, verifyToken, rules = [] }) {
  if (!io) throw new Error('setupRealtime: io مطلوب');

  // ───────────── 1) مصادقة Socket وتوزيعه على غرف ─────────────
  let jwt = null;
  try { jwt = require('jsonwebtoken'); } catch (_) { /* اختياري */ }

  const resolveUser = (token) => {
    if (!token) return null;
    const clean = String(token).replace(/^Bearer\s+/i, '').trim();
    try {
      if (typeof verifyToken === 'function') return verifyToken(clean);
      if (jwt && jwtSecret) return jwt.verify(clean, jwtSecret);
    } catch (_) { /* توكن غير صالح */ }
    return null;
  };

  io.on('connection', (socket) => {
    const user = resolveUser(socket.handshake?.auth?.token);
    socket.join('public');
    if (user && STAFF_ROLES.has(String(user.role || 'employee').toLowerCase())) {
      socket.join('staff');
    }
    socket.data.user = user;
  });

  // ───────────── 2) البث ─────────────
  const emitChange = (key, op, id, doc) => {
    const payload = { key, op, id: String(id), doc: doc || null, at: Date.now() };
    io.to('staff').emit('ENTITY_CHANGE', payload);
    if (PUBLIC_KEYS.has(key)) io.to('public').emit('ENTITY_CHANGE', payload);
  };

  // ───────────── 3) قواعد الربط بين الأقسام ─────────────
  const monthStr = () => new Date().toISOString().slice(0, 7);
  const safe = async (label, fn) => {
    try { await fn(); } catch (e) { console.warn(`[cascade] ${label} فشلت:`, e.message); }
  };

  const defaultRules = [
    // موظف جديد => سجل راتب + إشعار
    {
      on: 'employees', ops: ['insert'],
      run: async ({ id, doc }) => {
        const { Salary, Notification } = models;
        if (Salary) {
          await safe('إنشاء راتب', async () => {
            const exists = await Salary.findOne({ employeeId: String(id), month: monthStr() });
            if (!exists) {
              await Salary.create({
                employeeId: String(id),
                employeeName: doc.name,
                amount: Number(doc.salary || doc.baseSalary || 0),
                month: monthStr(),
                status: 'pending',
                date: new Date(),
              });
            }
          });
        }
        if (Notification) {
          await safe('إشعار', () => Notification.create({
            message: `👤 تمت إضافة الموظف: ${doc.name}`,
            type: 'employee',
            date: new Date(),
          }));
        }
      },
    },

    // تعديل بيانات موظف => نشر الاسم/القسم/الإيميل في الأقسام المرتبطة بالـ employeeId
    {
      on: 'employees', ops: ['update'],
      run: async ({ id, doc }) => {
        const targets = ['Salary', 'Task', 'AttendanceLog'];
        for (const name of targets) {
          const M = models[name];
          if (!M) continue;
          await safe(`تحديث ${name}`, () => M.updateMany(
            { employeeId: String(id) },
            { $set: { employeeName: doc.name, employeeEmail: doc.email, department: doc.department } }
          ));
        }
      },
    },

    // حذف موظف => نحتفظ بالتاريخ المحاسبي ونعلّم السجلات فقط (ما نحذف رواتب قديمة)
    {
      on: 'employees', ops: ['delete'],
      run: async ({ id }) => {
        for (const name of ['Salary', 'Task', 'AttendanceLog']) {
          const M = models[name];
          if (!M) continue;
          await safe(`تعليم ${name}`, () => M.updateMany(
            { employeeId: String(id) },
            { $set: { employeeDeleted: true } }
          ));
        }
      },
    },
  ];

  const allRules = [...defaultRules, ...rules];

  const runRules = async (key, op, id, doc) => {
    for (const r of allRules) {
      if (r.on === key && r.ops.includes(op)) {
        await safe(`rule ${key}/${op}`, () => r.run({ id, doc, models, emit: emitChange }));
      }
    }
  };

  // ───────────── 4) مراقبة الموديلات ─────────────
  const OPS = { insert: 'insert', update: 'update', replace: 'update', delete: 'delete' };

  const watchModel = (modelName, Model) => {
    const key = KEY_MAP[modelName];
    if (!key || !Model || typeof Model.watch !== 'function') return;

    const start = () => {
      let stream;
      try {
        stream = Model.watch([], { fullDocument: 'updateLookup' });
      } catch (e) {
        console.error(`[realtime] تعذر مراقبة ${modelName}:`, e.message);
        return;
      }

      stream.on('change', (ev) => {
        const op = OPS[ev.operationType];
        if (!op) return;
        const id = ev.documentKey && ev.documentKey._id;
        const doc = ev.fullDocument || null;
        emitChange(key, op, id, doc);
        runRules(key, op, id, doc || {});
      });

      stream.on('error', (e) => {
        const msg = String(e.message || e);
        if (/replica set|40573|not supported/i.test(msg)) {
          console.error('[realtime] Change Streams تحتاج Replica Set (Atlas). المزامنة التلقائية معطلة.');
          return; // لا فائدة من إعادة المحاولة
        }
        console.warn(`[realtime] ${modelName} stream error، إعادة محاولة بعد 5 ثواني:`, msg);
        try { stream.close(); } catch (_) {}
        setTimeout(start, 5000);
      });
    };
    start();
  };

  Object.entries(models).forEach(([name, Model]) => watchModel(name, Model));
  console.log('[realtime] المزامنة اللحظية شغالة على:', Object.keys(models).filter(n => KEY_MAP[n]).join(', '));

  return { emitChange };
};

module.exports.KEY_MAP = KEY_MAP;
