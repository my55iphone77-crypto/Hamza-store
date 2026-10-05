require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const passport = require('passport');
const Groq = require('groq-sdk');
const http = require('http'); // 🔌 مكتبة الاتصال المباشر للـ WebSocket
const { Server } = require('socket.io'); // 🔌 استيراد Socket.IO

const buildAuthCoreRouter = require('./auth-core.cjs');
const buildAuthSocialRouter = require('./auth-social.cjs');
const buildStoreRouter = require('./store-routes.cjs');
const setupRealtime = require('./realtime-sync.cjs');

const app = express();
app.set('trust proxy', 1);

// 🔌 إعداد خادم الـ HTTP وربطه مع Express و Socket.IO لتزامن جزء من الثانية
const server = http.createServer(app);
const socketAllowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const io = new Server(server, {
  cors: { origin: socketAllowedOrigins, methods: ["GET", "POST", "PUT", "DELETE"] },
  transports: ['websocket', 'polling'], // إجبار الاتصال على أسرع وسيلة نقل
  pingTimeout: 60000,
  pingInterval: 25000
});

// حفظ الـ io في الـ app ليتم استخدامها داخل الـ Routes عند إضافة أو حذف قسم/منتج
app.set('io', io);

// ملاحظة: اتصالات Socket والصلاحيات (غرف staff/public) تُدار داخل realtime-sync.cjs

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').trim();

const APP_NAME = process.env.APP_NAME || 'متجر حمزة';
const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL || `${FRONTEND_URL || ''}/logo.png`;

app.use(helmet());
// صور المنتجات تُرسل مضغوطة داخل JSON بصيغة base64؛ نحتاج حداً أكبر من 1MB حتى لا يفشل نشر بطاقة مع صورة.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// نستخدم Brevo API عبر HTTPS عند توفر المفتاح؛ فهذا يتجنب حجب منافذ SMTP في Render.
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const MAIL_PROVIDER = BREVO_API_KEY ? 'brevo-api' : 'smtp';

// نقبل أسماء SMTP الرسمية والأسماء القديمة كخيار احتياطي.
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.BREVO_SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.BREVO_SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || SMTP_USER;
const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 2525);
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || SMTP_PORT === 465;
const smtpStatus = { configured: false, verified: false, provider: MAIL_PROVIDER, lastError: '' };

const missingEnvironment = [
  ['JWT_SECRET', JWT_SECRET],
  ['FRONTEND_URL', FRONTEND_URL],
  ['OWNER_EMAIL', OWNER_EMAIL],
  ...(BREVO_API_KEY ? [['SMTP_FROM', SMTP_FROM]] : []),
  ...(BREVO_API_KEY ? [] : [['SMTP_USER', SMTP_USER], ['SMTP_PASS', SMTP_PASS]]),
].filter(([, value]) => !value).map(([name]) => name);

if (missingEnvironment.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvironment.join(', ')}`);
  process.exit(1);
}
smtpStatus.configured = true;
console.log(BREVO_API_KEY
  ? `Mail config loaded: provider=brevo-api, from=${SMTP_FROM}`
  : `Mail config loaded: provider=smtp, host=${SMTP_HOST}, port=${SMTP_PORT}, secure=${SMTP_SECURE}, user=${String(SMTP_USER).slice(0, 3)}***, from=${SMTP_FROM}`);

const transporter = BREVO_API_KEY ? null : nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 10000,
  tls: { minVersion: 'TLSv1.2' }
});

if (transporter) {
  transporter.verify()
    .then(() => { smtpStatus.verified = true; console.log(`SMTP ready: ${SMTP_HOST}:${SMTP_PORT}`); })
    .catch((error) => { smtpStatus.lastError = error.message || String(error); console.error('SMTP verification failed:', smtpStatus.lastError); });
} else {
  smtpStatus.verified = true;
  console.log('Brevo API mail provider ready over HTTPS');
}

async function sendBrevoEmail(toEmail, subject, html, text) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { email: SMTP_FROM, name: APP_NAME },
      to: [{ email: String(toEmail).trim() }],
      replyTo: { email: SMTP_FROM, name: APP_NAME },
      subject: String(subject || 'رسالة من متجر حمزة').slice(0, 200),
      htmlContent: html,
      textContent: text
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Brevo API ${response.status}: ${details.slice(0, 300)}`);
  }
  return response.json();
}

async function sendStoreEmail(toEmail, subject, htmlContent) {
  if (!toEmail || !String(toEmail).includes('@')) {
    console.error('email skipped: invalid recipient');
    return false;
  }
  const originalHtml = String(htmlContent || '');
  const brandHeader = `<div style="max-width:720px;margin:0 auto 18px;padding:18px 22px;text-align:center;background:#080808;border-radius:16px;border:1px solid #b58b3d;"><img src="${BRAND_LOGO_URL}" alt="Hamza Store" style="display:block;width:190px;max-width:80%;height:auto;margin:0 auto 8px;object-fit:contain;"><div style="font-family:Arial,sans-serif;color:#f3d48a;font-size:12px;letter-spacing:2px;">HAMZA STORE</div></div>`;
  const html = `${brandHeader}${originalHtml}`;
  const text = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const maxAttempts = MAIL_PROVIDER === 'brevo-api' ? 2 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const info = BREVO_API_KEY
        ? await sendBrevoEmail(toEmail, subject, html, text)
        : await transporter.sendMail({
            from: `"متجر حمزة" <${SMTP_FROM}>`,
            to: String(toEmail).trim(),
            replyTo: SMTP_FROM,
            subject: String(subject || 'رسالة من متجر حمزة').slice(0, 200),
            html,
            text
          });
      console.log(`email sent via ${MAIL_PROVIDER} (attempt ${attempt}):`, info.messageId || info.messageId);
      return true;
    } catch (error) {
      console.error(`email error (attempt ${attempt}):`, error.message || error);
      smtpStatus.lastError = error.message || String(error);
      if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  return false;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, smtp: { configured: smtpStatus.configured, verified: smtpStatus.verified, lastError: smtpStatus.lastError || null } });
});

// Instagram Business Login: كلمة السر لا تمر عبر متجرنا، بل عبر صفحة Instagram الرسمية.
const INSTAGRAM_APP_ID = String(process.env.INSTAGRAM_APP_ID || '').trim();
const INSTAGRAM_APP_SECRET = String(process.env.INSTAGRAM_APP_SECRET || '').trim();
const INSTAGRAM_REDIRECT_URI = String(process.env.INSTAGRAM_REDIRECT_URI || `${FRONTEND_URL}/api/instagram/oauth/callback`).trim();
const instagramOAuthStates = new Map();
const instagramTokenFromRequest = (req) => {
  const header = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('ig_access_token='));
  return header ? decodeURIComponent(header.slice('ig_access_token='.length)) : '';
};

app.get('/api/instagram/oauth/start', (req, res) => {
  if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) return res.status(503).send('Instagram OAuth غير مفعّل بعد على الخادم.');
  const state = crypto.randomBytes(24).toString('hex');
  instagramOAuthStates.set(state, Date.now());
  const authorizeUrl = new URL('https://www.instagram.com/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', INSTAGRAM_APP_ID);
  authorizeUrl.searchParams.set('redirect_uri', INSTAGRAM_REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'instagram_business_basic');
  authorizeUrl.searchParams.set('state', state);
  res.redirect(authorizeUrl.toString());
});

app.get('/api/instagram/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const returnUrl = `${FRONTEND_URL}/?instagram=${error ? 'cancelled' : 'connected'}`;
  if (error || !code || !state || !instagramOAuthStates.has(String(state))) return res.redirect(`${FRONTEND_URL}/?instagram=error&reason=invalid_oauth_state`);
  instagramOAuthStates.delete(String(state));
  try {
    const form = new URLSearchParams({ client_id: INSTAGRAM_APP_ID, client_secret: INSTAGRAM_APP_SECRET, grant_type: 'authorization_code', redirect_uri: INSTAGRAM_REDIRECT_URI, code: String(code) });
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
    if (!tokenResponse.ok) throw new Error(`Instagram token exchange failed: ${tokenResponse.status}`);
    const tokenData = await tokenResponse.json();
    const longLivedUrl = new URL('https://graph.instagram.com/access_token');
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longLivedUrl.searchParams.set('client_secret', INSTAGRAM_APP_SECRET);
    longLivedUrl.searchParams.set('access_token', tokenData.access_token);
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = longLivedResponse.ok ? await longLivedResponse.json() : tokenData;
    const maxAge = Number(longLivedData.expires_in || 60 * 24 * 60 * 60);
    res.setHeader('Set-Cookie', `ig_access_token=${encodeURIComponent(longLivedData.access_token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    return res.redirect(returnUrl);
  } catch (oauthError) {
    console.error('Instagram OAuth callback failed:', oauthError.message || oauthError);
    return res.redirect(`${FRONTEND_URL}/?instagram=error`);
  }
});

app.get('/api/instagram/status', async (req, res) => {
  const token = instagramTokenFromRequest(req);
  if (!token) return res.json({ connected: false });
  try {
    const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username,account_type&access_token=${encodeURIComponent(token)}`);
    if (!profileResponse.ok) throw new Error('Instagram token is not valid');
    res.json({ connected: true, profile: await profileResponse.json() });
  } catch (statusError) {
    res.setHeader('Set-Cookie', 'ig_access_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
    res.json({ connected: false, error: statusError.message });
  }
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
if (FRONTEND_URL && !allowedOrigins.includes(FRONTEND_URL)) allowedOrigins.push(FRONTEND_URL);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked'));
    }
  },
  credentials: true
}));

const publicActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جداً، يرجى المحاولة بعد قليل.' }
});

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

mongoose.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

// ------------------------------------------------------------------
// نماذج قاعدة البيانات (Schemas & Models)
// ------------------------------------------------------------------
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'عام' },
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  image: { type: String },
  status: { type: String, default: 'منشور' },
  scheduledDate: { type: Date },
  unpublishDate: { type: Date },
  deliveryType: { type: String, enum: ['code', 'id_topup', 'subscription', 'store_credit'], default: 'code' },
  codes: [{ type: String }],
  stock: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 3 },
  maxStockThreshold: { type: Number, default: 50 },
  storeCreditAmount: { type: Number, default: 0, min: 0 },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  loyaltyPrice: { type: Number, default: 0, min: 0 },
  description: { type: String }
}, { strict: false, timestamps: true });
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, index: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerAddress: { type: String, required: true },
  items: [{ id: String, name: String, price: Number, quantity: Number, loyaltyPoints: Number, loyaltyOnly: Boolean, loyaltyPrice: Number, playerId: String, deliveredCodes: [String] }],
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'JOD' },
  paymentMethod: { type: String, default: '' },
  couponCode: { type: String, default: '' },
  couponDiscount: { type: Number, default: 0, min: 0 },
  walletAmount: { type: Number, default: 0 },
  loyaltyPointsEarned: { type: Number, default: 0 },
  loyaltyPointsRedeemed: { type: Number, default: 0 },
  loyaltyRewardItem: { type: String, default: '' },
  date: { type: Date, default: Date.now }
}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

const supportSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  phone: { type: String },
  location: { type: String },
  issue: { type: String, required: true },
  reply: { type: String, default: '' },
  status: { type: String, default: 'قيد المراجعة' },
  date: { type: Date, default: Date.now }
}, { strict: false });
const Support = mongoose.model('Support', supportSchema);

const mailSchema = new mongoose.Schema({
  title: String,
  message: String,
  date: { type: Date, default: Date.now }
}, { strict: false });
const Mail = mongoose.model('Mail', mailSchema);

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true });
const Category = mongoose.model('Category', categorySchema);

const NOTIFY_EMAILS = (process.env.NOTIFY_EMAILS || OWNER_EMAIL)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['low_stock', 'full_stock'], required: true },
  productId: { type: String },
  productName: { type: String },
  message: { type: String },
  read: { type: Boolean, default: false },
  date: { type: Date, default: Date.now }
});
const Notification = mongoose.model('Notification', notificationSchema);

const visitorEventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  path: { type: String, default: '/' },
  referrer: { type: String, default: '' },
  date: { type: Date, default: Date.now, index: true }
});
const VisitorEvent = mongoose.model('VisitorEvent', visitorEventSchema);

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  image: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  storeBalance: { type: Number, default: 0, min: 0 },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  loyaltyThreshold: { type: Number, default: 100, min: 1 }
}, { strict: false, timestamps: true });
const Customer = mongoose.model('Customer', customerSchema);

const storeCreditCardSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  status: { type: String, enum: ['issued', 'redeemed'], default: 'issued', index: true },
  orderId: { type: String, default: '' },
  customerEmail: { type: String, default: '' },
  redeemedAt: { type: Date }
}, { timestamps: true });
const StoreCreditCard = mongoose.model('StoreCreditCard', storeCreditCardSchema);

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, default: 'مفتوحة' },
  priority: { type: String, default: 'متوسطة' },
  department: { type: String, default: 'الدعم الفني' },
  assignedTo: { type: String, default: '' },
  date: { type: String }
}, { timestamps: true });
const Ticket = mongoose.model('Ticket', ticketSchema);

const saleSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  product: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
  date: { type: String }
}, { timestamps: true });
const Sale = mongoose.model('Sale', saleSchema);

const achievementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now }
}, { timestamps: true });
const Achievement = mongoose.model('Achievement', achievementSchema);

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  audience: { type: String, default: 'employees' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });
const Announcement = mongoose.model('Announcement', announcementSchema);

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, default: 'customer' },
  permissions: { type: [String], default: undefined },
  storeBalance: { type: Number, default: 0, min: 0 },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  loyaltyThreshold: { type: Number, default: 100, min: 1 },
  isOwner: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  twoFactorTempSecret: { type: String },
  googleId: { type: String },
  facebookId: { type: String },
  appleId: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  date: { type: Date, default: Date.now }
}, { strict: false });
const User = mongoose.model('User', userSchema);

const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'stock', 'sales', 'support'], default: 'stock' },
  permissions: { type: [String], default: undefined },
  salary: { type: Number, default: 0 },
  phone: { type: String, default: 'غير متوفر' },
  age: { type: String, default: 'غير متوفر' },
  nationalId: { type: String, default: 'غير متوفر' },
  idCardImage: { type: String, default: '' },
  bankAccount: { type: String, default: 'غير متوفر' },
  image: { type: String, default: '' },
  hireDate: { type: String },
  status: { type: String, default: 'نشط' },
  isActive: { type: Boolean, default: true },
  // 🆕 حقول الحضور والانصراف (تُستخدم من Attendance.js)
  attendanceStatus: { type: String, default: '' },
  lastCheckIn: { type: String, default: '' },
  lastCheckOut: { type: String, default: '' }
}, { timestamps: true, strict: false });
const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

// 🆕 موديل سجلات ساعات الدوام (مستخدم من WorkHours.js)
// ملاحظة: هذا الموديل كان يُستورد بملف store-routes.cjs (WorkHour) لكنه لم يكن
// مُعرّفاً هنا ولا يتم تمريره، فكانت كل الطلبات لـ /api/work-hours ترجع 500
// بسبب استدعاء .find() على متغيّر undefined.
const workHourSchema = new mongoose.Schema({
  name: { type: String, required: true },
  department: { type: String, required: true },
  date: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true }
}, { timestamps: true });
const WorkHour = mongoose.model('WorkHour', workHourSchema);

// 🆕 موديل سجل أحداث الحضور والانصراف (مستخدم من Attendance.js)
// نفس المشكلة: AttendanceLog كان undefined بملف store-routes.cjs
const attendanceLogSchema = new mongoose.Schema({
  log: { type: String, required: true }
}, { timestamps: true });
const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);

// 🆕 موديل تخزين عام key-value (يستخدمه أي Hook زي useSyncedState)
const appStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
}, { timestamps: true });
const AppState = mongoose.model('AppState', appStateSchema);

// 🆕 موديل الإعدادات العامة للمتجر (مستخدم من AppContext.js -> /api/settings)
// وثيقة واحدة فقط (Singleton) تُحفظ فيها كل إعدادات النظام العامة.
const settingsSchema = new mongoose.Schema({
  storeName: { type: String, default: 'متجر حمزة' },
  currency: { type: String, default: 'JOD' },
  maintenanceMode: { type: Boolean, default: false },
  contactEmail: { type: String, default: '' },
  contactPhone: { type: String, default: '' }
}, { strict: false, timestamps: true });
const Settings = mongoose.model('Settings', settingsSchema);

// 🆕 موديل الرواتب (مستخدم من AppContext.js -> /api/salaries)
const salarySchema = new mongoose.Schema({
  employeeId: { type: String },
  employeeName: { type: String, required: true },
  amount: { type: Number, required: true },
  base: { type: Number, default: 0 },
  deduction: { type: Number, default: 0 },
  deductionReason: { type: String, default: '' },
  bonus: { type: Number, default: 0 },
  bonusReason: { type: String, default: '' },
  netSalary: { type: Number, default: 0 },
  paid: { type: Boolean, default: false },
  lastPaidMonth: { type: String, default: '' },
  month: { type: String },
  status: { type: String, default: 'قيد الانتظار' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });
const Salary = mongoose.model('Salary', salarySchema);

// 🆕 موديل المهام الداخلية (مستخدم من AppContext.js -> /api/tasks)
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  assignedTo: { type: String, default: '' },
  status: { type: String, default: 'قيد التنفيذ' },
  dueDate: { type: String, default: '' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });
const Task = mongoose.model('Task', taskSchema);

// 🆕 موديل الوثائق/المستندات (مستخدم من AppContext.js -> /api/documents)
// تسميته DocumentModel لتجنّب التعارض مع كائن Document المدمج بلغة جافاسكريبت
const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  fileUrl: { type: String, default: '' },
  category: { type: String, default: 'عام' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });
const DocumentModel = mongoose.model('Document', documentSchema);

// 🆕 موديل الكوبونات (مستخدم من Coupons.js -> /api/coupons)
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  discount: { type: Number, required: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  audience: { type: String, default: 'customers' },
  minOrder: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  expiry: { type: Date, required: true },
  date: { type: String },
  usageCount: { type: Number, default: 0 },
  users: [{ type: String }],
  maxUsage: { type: Number, default: 1 }
}, { timestamps: true });
const Coupon = mongoose.model('Coupon', couponSchema);

const commissionSchema = new mongoose.Schema({
  id: { type: String, index: true },
  employee: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  notes: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  createdBy: { type: String, default: 'النظام' },
  lastModified: { type: Date }
}, { timestamps: true, strict: false });
const Commission = mongoose.model('Commission', commissionSchema);
const commissionLogSchema = new mongoose.Schema({ log: { type: String, required: true }, date: { type: Date, default: Date.now } }, { timestamps: true });
const CommissionLog = mongoose.model('CommissionLog', commissionLogSchema);

const checkOwnerAccess = (email) => {
  return OWNER_EMAIL && email && email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
};

const getUserFromAuthHeader = async (authHeader) => {
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose && decoded.purpose !== 'session') return null;
    const user = await User.findById(decoded.id);
    return user || null;
  } catch (err) {
    return null;
  }
};

const requireAuth = async (req, res, next) => {
  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'غير حاصل على تصريح، يرجى تسجيل الدخول.' });
  req.user = user;
  next();
};

const verifyOwnerMiddleware = async (req, res, next) => {
  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'غير حاصل على تصريح، يرجى تسجيل الدخول.' });
  if (!user.isOwner || !checkOwnerAccess(user.email)) {
    return res.status(403).json({ error: 'عذراً، هذه الصلاحية مخصصة للمالك فقط.' });
  }
  req.user = user;
  next();
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة جداً، يرجى المحاولة لاحقاً.' }
});

const twoFactorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات تحقق كثيرة جداً، يرجى المحاولة لاحقاً.' }
});

function issueSessionToken(user) {
  return jwt.sign({ id: user._id, purpose: 'session' }, JWT_SECRET, { expiresIn: '7d' });
}

function issueTwoFactorTempToken(user) {
  return jwt.sign({ id: user._id, purpose: '2fa_pending' }, JWT_SECRET, { expiresIn: '10m' });
}

function issueTokenAndRedirect(res, user) {
  const token = issueSessionToken(user);
  res.redirect(`${FRONTEND_URL}?authToken=${encodeURIComponent(token)}`);
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : undefined,
    storeBalance: Number(user.storeBalance || 0),
    loyaltyPoints: Number(user.loyaltyPoints || 0),
    loyaltyThreshold: Number(user.loyaltyThreshold || 100),
    isOwner: user.isOwner || checkOwnerAccess(user.email),
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled
  };
}

async function syncOwnerStatus(user) {
  if (checkOwnerAccess(user.email) && (!user.isOwner || user.role !== 'owner')) {
    user.isOwner = true;
    user.role = 'owner';
    if (!user.name || user.name === 'مستخدم' || user.name === 'مستخدم جديد') {
      user.name = 'حمزة (المالك)';
    }
    await user.save();
  }
  return user;
}

async function findOrCreateOAuthUser({ providerIdField, providerId, email, name }) {
  let user = await User.findOne({ [providerIdField]: providerId });
  if (user) {
    return syncOwnerStatus(user);
  }

  if (email) {
    user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user) {
      user[providerIdField] = providerId;
      user.emailVerified = true;
      await user.save();
      return syncOwnerStatus(user);
    }
  }

  const cleanEmail = email ? email.trim().toLowerCase() : `${providerId}_${providerIdField}@no-email.placeholder`;
  const isOwnerAccount = checkOwnerAccess(cleanEmail);
  const randomPassword = crypto.randomBytes(24).toString('hex');
  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  user = new User({
    name: name || (isOwnerAccount ? 'حمزة (المالك)' : 'مستخدم جديد'),
    email: cleanEmail,
    password: hashedPassword,
    role: isOwnerAccount ? 'owner' : 'customer',
    isOwner: isOwnerAccount,
    emailVerified: true,
    [providerIdField]: providerId
  });
  await user.save();
  return user;
}

const sharedAuthDeps = {
  User, bcrypt, jwt, crypto,
  JWT_SECRET, FRONTEND_URL, APP_NAME,
  sendStoreEmail, checkOwnerAccess,
  requireAuth, authLimiter, twoFactorLimiter,
  issueSessionToken, issueTwoFactorTempToken, issueTokenAndRedirect,
  publicUser, findOrCreateOAuthUser
};

app.use('/api/auth', buildAuthCoreRouter(sharedAuthDeps));
app.use('/api/auth', buildAuthSocialRouter(sharedAuthDeps));

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ success: false, user: null });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(200).json({ success: false, user: null });
    }

    res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    res.status(200).json({ success: false, user: null });
  }
});

// ------------------------------------------------------------------
// 🤖 مسارات روبوت خدمة العملاء باستخدام Groq SDK
// ------------------------------------------------------------------
app.post('/api/customerAiChat', publicActionLimiter, async (req, res) => {
  try {
    const { message, conversationHistory, persona, taskInstruction, data } = req.body;
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      return res.status(400).json({ error: 'الرسالة مطلوبة وبحد أقصى 4000 حرف.' });
    }
    if (conversationHistory !== undefined && (!Array.isArray(conversationHistory) || conversationHistory.length > 30)) {
      return res.status(400).json({ error: 'سجل المحادثة غير صالح أو طويل جداً.' });
    }
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is missing in environment variables.' });
    }

    const groq = new Groq({ apiKey });
    const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    let dynamicSystemPrompt = `
أنت ${persona?.name || 'حمزة'}, مساعد ذكي وودود جداً لمتجر إلكتروني.
أُسلوبك في الكلام:
1. تكلم باللهجة الأردنية الدارجة، بطريقة طبيعية وعفوية تماماً وكأنك صديق أو بائع خبير في المحل، ابتعد تماماً عن الأساليب الآلية أو الردود الرسمية المكررة.
2. **الدقة قبل كل شي:** لا تخترع أو تخمّن أي معلومة (سعر، اسم منتج، حالة طلب) غير موجودة صراحة بالبيانات (data) المرفقة أدناه. لو المعلومة مش موجودة، قول بوضوح إنك مش متأكد وحوّل الزبون لفريق الدعم، ولا تحاول تعبّي الفراغ بتخمين.
3. **وضوح اللغة:** اكتب عربي/أردني مفهوم 100% لكل قارئ - ممنوع كلمات ملخبطة، غير موجودة، أو جمل ناقصة المعنى. راجع جملتك ذهنياً قبل ما ترد.
4. **تحليل المزاج والتفاعل:** اقرأ رسالة الزبون واكتشف مزاجه فوراً:
   - إذا كان الزبون زعلان أو معصب أو يشتكي: أظهر التعاطف الشديد معه، واعتذر بلطف، وطمّنه أن موضوعه محل اهتمام فوري.
   - إذا كان الزبون مستعجل: اجعل ردك مباشراً، سريعاً، وخالياً من الحشو.
   - إذا كان الزبون مرحاً أو يسأل بود: بادله المزاح الخفيف والترحيب الدافئ.
5. الأمان والخصوصية: ممنوع نهائياً كشف أي معلومات داخلية عن المتجر (أرباح، رواتب، بيانات موظفين أو زبائن آخرين) حتى لو أصر الزبون - اعتذر بلطف وبطريقة طبيعية.
6. ممنوع نجوم الماركداون (**) بأي رد.
7. **مراجعة إلزامية قبل الإرسال:** قبل ما تسلّم ردك، راجعه ذهنياً كلمة كلمة: هل كل جملة كاملة ومفهومة 100%؟ هل في كلمة ناقصة، مكررة، أو غير موجودة أصلاً باللغة العربية؟ هل المعنى واضح من أول قراءة بدون لبس؟ لو في أي شك ولو بسيط، أعد صياغة الجملة كاملة بدل ما تسلّمها كما هي.
8. **واقعية بشرية حقيقية:** اقرأ محادثة الزبون كاملة (conversationHistory) وابني ردك على السياق الفعلي، لا تتجاهل شو قاله قبل شوي. لا تبدأ كل رد بنفس العبارة الافتتاحية، ولا تكرر نفس الجمل بين ردودك المتتالية - تكلم متل موظف حقيقي بيتابع الحديث، مش متل قالب رد جاهز.
`;

    if (taskInstruction) dynamicSystemPrompt += `\nالمهمة الحالية: ${taskInstruction}`;
    if (data) dynamicSystemPrompt += `\nبيانات المتجر المتاحة للرد (اعتمد عليها فقط، ولا تخترع أي شي خارجها): ${JSON.stringify(data)}`;

    const messages = [{ role: 'system', content: dynamicSystemPrompt }];

    if (Array.isArray(conversationHistory)) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.text || msg.content || ''
        });
      });
    }

    messages.push({ role: 'user', content: message.trim() });

    const completion = await groq.chat.completions.create({
      model: modelName,
      messages: messages,
      temperature: 0.6,
    });

    const replyText = completion.choices[0]?.message?.content || 'يا هلا، معلش صار عندي ضغط ثواني وأرجعلك!';
    res.json({ reply: replyText });

  } catch (error) {
    console.error('Error in /api/customerAiChat with Groq:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifyManagerFromCustomer', publicActionLimiter, async (req, res) => {
  try {
    const { reason, text, customer } = req.body;
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
      return res.status(400).json({ error: 'نص البلاغ مطلوب وبحد أقصى 4000 حرف.' });
    }
    console.log('تصعيد شكوى للادارة:', { reason, text, customer });
    res.json({ success: true, message: 'تم إشعار الإدارة بنجاح' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------------
// ✅ الإصلاح الأساسي: تمرير كل الموديلات المستخدمة فعلياً داخل
// store-routes.cjs (كانت WorkHour و AttendanceLog و AppState مفقودة
// بالكامل من هذا الاستدعاء، وأيضاً io لم تكن ممرَّرة، فكانت كل عمليات
// البث اللحظي Socket.IO تتوقف بصمت بسبب شرط `if (!io) return;`).
// كذلك تمت إضافة Settings/Salary/Task/DocumentModel/Coupon لتغطية
// الـ endpoints التي يطلبها الفرونت إند (AppContext.js وCoupons.js)
// ولم تكن مُعرّفة أصلاً في السيرفر (سبب أخطاء 404).
// ------------------------------------------------------------------
// 🔌 المزامنة اللحظية الشاملة (Change Streams + قواعد الربط + مصادقة الـ socket)
setupRealtime({
  io, mongoose, jwt, jwtSecret: JWT_SECRET,
  models: {
    Product, Order, Support, Mail, Notification, VisitorEvent, Customer, Transaction, Ticket, Sale,
    Employee, Achievement, Announcement, WorkHour, AttendanceLog, AppState, Settings, Salary, Task,
    DocumentModel, Coupon, Commission, CommissionLog, StoreCreditCard, User // User للمصادقة فقط، غير مراقب
  }
});

// ملفات المستندات المرفوعة
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api', buildStoreRouter({
  Product, Order, Support, Mail, Category, NOTIFY_EMAILS, Notification, VisitorEvent,
  Customer, Transaction, Ticket, Sale, Employee, Achievement, Announcement,
  WorkHour, AttendanceLog, AppState,
  Settings, Salary, Task, DocumentModel, Coupon, Commission, CommissionLog, StoreCreditCard,
  mongoose, sendStoreEmail, verifyOwnerMiddleware, bcrypt, crypto,
  io, User, getUserFromAuthHeader, publicActionLimiter
}));

const fs = require('fs');
const distIndex = path.join(__dirname, 'dist', 'index.html');

if (fs.existsSync(distIndex)) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(distIndex));
} else {
  app.get('/', (req, res) => res.json({ status: 'ok', service: 'Hamza Store API' }));
}

// 🛡️ معالج أخطاء عام: يسجّل سبب الخطأ باللوج بدل صفحة بيضاء فاضية
app.use((err, req, res, next) => {
  console.error('❌ SERVER ERROR:', req.method, req.originalUrl, err && (err.stack || err.message || err));
  if (res.headersSent) return next(err);
  if (req.originalUrl.startsWith('/api/auth/') && req.method === 'GET' && req.originalUrl.includes('/callback')) {
    return res.redirect(`${FRONTEND_URL}?authError=server`);
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// تقارير تشغيلية آلية ثلاث مرات يومياً: 09:00، 17:00، 23:00 بتوقيت عمّان.
// يمكن تخصيصها عبر DAILY_REPORT_TIMES=09:00,17:00,23:00.
const DAILY_REPORT_TIMES = String(process.env.DAILY_REPORT_TIMES || '09:00,17:00,23:00').split(',').map((value) => value.trim()).filter(Boolean);
const DAILY_REPORT_TZ = process.env.DAILY_REPORT_TZ || 'Asia/Amman';
let lastDailyReportAttempt = '';
const dailyReportSchedule = DAILY_REPORT_TIMES
  .map((time) => {
    const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, minutes: hour * 60 + minute };
  })
  .filter(Boolean)
  .sort((a, b) => a.minutes - b.minutes);
const jordanDateParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: DAILY_REPORT_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
};
const sendDailyReport = async () => {
  try {
    if (!Array.isArray(NOTIFY_EMAILS) || NOTIFY_EMAILS.length === 0) return;
    const now = jordanDateParts();
    const today = `${now.year}-${now.month}-${now.day}`;
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
    // Render قد يوقظ الخدمة بعد الموعد؛ نلتقط آخر تقرير مستحق بدل تفويت اليوم بالكامل.
    const dueReport = dailyReportSchedule.filter((item) => item.minutes <= currentMinutes).at(-1);
    if (!dueReport) return;
    const reportTime = dueReport.time;
    const reportKey = `${today}_${reportTime}`;
    if (lastDailyReportAttempt === reportKey) return;
    lastDailyReportAttempt = reportKey;
    const start = new Date(`${today}T00:00:00+03:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const [orders, transactions, hours, salaries, products, visitors] = await Promise.all([
      Order.find({ date: { $gte: start, $lt: end } }).lean(),
      Transaction.find({ date: { $gte: start, $lt: end } }).lean(),
      WorkHour.find({ createdAt: { $gte: start, $lt: end } }).lean(),
      Salary.find({ date: { $gte: start, $lt: end } }).lean(),
      Product.find().lean(),
      VisitorEvent ? VisitorEvent.find({ date: { $gte: start, $lt: end } }).lean() : []
    ]);
    const alreadySent = await AppState.findOne({ key: `daily_report_sent_${reportKey}` }).lean();
    if (alreadySent) return;
    const validOrders = orders.filter((order) => order.status !== 'ملغي');
    const revenue = validOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const inventoryQty = products.reduce((sum, product) => sum + (product.deliveryType === 'store_credit' ? 0 : Array.isArray(product.codes) ? product.codes.length : Number(product.stock || 0)), 0);
    const lowStock = products.filter((product) => product.deliveryType !== 'store_credit' && (Array.isArray(product.codes) ? product.codes.length : Number(product.stock || 0)) <= Number(product.lowStockThreshold ?? 3));
    const outOfStock = products.filter((product) => product.deliveryType !== 'store_credit' && (Array.isArray(product.codes) ? product.codes.length : Number(product.stock || 0)) <= 0);
    const uniqueVisitors = new Set(visitors.map((visitor) => visitor.sessionId).filter(Boolean)).size;
    const hoursTotal = hours.reduce((sum, h) => {
      const parse = (v) => { const m = String(v || '').match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) + Number(m[2]) / 60 : 0; };
      const value = Math.max(0, parse(h.end) - parse(h.start));
      return sum + value;
    }, 0);
    const reportLabel = reportTime === '09:00' ? 'الصباحي' : reportTime === '17:00' ? 'العصري' : 'الليلي';
    const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const orderRows = validOrders.slice(0, 30).map((o) => `<tr><td>${escapeHtml(o.orderNumber || o._id)}</td><td>${escapeHtml(o.customerName || '')}</td><td>${Number(o.totalAmount || 0).toFixed(2)} JOD</td></tr>`).join('');
    const reportHtml = `<div dir="rtl" style="margin:0;background:#07111f;padding:24px 10px;font-family:Arial,Tahoma,sans-serif;color:#e5e7eb"><div style="max-width:820px;margin:auto;background:linear-gradient(145deg,#111c32,#0b1220);border:1px solid #334155;border-radius:24px;overflow:hidden"><div style="padding:30px;background:linear-gradient(135deg,#0ea5e9,#2563eb 55%,#7c3aed);color:#fff"><div style="font-size:13px;opacity:.85">HAMZA STORE · لوحة الإدارة</div><h1 style="margin:9px 0 0;font-size:27px">التقرير ${reportLabel} الشامل</h1><p style="margin:8px 0 0;opacity:.9">${today} · ${reportTime} · ${DAILY_REPORT_TZ}</p></div><div style="padding:28px"><div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 22px"><div style="flex:1;min-width:135px;background:#172554;border-radius:14px;padding:15px;color:#bfdbfe">👁️ الزوار<br><b style="font-size:24px;color:#fff">${uniqueVisitors}</b></div><div style="flex:1;min-width:135px;background:#172554;border-radius:14px;padding:15px;color:#bfdbfe">📦 المبيعات<br><b style="font-size:22px;color:#fff">${validOrders.length}</b></div><div style="flex:1;min-width:135px;background:#064e3b;border-radius:14px;padding:15px;color:#a7f3d0">💰 الإيرادات<br><b style="font-size:22px;color:#fff">${revenue.toFixed(2)} JOD</b></div><div style="flex:1;min-width:135px;background:#7f1d1d;border-radius:14px;padding:15px;color:#fecaca">📉 الخسائر<br><b style="font-size:22px;color:#fff">${expenses.toFixed(2)} JOD</b></div><div style="flex:1;min-width:135px;background:#3b1f5c;border-radius:14px;padding:15px;color:#e9d5ff">📈 الأرباح<br><b style="font-size:22px;color:#fff">${(income - expenses).toFixed(2)} JOD</b></div></div><div style="background:#0f1b30;border:1px solid #334155;border-radius:16px;padding:18px;line-height:2"><b style="color:#67e8f9">المخزون وحالة التشغيل</b><br>إجمالي كمية المخزون: <b>${inventoryQty}</b><br>منتجات منخفضة المخزون: <b style="color:#fbbf24">${lowStock.length}</b><br>منتجات نافدة: <b style="color:#f87171">${outOfStock.length}</b><br>عدد المنتجات: <b>${products.length}</b><br>ساعات العمل: <b>${hoursTotal.toFixed(2)} ساعة</b><br>سجلات الرواتب: <b>${salaries.length}</b></div><h2 style="color:#fbbf24;font-size:19px;margin-top:28px">آخر الطلبات</h2><table style="width:100%;border-collapse:collapse;background:#f8fafc;color:#172033;border-radius:14px;overflow:hidden"><thead><tr style="background:#dbeafe"><th style="padding:12px;text-align:right">رقم الطلب</th><th style="padding:12px;text-align:right">العميل</th><th style="padding:12px;text-align:left">الإجمالي</th></tr></thead><tbody>${orderRows || '<tr><td colspan="3" style="padding:15px;text-align:center">لا توجد طلبات في هذا التقرير</td></tr>'}</tbody></table><p style="color:#94a3b8;font-size:12px;line-height:1.8;margin-top:24px">تم إنشاء هذا التقرير تلقائياً ثلاث مرات يومياً، وهو تراكمي لليوم الحالي حتى وقت الإرسال.</p><div style="border-top:1px solid #334155;margin-top:22px;padding-top:16px;text-align:center;color:#94a3b8;font-size:12px">متجر حمزة · تقرير سري للإدارة</div></div></div></div>`;
    const results = await Promise.all(NOTIFY_EMAILS.map((email) => sendStoreEmail(email, `التقرير ${reportLabel} ${today} - متجر حمزة`, reportHtml)));
    if (results.every(Boolean)) {
      await AppState.create({ key: `daily_report_sent_${reportKey}`, value: { sentAt: new Date(), recipients: NOTIFY_EMAILS, reportTime } });
      console.info(`[daily-report] sent successfully: ${reportKey}; recipients=${NOTIFY_EMAILS.length}`);
    } else {
      console.error(`[daily-report] delivery failed: ${reportKey}; recipients=${NOTIFY_EMAILS.length}`);
    }
  } catch (error) {
    console.error('[daily-report] error:', error);
    lastDailyReportAttempt = '';
  }
};
console.info(`[daily-report] schedule active: ${DAILY_REPORT_TIMES.join(', ')} ${DAILY_REPORT_TZ}`);
setInterval(sendDailyReport, 60 * 1000);
sendDailyReport();

// جدولة نشر المنتجات وإلغاء نشرها تلقائياً حتى بعد إعادة تشغيل الخادم.
const runProductScheduler = async () => {
  try {
    const now = new Date();
    await Product.updateMany(
      { status: 'غير منشور', scheduledDate: { $lte: now }, $or: [{ unpublishDate: { $exists: false } }, { unpublishDate: null }, { unpublishDate: { $gt: now } }] },
      { $set: { status: 'منشور' } }
    );
    await Product.updateMany(
      { status: 'منشور', unpublishDate: { $ne: null, $lte: now } },
      { $set: { status: 'غير منشور' } }
    );
  } catch (error) {
    console.error('product scheduler error:', error.message);
  }
};
setInterval(runProductScheduler, 30 * 1000);
runProductScheduler();

const PORT = process.env.PORT || 4000;
// استبدال app.listen بـ server.listen لتفعيل نظام Socket.IO
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running with Live Sync on port ${PORT}`);
});
