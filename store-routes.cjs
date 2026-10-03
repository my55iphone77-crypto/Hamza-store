const express = require('express');

module.exports = function buildStoreRouter(deps) {
  const {
    Product, Order, Support, Mail, Category, NOTIFY_EMAILS, Notification,
    Customer, Transaction, Ticket, Sale, Employee, Achievement, Announcement,
    WorkHour, AttendanceLog, AppState,
    Settings, Salary, Task, DocumentModel, Coupon,
    mongoose, sendStoreEmail, verifyOwnerMiddleware, bcrypt, crypto,
    io, User, getUserFromAuthHeader, publicActionLimiter
  } = deps;

  const router = express.Router();

  // ── بث التحديثات لكل العملاء عبر Socket.IO (هذا كان مفقود: الواجهة تنتظر UPDATE_DATA ولا أحد يرسلها) ──
  const broadcast = (type, payload) => {
    try { if (io) io.to('staff').emit('UPDATE_DATA', { type, payload }); } catch (e) { console.error('emit error', e.message); }
  };
  const broadcastList = async (type, Model, sort = { date: -1 }) => {
    try { broadcast(type, await Model.find().sort(sort)); } catch (e) { console.error('broadcastList error', e.message); }
  };

  // رفع الملفات (اختياري): npm i multer  +  app.use('/uploads', express.static('uploads'))
  let upload = { single: () => (req, res, next) => next() };
  try {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    upload = multer({
      storage: multer.diskStorage({
        destination: dir,
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^\w.\-]/g, '_')),
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    });
  } catch (e) {
    console.warn('multer غير مثبت: رفع الملفات معطّل، سيتم حفظ بيانات المستند فقط');
  }

  // ============================= الإعدادات العامة =============================
  router.get('/settings', async (req, res) => {
    try {
      const setting = await Settings.findOne();
      res.json(setting || {});
    } catch (err) {
      res.status(500).json({ error: 'خطأ في جلب الإعدادات' });
    }
  });

  router.put('/settings', permissionGuard('manage_settings', 'manager'), async (req, res) => {
    try {
      let setting = await Settings.findOne();
      if (!setting) {
        setting = new Settings(req.body);
      } else {
        Object.assign(setting, req.body);
      }
      await setting.save();
      res.json(setting);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في تحديث الإعدادات' });
    }
  });

  // ============================= الرواتب =============================
  router.get('/salaries', permissionGuard('manage_salaries', 'manager'), async (req, res) => {
    try {
      const salaries = await Salary.find().sort({ date: -1 });
      res.json(salaries);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في جلب الرواتب' });
    }
  });

  router.post('/salaries', permissionGuard('manage_salaries', 'manager'), async (req, res) => {
    try {
      const newSalary = new Salary(req.body);
      await newSalary.save();
      res.json(newSalary);
      broadcastList('SALARIES', Salary);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في إضافة الراتب' });
    }
  });

  // ============================= المهام =============================
  router.get('/tasks', permissionGuard('manage_tasks'), async (req, res) => {
    try {
      const tasks = await Task.find().sort({ date: -1 });
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في جلب المهام' });
    }
  });

  router.post('/tasks', permissionGuard('manage_tasks'), async (req, res) => {
    try {
      const newTask = new Task(req.body);
      await newTask.save();
      res.json(newTask);
      broadcastList('TASKS', Task);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في إضافة المهمة' });
    }
  });

  // ============================= الوثائق =============================
  router.get('/documents', permissionGuard('manage_documents'), async (req, res) => {
    try {
      const q = {};
      const search = String(req.query.search || '').trim();
      if (search) {
        const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        q.$or = [{ title: rx }, { description: rx }, { tags: rx }];
      }
      const docs = await DocumentModel.find(q).sort({ date: -1 });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في جلب الوثائق' });
    }
  });

  router.post('/documents', permissionGuard('manage_documents'), upload.single('file'), async (req, res) => {
    try {
      const body = { ...req.body };
      if (typeof body.tags === 'string') body.tags = body.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (req.file) body.file = { url: '/uploads/' + req.file.filename, name: req.file.originalname };
      const newDoc = new DocumentModel({ ...body, version: 1, deleted: false });
      await newDoc.save();
      res.json(newDoc);
      broadcastList('DOCUMENTS', DocumentModel);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'خطأ في إضافة الوثيقة' });
    }
  });

  router.put('/documents/:id', permissionGuard('manage_documents'), async (req, res) => {
    try {
      const doc = await DocumentModel.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'الوثيقة غير موجودة' });
      const { title, description, tags, deleted } = req.body;
      if (title !== undefined) doc.title = title;
      if (description !== undefined) doc.description = description;
      if (tags !== undefined) doc.tags = Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean);
      if (deleted !== undefined) doc.deleted = !!deleted;
      else doc.version = (doc.version || 1) + 1;
      await doc.save();
      res.json(doc);
      broadcastList('DOCUMENTS', DocumentModel);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في تحديث الوثيقة' });
    }
  });

  // حذف ناعم (soft delete) لأن الواجهة تعرض "المحذوفة" وتسمح بالاستعادة
  router.delete('/documents/:id', permissionGuard('manage_documents'), async (req, res) => {
    try {
      const doc = await DocumentModel.findByIdAndUpdate(req.params.id, { deleted: true }, { new: true });
      if (!doc) return res.status(404).json({ error: 'الوثيقة غير موجودة' });
      res.json({ success: true });
      broadcastList('DOCUMENTS', DocumentModel);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في حذف الوثيقة' });
    }
  });

  // ============================= الكوبونات =============================
  router.get('/coupons', permissionGuard('manage_coupons'), async (req, res) => {
    try {
      const coupons = await Coupon.find().sort({ date: -1 });
      res.json(coupons);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في جلب الكوبونات' });
    }
  });

  router.post('/coupons', permissionGuard('manage_coupons'), async (req, res) => {
    try {
      const newCoupon = new Coupon(req.body);
      await newCoupon.save();
      res.json(newCoupon);
      broadcastList('COUPONS', Coupon);
    } catch (err) {
      res.status(500).json({ error: 'خطأ في إضافة الكوبون' });
    }
  });


  // ============================= الصلاحيات =============================
  const STAFF_ROLES = ['owner', 'admin', 'manager', 'stock', 'sales', 'support', 'employee', 'staff'];
  const MANAGER_ROLES = ['owner', 'admin', 'manager'];
  const ROLE_PERMISSIONS = {
    owner: ['*'],
    admin: ['*'],
    manager: ['manage_products', 'manage_employees', 'manage_salaries', 'manage_attendance', 'manage_work_hours', 'manage_tasks', 'manage_performance', 'manage_achievements', 'manage_commissions', 'manage_accounting', 'manage_orders', 'manage_customers', 'manage_support', 'manage_tickets', 'manage_documents', 'send_email', 'manage_announcements', 'view_analytics', 'manage_coupons', 'view_logs', 'view_dashboard'],
    stock: ['view_dashboard', 'manage_products', 'manage_work_hours', 'manage_tasks'],
    sales: ['view_dashboard', 'manage_products', 'manage_orders', 'manage_customers', 'manage_coupons', 'manage_commissions'],
    support: ['view_dashboard', 'manage_customers', 'manage_support', 'manage_tickets', 'manage_documents', 'send_email'],
    employee: ['view_dashboard', 'manage_tasks', 'manage_work_hours', 'manage_achievements'],
    staff: ['view_dashboard'],
  };
  const roleOf = (u) => String((u && u.role) || '').toLowerCase();
  const isStaff = (u) => !!u && (u.isOwner || STAFF_ROLES.includes(roleOf(u)));
  const isManager = (u) => !!u && (u.isOwner || MANAGER_ROLES.includes(roleOf(u)));
  const hasPermission = (u, permission) => {
    if (!u || !permission) return false;
    if (u.isOwner || roleOf(u) === 'owner') return true;
    const allowed = Array.isArray(u.permissions) ? u.permissions : ROLE_PERMISSIONS[roleOf(u)] || [];
    return allowed.includes('*') || allowed.includes(permission);
  };

  // level: public | staff | manager | owner
  const guard = (level) => async (req, res, next) => {
    if (level === 'public') return next();
    if (level === 'owner') return verifyOwnerMiddleware(req, res, next);
    const user = await getUserFromAuthHeader(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'غير حاصل على تصريح، يرجى تسجيل الدخول.' });
    const ok = level === 'manager' ? isManager(user) : isStaff(user);
    if (!ok) return res.status(403).json({ error: 'ليس لديك صلاحية لهذه العملية.' });
    req.user = user;
    next();
  };

  async function permissionGuard(permission, fallback = 'staff') {
    const user = await getUserFromAuthHeader(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'غير حاصل على تصريح، يرجى تسجيل الدخول.' });
    const usesDefaultRolePermissions = !Array.isArray(user.permissions);
    if (!hasPermission(user, permission) && !(usesDefaultRolePermissions && fallback === 'manager' && isManager(user))) {
      return res.status(403).json({ error: 'ليس لديك صلاحية لهذه العملية.' });
    }
    req.user = user;
    next();
  }

  const toObj = (d) => (d && typeof d.toJSON === 'function' ? d.toJSON() : { ...d });
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const monthStr = () => new Date().toISOString().slice(0, 7);
  const sysMail = (subject, body) => Mail.create({
    sender: 'النظام', recipient: (process.env.OWNER_EMAIL || '').toLowerCase(),
    subject, body, title: subject, message: body, read: false,
  });

  // مصنع CRUD عام لباقي الأقسام
  function crud(path, Model, o = {}) {
    const { list = 'staff', create = 'staff', update = 'staff', remove = 'staff', sort = { createdAt: -1 } } = o;
    router.get(path, guard(list), async (req, res) => {
      try { res.json(await Model.find().sort(sort)); }
      catch (e) { res.status(500).json({ error: 'خطأ في جلب البيانات' }); }
    });
    router.post(path, guard(create), async (req, res) => {
      try {
        const d = await new Model(req.body).save();
        if (path === '/customers' && User && d.email) {
          await User.findOneAndUpdate({ email: String(d.email).trim().toLowerCase() }, { $set: { storeBalance: Math.max(0, Number(d.storeBalance || 0)), loyaltyPoints: Math.max(0, Number(d.loyaltyPoints || 0)), loyaltyThreshold: Math.max(1, Number(d.loyaltyThreshold || 100)) } });
        }
        res.json(d);
      }
      catch (e) { res.status(400).json({ error: e.message || 'بيانات غير صالحة' }); }
    });
    router.put(`${path}/:id`, guard(update), async (req, res) => {
      try {
        const d = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!d) return res.status(404).json({ error: 'غير موجود' });
        if (path === '/customers' && User && d.email) {
          await User.findOneAndUpdate({ email: String(d.email).trim().toLowerCase() }, { $set: { storeBalance: Math.max(0, Number(d.storeBalance || 0)), loyaltyPoints: Math.max(0, Number(d.loyaltyPoints || 0)), loyaltyThreshold: Math.max(1, Number(d.loyaltyThreshold || 100)) } });
        }
        res.json(d);
      } catch (e) { res.status(400).json({ error: e.message || 'فشل التحديث' }); }
    });
    router.delete(`${path}/:id`, guard(remove), async (req, res) => {
      try {
        const d = await Model.findByIdAndDelete(req.params.id);
        if (!d) return res.status(404).json({ error: 'غير موجود' });
        res.json({ success: true });
      } catch (e) { res.status(500).json({ error: 'فشل الحذف' }); }
    });
  }

  // ============================= المنتجات =============================
  // الزوار يشوفوا المنتجات بدون الأكواد (codes هي مفاتيح البطاقات الفعلية!)
  router.get('/products', async (req, res) => {
    try {
      const user = await getUserFromAuthHeader(req.headers.authorization);
      const products = await Product.find().sort({ createdAt: -1 });
      res.json(products.map((p) => { const o = toObj(p); if (!isStaff(user)) delete o.codes; return o; }));
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب المنتجات' }); }
  });
  router.post('/products', guard('staff'), async (req, res) => {
    try { res.json(await new Product(req.body).save()); }
    catch (e) { res.status(400).json({ error: e.message || 'بيانات المنتج غير صالحة' }); }
  });
  router.put('/products/:id', guard('staff'), async (req, res) => {
    try {
      const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!p) return res.status(404).json({ error: 'المنتج غير موجود' });
      res.json(p);
    } catch (e) { res.status(400).json({ error: e.message || 'فشل تحديث المنتج' }); }
  });
  router.delete('/products/:id', guard('manager'), async (req, res) => {
    try {
      const p = await Product.findByIdAndDelete(req.params.id);
      if (!p) return res.status(404).json({ error: 'المنتج غير موجود' });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'فشل حذف المنتج' }); }
  });

  // ============================= الفئات =============================
  crud('/categories', Category, { list: 'public', create: 'staff', update: 'staff', remove: 'manager', sort: { name: 1 } });

  // ============================= الطلبات =============================
  // إنشاء طلب من الزبون (عام). المبلغ يُحسب من أسعار قاعدة البيانات، ما نثق بسعر الواجهة.
  router.post('/orders', publicActionLimiter, async (req, res) => {
    try {
      const { customerName, customerEmail, customerAddress, paymentMethod, redeemPoints } = req.body || {};
      const authUser = await getUserFromAuthHeader(req.headers.authorization);
      const rawItems = Array.isArray(req.body && req.body.items) ? req.body.items : [];
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerEmail || '').trim());
      if (!customerName || !emailOk || rawItems.length === 0) {
        return res.status(400).json({ error: 'بيانات الطلب ناقصة.' });
      }
      if (String(customerName).length > 120 || String(customerEmail).length > 254 || String(customerAddress || '').length > 500) {
        return res.status(400).json({ error: 'بيانات الطلب تتجاوز الحد المسموح.' });
      }
      let total = 0;
      const items = [];
      for (const it of rawItems.slice(0, 50)) {
        const qty = Math.max(1, Math.min(100, Number(it.quantity) || 1));
        let name = it.name, price = Number(it.price) || 0;
        if (it.id && mongoose.isValidObjectId(it.id)) {
          const prod = await Product.findById(it.id);
          if (!prod) return res.status(400).json({ error: 'أحد المنتجات لم يعد متوفراً.' });
          name = prod.name;
          price = Number(prod.discountPrice || prod.price);
        }
        total += price * qty;
        items.push({ id: String(it.id || ''), name, price, quantity: qty });
      }
      let walletAmount = 0;
      if (paymentMethod === 'store_balance') {
        if (!authUser) return res.status(401).json({ error: 'سجّل الدخول لاستخدام رصيد المتجر.' });
        if (Number(authUser.storeBalance || 0) < total) return res.status(400).json({ error: 'رصيد المتجر غير كافٍ.' });
        walletAmount = total;
      }
      let loyaltyPointsRedeemed = 0;
      let loyaltyRewardItem = '';
      const threshold = Math.max(1, Number(authUser?.loyaltyThreshold || 100));
      if (redeemPoints === true || redeemPoints === 'true') {
        if (!authUser) return res.status(401).json({ error: 'سجّل الدخول لاستخدام نقاط الولاء.' });
        if (Number(authUser.loyaltyPoints || 0) < threshold) return res.status(400).json({ error: `تحتاج ${threshold} نقطة للحصول على منتج مجاني.` });
        const reward = await Product.findOne({ stock: { $gt: 0 } }).sort({ price: 1 });
        if (!reward) return res.status(400).json({ error: 'لا يوجد منتج متاح للمكافأة حالياً.' });
        const reservedReward = await Product.findOneAndUpdate({ _id: reward._id, stock: { $gt: 0 } }, { $inc: { stock: -1 } }, { new: true });
        if (!reservedReward) return res.status(409).json({ error: 'انتهى مخزون المكافأة للتو، اختر المحاولة مرة أخرى.' });
        items.push({ id: String(reward._id), name: `${reward.name} (مكافأة ولاء)`, price: 0, quantity: 1 });
        loyaltyPointsRedeemed = threshold;
        loyaltyRewardItem = reward.name;
      }
      const pointsEarned = authUser ? Math.max(0, Math.floor(total)) : 0;
      if (authUser) {
        const update = { $inc: { loyaltyPoints: pointsEarned - loyaltyPointsRedeemed } };
        if (walletAmount > 0) update.$inc.storeBalance = -walletAmount;
        const updatedUser = await User.findOneAndUpdate(
          { _id: authUser._id, ...(walletAmount > 0 ? { storeBalance: { $gte: walletAmount } } : {}), ...(loyaltyPointsRedeemed > 0 ? { loyaltyPoints: { $gte: loyaltyPointsRedeemed } } : {}) },
          update, { new: true }
        );
        if (!updatedUser) return res.status(409).json({ error: 'تغيّرت بيانات الرصيد أو النقاط، حدّث الصفحة وحاول مرة أخرى.' });
        await Customer.findOneAndUpdate(
          { email: String(authUser.email).trim().toLowerCase() },
          { $setOnInsert: { name: authUser.name || customerName, email: String(authUser.email).trim().toLowerCase() }, $inc: { storeBalance: walletAmount ? -walletAmount : 0, loyaltyPoints: pointsEarned - loyaltyPointsRedeemed } },
          { upsert: true, new: true }
        );
      }
      const order = await new Order({
        customerName: String(customerName).trim(),
        customerEmail: String(customerEmail).trim().toLowerCase(),
        customerAddress: String(customerAddress || 'طلب رقمي من المتجر').trim(),
        items, totalAmount: total, currency: 'JOD', status: 'جديد',
        paymentMethod: String(paymentMethod || ''), walletAmount,
        loyaltyPointsEarned: pointsEarned, loyaltyPointsRedeemed, loyaltyRewardItem
      }).save();
      res.json({ order, account: authUser ? { storeBalance: Number(authUser.storeBalance || 0) - walletAmount, loyaltyPoints: Number(authUser.loyaltyPoints || 0) + pointsEarned - loyaltyPointsRedeemed, loyaltyThreshold: threshold } : undefined });
    } catch (e) { res.status(400).json({ error: e.message || 'فشل إنشاء الطلب' }); }
  });
  // تتبع الطلب بالرقم (عام، حقول محدودة بدون بيانات شخصية)
  router.get('/orders/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'الطلب غير موجود' });
      const o = await Order.findById(req.params.id);
      if (!o) return res.status(404).json({ error: 'الطلب غير موجود' });
      const j = toObj(o);
      res.json({ _id: j._id, id: j.id, status: j.status || 'جديد', items: j.items, totalAmount: j.totalAmount, date: j.date });
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب الطلب' }); }
  });
  router.get('/orders', guard('staff'), async (req, res) => {
    try { res.json(await Order.find().sort({ date: -1 })); }
    catch (e) { res.status(500).json({ error: 'خطأ في جلب الطلبات' }); }
  });
  router.put('/orders/:id', guard('staff'), async (req, res) => {
    try {
      const o = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!o) return res.status(404).json({ error: 'الطلب غير موجود' });
      res.json(o);
    } catch (e) { res.status(400).json({ error: 'فشل تحديث الطلب' }); }
  });
  router.delete('/orders/:id', guard('owner'), async (req, res) => {
    try { await Order.findByIdAndDelete(req.params.id); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: 'فشل حذف الطلب' }); }
  });

  // ============================= شكاوى / رسائل العملاء (requests) =============================
  router.post('/requests', publicActionLimiter, async (req, res) => {
    try {
      const { customerName, customerEmail, phone, location, issue } = req.body || {};
      if (!customerName || !issue) return res.status(400).json({ error: 'الاسم ونص المشكلة مطلوبان.' });
      if (String(customerName).length > 120 || String(issue).length > 3000 || String(phone || '').length > 40 || String(location || '').length > 200) {
        return res.status(400).json({ error: 'بيانات الشكوى تتجاوز الحد المسموح.' });
      }
      res.json(await new Support({ customerName, customerEmail, phone, location, issue }).save());
    } catch (e) { res.status(400).json({ error: 'فشل إرسال الشكوى' }); }
  });
  router.get('/requests/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'غير موجود' });
      const r = await Support.findById(req.params.id);
      if (!r) return res.status(404).json({ error: 'غير موجود' });
      res.json({ _id: r._id, id: r.id, issue: r.issue, status: r.status, reply: r.reply, date: r.date });
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب الشكوى' }); }
  });
  router.get('/requests', guard('staff'), async (req, res) => {
    try { res.json(await Support.find().sort({ date: -1 })); }
    catch (e) { res.status(500).json({ error: 'خطأ في جلب الشكاوى' }); }
  });
  // الرد على الزبون: يتحدث عند كل الموظفين لحظياً + يوصل الزبون إيميل
  router.put('/requests/:id', guard('staff'), async (req, res) => {
    try {
      const before = await Support.findById(req.params.id);
      if (!before) return res.status(404).json({ error: 'غير موجود' });
      const { reply, status } = req.body || {};
      const oldReply = String(before.reply || '');
      if (reply !== undefined) before.reply = String(reply);
      if (status !== undefined) before.status = String(status);
      else if (reply && before.status === 'قيد المراجعة') before.status = 'تم الرد';
      const replyChanged = reply !== undefined && String(reply).trim() !== '' && String(reply) !== oldReply;
      before.set('repliedBy', req.user.name || req.user.email);
      await before.save();
      res.json(before);
      if (replyChanged && before.customerEmail && typeof sendStoreEmail === 'function') {
        sendStoreEmail(
          before.customerEmail,
          'رد على استفسارك - متجر حمزة',
          `<div dir="rtl" style="font-family:Tahoma,Arial"><p>مرحباً ${esc(before.customerName)}،</p><p>${esc(before.reply)}</p><p style="color:#888">بخصوص: ${esc(before.issue)}</p></div>`
        );
      }
    } catch (e) { res.status(400).json({ error: 'فشل تحديث الشكوى' }); }
  });
  router.delete('/requests/:id', guard('manager'), async (req, res) => {
    try { await Support.findByIdAndDelete(req.params.id); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: 'فشل الحذف' }); }
  });

  // ============================= الموظفون (مرتبطون بالرواتب والحسابات والدوام) =============================
  const EMP_FIELDS = ['name', 'email', 'role', 'permissions', 'salary', 'phone', 'age', 'nationalId', 'idCardImage', 'bankAccount', 'image', 'hireDate', 'status', 'isActive', 'attendanceStatus', 'lastCheckIn', 'lastCheckOut'];
  const EMP_ROLES = ['admin', 'manager', 'stock', 'sales', 'support'];
  const SAFE_EMP_FIELDS = ['_id', 'id', 'name', 'email', 'role', 'image', 'status', 'isActive', 'hireDate', 'attendanceStatus', 'lastCheckIn', 'lastCheckOut', 'createdAt', 'updatedAt'];
  const limitEmp = (e) => { const o = cleanEmp(e); const r = {}; SAFE_EMP_FIELDS.forEach((k) => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
  const cleanEmp = (e) => { const o = toObj(e); delete o.password; return o; };

  router.get('/employees', permissionGuard('manage_employees', 'manager'), async (req, res) => {
    try {
      const list = await Employee.find().sort({ createdAt: -1 });
      // الراتب والهوية والحساب البنكي لا يراها إلا المدراء
      res.json(list.map(isManager(req.user) ? cleanEmp : limitEmp));
    }
    catch (e) { res.status(500).json({ error: 'خطأ في جلب الموظفين' }); }
  });

  router.post('/employees', permissionGuard('manage_employees', 'manager'), async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.name || !b.email) return res.status(400).json({ error: 'الاسم والإيميل مطلوبان.' });
      if (b.password && String(b.password).length < 6) return res.status(400).json({ error: 'كلمة المرور قصيرة (6 أحرف على الأقل).' });
      // بدون كلمة مرور => عشوائية غير معروفة، وصاحب الحساب يستخدم "نسيت كلمة المرور" لتعيين كلمته
      if (!b.password) b.password = crypto.randomBytes(18).toString('hex');
      const data = {};
      EMP_FIELDS.forEach((k) => { if (b[k] !== undefined) data[k] = b[k]; });
      data.email = String(b.email).trim().toLowerCase();
      data.role = EMP_ROLES.includes(b.role) ? b.role : 'stock';
      if (Array.isArray(b.permissions) && (req.user.isOwner || roleOf(req.user) === 'admin')) {
        data.permissions = [...new Set(b.permissions.map(String).filter(Boolean))].slice(0, 100);
      } else {
        delete data.permissions;
      }
      // مدير عادي ما يقدر يعيّن admin
      if (data.role === 'admin' && !req.user.isOwner && roleOf(req.user) !== 'admin') data.role = 'manager';
      const hash = await bcrypt.hash(String(b.password), 10);
      const emp = await new Employee({ ...data, password: hash }).save();

      // ── الربط التلقائي بباقي الأقسام ──
      const id = String(emp._id);
      try { await Salary.create({ employeeId: id, employeeName: emp.name, amount: Number(emp.salary) || 0, month: monthStr() }); }
      catch (e) { console.warn('[link] راتب:', e.message); }
      try {
        if (User) {
          const existing = await User.findOne({ email: emp.email });
          if (!existing) {
            await User.create({ name: emp.name, email: emp.email, password: hash, role: emp.role, permissions: emp.permissions, emailVerified: true });
          } else if (!existing.isOwner) {
            existing.role = emp.role; existing.name = existing.name || emp.name;
            await existing.save();
          }
        }
      } catch (e) { console.warn('[link] حساب دخول:', e.message); }
      try { await sysMail('👤 موظف جديد', `تمت إضافة الموظف ${emp.name} (${emp.email}) بواسطة ${req.user.name || req.user.email}`); }
      catch (e) { console.warn('[link] بريد:', e.message); }

      res.json({ employee: cleanEmp(emp) });
    } catch (e) {
      if (e && e.code === 11000) return res.status(409).json({ error: 'هذا الإيميل مسجل لموظف آخر.' });
      res.status(400).json({ error: e.message || 'فشل إضافة الموظف' });
    }
  });

  router.put('/employees/:id', permissionGuard('manage_employees', 'manager'), async (req, res) => {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });
      const old = { name: emp.name, email: emp.email, salary: emp.salary, role: emp.role };
      const b = req.body || {};
      EMP_FIELDS.forEach((k) => { if (b[k] !== undefined) emp[k] = b[k]; });
      if (b.email) emp.email = String(b.email).trim().toLowerCase();
      if (b.role && !EMP_ROLES.includes(b.role)) emp.role = old.role;
      if (Array.isArray(b.permissions) && (req.user.isOwner || roleOf(req.user) === 'admin')) {
        emp.permissions = [...new Set(b.permissions.map(String).filter(Boolean))].slice(0, 100);
      }
      let newHash = null;
      if (b.password) {
        if (String(b.password).length < 6) return res.status(400).json({ error: 'كلمة المرور قصيرة.' });
        newHash = await bcrypt.hash(String(b.password), 10);
        emp.password = newHash;
      }
      await emp.save();

      // ── نشر التغييرات للأقسام المرتبطة ──
      const id = String(emp._id);
      const safe = async (label, fn) => { try { await fn(); } catch (e) { console.warn('[link]', label, e.message); } };
      if (emp.name !== old.name) {
        await safe('دوام', () => WorkHour.updateMany({ name: old.name }, { $set: { name: emp.name } }));
        await safe('مهام', () => Task.updateMany({ assignedTo: old.name }, { $set: { assignedTo: emp.name } }));
        await safe('تذاكر', () => Ticket.updateMany({ assignedTo: old.name }, { $set: { assignedTo: emp.name } }));
      }
      if (emp.name !== old.name) await safe('رواتب-اسم', () => Salary.updateMany({ employeeId: id }, { $set: { employeeName: emp.name } }));
      if (Number(emp.salary) !== Number(old.salary)) {
        // نعدل الراتب المعلّق للشهر الحالي فقط، ما نلمس الرواتب المدفوعة
        await safe('رواتب-مبلغ', () => Salary.updateMany(
          { employeeId: id, month: monthStr(), status: 'قيد الانتظار' }, { $set: { amount: Number(emp.salary) || 0 } }));
      }
      if (User && (emp.email !== old.email || emp.role !== old.role || emp.name !== old.name || newHash || Array.isArray(b.permissions))) {
        await safe('حساب دخول', async () => {
          const u = await User.findOne({ email: old.email });
          if (u && !u.isOwner) {
            u.email = emp.email; u.role = emp.role; u.name = emp.name;
            if (Array.isArray(emp.permissions)) u.permissions = emp.permissions;
            if (newHash) u.password = newHash;
            await u.save();
          }
        });
      }
      res.json({ employee: cleanEmp(emp) });
    } catch (e) {
      if (e && e.code === 11000) return res.status(409).json({ error: 'هذا الإيميل مسجل لموظف آخر.' });
      res.status(400).json({ error: e.message || 'فشل تحديث الموظف' });
    }
  });

  router.delete('/employees/:id', permissionGuard('manage_employees', 'manager'), async (req, res) => {
    try {
      const emp = await Employee.findByIdAndDelete(req.params.id);
      if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });
      // الموظف المفصول يفقد صلاحيات الدخول فوراً، والرواتب القديمة تبقى للتاريخ المحاسبي
      if (User) {
        try {
          const u = await User.findOne({ email: emp.email });
          if (u && !u.isOwner) { u.role = 'customer'; await u.save(); }
        } catch (e) { console.warn('[link] إلغاء صلاحيات:', e.message); }
      }
      try { await sysMail('🚪 إنهاء خدمة موظف', `تم حذف الموظف ${emp.name} بواسطة ${req.user.name || req.user.email}`); } catch (_) {}
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'فشل حذف الموظف' }); }
  });

  // ============================= الدوام والحضور =============================
  router.get('/work-hours', permissionGuard('manage_work_hours'), async (req, res) => {
    try { res.json(await WorkHour.find().sort({ date: -1 })); }
    catch (e) { res.status(500).json({ error: 'خطأ في جلب سجلات الدوام' }); }
  });
  router.post('/work-hours', permissionGuard('manage_work_hours'), async (req, res) => {
    try {
      const { name, department, date, start, end } = req.body || {};
      res.json(await new WorkHour({ name, department, date, start, end }).save());
    } catch (e) { res.status(400).json({ error: 'بيانات الدوام غير صالحة' }); }
  });
  router.delete('/work-hours/:id', permissionGuard('manage_work_hours'), async (req, res) => {
    try { await WorkHour.findByIdAndDelete(req.params.id); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: 'فشل الحذف' }); }
  });
  router.get('/attendance', permissionGuard('manage_attendance'), async (req, res) => {
    try { res.json(await Employee.find().select('name attendanceStatus lastCheckIn lastCheckOut')); }
    catch (e) { res.status(500).json({ error: 'خطأ في جلب الحضور' }); }
  });
  router.get('/attendance-logs', permissionGuard('manage_attendance'), async (req, res) => {
    try { res.json((await AttendanceLog.find().sort({ createdAt: -1 }).limit(500)).map((d) => d.log)); }
    catch (e) { res.status(500).json({ error: 'خطأ' }); }
  });
  router.post('/attendance-logs', permissionGuard('manage_attendance'), async (req, res) => {
    try { res.json(await new AttendanceLog({ log: String(req.body.log || '') }).save()); }
    catch (e) { res.status(400).json({ error: 'سجل غير صالح' }); }
  });


  // ── تسجيل الحضور/الانصراف: وقت السيرفر (لا نثق بوقت العميل)، والموظف يسجّل لنفسه، والمدير لأي أحد ──
  async function markAttendance(req, res, kind) {
    try {
      const emp = await Employee.findById(req.params.id);
      if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });
      const self = req.user.email && String(emp.email).toLowerCase() === String(req.user.email).toLowerCase();
      if (!self && !isManager(req.user)) return res.status(403).json({ error: 'تسجّل حضورك أنت فقط.' });
      const stamp = new Date().toLocaleString('ar-JO', { timeZone: 'Asia/Amman' });
      if (kind === 'in') { emp.attendanceStatus = 'حاضر'; emp.lastCheckIn = stamp; }
      else { emp.attendanceStatus = 'غادر'; emp.lastCheckOut = stamp; }
      await emp.save();
      res.json({ employee: cleanEmp(emp) });
    } catch (e) { res.status(500).json({ error: 'فشل تسجيل الحضور' }); }
  }
  router.post('/employees/:id/check-in', permissionGuard('manage_attendance'), (req, res) => markAttendance(req, res, 'in'));
  router.post('/employees/:id/check-out', permissionGuard('manage_attendance'), (req, res) => markAttendance(req, res, 'out'));

  // ── البريد الداخلي: المدير يشوف الكل، الموظف يشوف رسائله فقط ──
  const mineKeys = (u) => [u.email, u.name].filter(Boolean).flatMap((v) => [v, String(v).toLowerCase()]);
  const ownsMail = (u, m) => isManager(u) || mineKeys(u).includes(m.recipient) || mineKeys(u).includes(m.sender);
  router.get('/mails', permissionGuard('send_email'), async (req, res) => {
    try {
      const q = isManager(req.user) ? {} : { $or: [{ recipient: { $in: mineKeys(req.user) } }, { sender: { $in: mineKeys(req.user) } }] };
      res.json(await Mail.find(q).sort({ date: -1 }).limit(500));
    } catch (e) { res.status(500).json({ error: 'خطأ في جلب البريد' }); }
  });
  router.put('/mails/:id', permissionGuard('send_email'), async (req, res) => {
    try {
      const m = await Mail.findById(req.params.id);
      if (!m) return res.status(404).json({ error: 'غير موجود' });
      if (!ownsMail(req.user, m)) return res.status(403).json({ error: 'ليست رسالتك.' });
      Object.assign(m, req.body); await m.save(); res.json(m);
    } catch (e) { res.status(400).json({ error: 'فشل التحديث' }); }
  });
  router.delete('/mails/:id', permissionGuard('send_email'), async (req, res) => {
    try {
      const m = await Mail.findById(req.params.id);
      if (!m) return res.status(404).json({ error: 'غير موجود' });
      if (!ownsMail(req.user, m)) return res.status(403).json({ error: 'ليست رسالتك.' });
      await m.deleteOne(); res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'فشل الحذف' }); }
  });

  // ── مفاتيح الحالة المتزامنة (useSyncedState): user:<id>:* خاصة بصاحبها، والباقي مشترك للموظفين ──
  const stateAllowed = (req, key) => {
    const m = /^user:([^:]+):/.exec(key);
    return m ? String(req.user._id) === m[1] : true;
  };
  router.get('/state/:key', guard('staff'), async (req, res) => {
    try {
      if (!stateAllowed(req, req.params.key)) return res.status(403).json({ error: 'غير مسموح' });
      const doc = await AppState.findOne({ key: req.params.key });
      if (!doc) return res.status(404).json({ error: 'not found' });
      res.json({ key: doc.key, value: doc.value });
    } catch (err) { res.status(500).json({ error: 'خطأ في جلب الحالة' }); }
  });
  router.put('/state/:key', guard('staff'), async (req, res) => {
    try {
      if (!stateAllowed(req, req.params.key)) return res.status(403).json({ error: 'غير مسموح' });
      const value = req.body && req.body.value;
      if (JSON.stringify(value === undefined ? null : value).length > 1_000_000) return res.status(413).json({ error: 'البيانات كبيرة جداً' });
      const doc = await AppState.findOneAndUpdate(
        { key: req.params.key }, { key: req.params.key, value },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      res.json({ key: doc.key, value: doc.value }); // البث يتم تلقائياً عبر realtime-sync
    } catch (err) { res.status(500).json({ error: 'خطأ في حفظ الحالة' }); }
  });

  // ── إرسال بريد حقيقي (موظفين فقط + حد 300 رسالة/ساعة لكل مستخدم لمنع إساءة الاستخدام) ──
  const mailBuckets = new Map();
  const allowMail = (uid) => {
    const now = Date.now();
    const b = (mailBuckets.get(uid) || []).filter((t) => now - t < 3600e3);
    if (b.length >= 300) return false;
    b.push(now); mailBuckets.set(uid, b); return true;
  };
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
  router.post('/sendExternalMail', permissionGuard('send_email'), async (req, res) => {
    try {
      const { to, subject, body } = req.body || {};
      if (!validEmail(to)) return res.status(400).json({ error: 'إيميل المستلم غير صالح.' });
      if (!allowMail(String(req.user._id))) return res.status(429).json({ error: 'تجاوزت حد الإرسال في الساعة.' });
      const ok = await sendStoreEmail(String(to), String(subject || 'رسالة من متجر حمزة').slice(0, 200), String(body || '').slice(0, 50000));
      if (!ok) return res.status(502).json({ error: 'فشل إرسال البريد من الخادم.' });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'خطأ في إرسال البريد' }); }
  });

  // ============================= باقي الأقسام =============================
  crud('/customers', Customer);
  crud('/tickets', Ticket);
  crud('/sales', Sale, { remove: 'manager' });
  crud('/accounting/transactions', Transaction, { sort: { date: -1 }, remove: 'manager' });
  crud('/announcements', Announcement, { remove: 'manager' });
  crud('/achievements', Achievement, { remove: 'manager' });
  crud('/mails', Mail, { sort: { date: -1 } });

  router.get('/notifications', permissionGuard('view_dashboard'), async (req, res) => {
    try { res.json(await Notification.find().sort({ date: -1 }).limit(200)); }
    catch (e) { res.status(500).json({ error: 'خطأ' }); }
  });
  router.put('/notifications/:id/read', permissionGuard('view_dashboard'), async (req, res) => {
    try { res.json(await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true })); }
    catch (e) { res.status(400).json({ error: 'فشل' }); }
  });

  // إرسال إيميل (للموظفين فقط)
  router.post('/send-email', permissionGuard('send_email'), async (req, res) => {
    try {
      const { to, subject, message } = req.body || {};
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) return res.status(400).json({ error: 'إيميل المستلم غير صالح.' });
      if (!allowMail(String(req.user._id))) return res.status(429).json({ error: 'تجاوزت حد الإرسال في الساعة.' });
      const ok = await sendStoreEmail(String(to), String(subject || 'رسالة من متجر حمزة').slice(0, 200),
        `<div dir="rtl" style="font-family:Tahoma,Arial;white-space:pre-line">${esc(message)}</div>`);
      if (!ok) return res.status(502).json({ error: 'فشل إرسال البريد من الخادم.' });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'خطأ في إرسال البريد' }); }
  });


  return router;
};
