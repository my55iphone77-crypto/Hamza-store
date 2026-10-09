require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
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
const SHOP2TOPUP_WEBHOOK_SECRET = String(process.env.SHOP2TOPUP_WEBHOOK_SECRET || '').trim();

app.use(helmet());
// صور المنتجات تُرسل مضغوطة داخل JSON بصيغة base64؛ نحتاج حداً أكبر من 1MB حتى لا يفشل نشر بطاقة مع صورة.
app.use(express.json({
  limit: '8mb',
  verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); }
}));
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
  // بعض تطبيقات البريد تحذف وسم style؛ نعالج القياسات الحرجة داخل العناصر نفسها أيضاً.
  const mobileSafeHtml = originalHtml
    .replace(/max-width\s*:\s*\d+px/gi, 'max-width:100%')
    .replace(/min-width\s*:\s*[^;"']+;?/gi, 'min-width:0;')
    .replace(/white-space\s*:\s*nowrap\s*;?/gi, 'white-space:normal;overflow-wrap:anywhere;')
    .replace(/<table(\s[^>]*)?>/gi, (tag) => {
      if (/style\s*=\s*['"]/i.test(tag)) return tag.replace(/style\s*=\s*(['"])(.*?)\1/i, (_, quote, style) => `style=${quote}${style};width:100%;max-width:100%;table-layout:fixed;overflow-wrap:anywhere;${quote}`);
      return tag.replace(/>$/, ' style="width:100%;max-width:100%;table-layout:fixed;overflow-wrap:anywhere;">');
    })
    .replace(/<img(\s[^>]*)?>/gi, (tag) => {
      if (/style\s*=\s*['"]/i.test(tag)) return tag.replace(/style\s*=\s*(['"])(.*?)\1/i, (_, quote, style) => `style=${quote}${style};max-width:100%;height:auto;${quote}`);
      return tag.replace(/>$/, ' style="max-width:100%;height:auto;">');
    });
  const responsiveEmailStyles = `<meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    * { box-sizing: border-box; }
    html, body { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
    body { min-height: 100vh !important; overflow-x: hidden !important; -webkit-text-size-adjust: 100%; }
    table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
    img { max-width: 100% !important; height: auto !important; }
    td, th, p, div, span, a, b, strong { max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
    th, td { white-space: normal !important; }
    h1, h2, h3 { font-family: Arial,Tahoma,sans-serif; letter-spacing: -.2px; }
    a { box-shadow: 0 8px 20px rgba(14,165,233,.18); }
    [style*="min-width"] { min-width: 0 !important; }
    [style*="white-space:nowrap"], [style*="white-space: nowrap"] { white-space: normal !important; }
    @media only screen and (max-width: 600px) {
      body { padding: 0 !important; }
      body > div, body > table { width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; border-radius: 0 !important; }
      div[style*="max-width"], table[style*="max-width"] { max-width: 100% !important; }
      div[style*="padding:30px"], div[style*="padding: 30px"] { padding: 20px 14px !important; }
      div[style*="padding:28px"], div[style*="padding: 28px"] { padding: 20px 14px !important; }
      div[style*="padding:32px"], div[style*="padding: 32px"] { padding: 22px 14px !important; }
      th, td { padding: 8px 6px !important; font-size: 12px !important; }
      h1 { font-size: 22px !important; line-height: 1.35 !important; }
      h2 { font-size: 18px !important; }
      h3 { font-size: 16px !important; }
      a { max-width: 100% !important; }
    }
  </style>`;
  const brandHeader = `<div style="max-width:100%;width:100%;min-height:132px;margin:0 auto 20px;padding:22px 24px 20px;text-align:center;background:linear-gradient(135deg,#050b18 0%,#111c32 52%,#1e1b4b 100%);border-radius:24px;border:1px solid rgba(56,189,248,.58);box-shadow:0 18px 42px rgba(2,6,23,.42),inset 0 1px 0 rgba(255,255,255,.16);overflow:hidden;"><div style="height:3px;width:100%;max-width:260px;margin:0 auto 14px;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#38bdf8,#a78bfa);"></div><div style="display:inline-block;max-width:100%;margin:0 auto 12px;padding:5px 12px;border:1px solid rgba(251,191,36,.35);border-radius:999px;color:#fde68a;font:700 10px Arial,Tahoma,sans-serif;letter-spacing:1.5px;">DIGITAL STORE · متجر رقمي</div><img src="${BRAND_LOGO_URL}" alt="Hamza Store" style="display:block;width:190px;max-width:80%;height:auto;margin:0 auto 9px;object-fit:contain;"><div style="font-family:Arial,sans-serif;color:#f8d477;font-size:12px;font-weight:bold;letter-spacing:3px;overflow-wrap:anywhere;">HAMZA STORE · متجر حمزة</div></div>`;
  const contentFrame = `<div style="width:100%;max-width:100%;background:linear-gradient(145deg,rgba(17,28,50,.96),rgba(7,17,31,.96));border:1px solid rgba(148,163,184,.24);border-radius:24px;box-shadow:0 20px 48px rgba(2,6,23,.38),inset 0 1px 0 rgba(255,255,255,.1);overflow:hidden;"><div style="height:3px;width:100%;background:linear-gradient(90deg,#38bdf8,#818cf8,#fbbf24);"></div><div style="width:100%;max-width:100%;">${mobileSafeHtml}</div></div>`;
  const brandFooter = `<div style="max-width:100%;width:100%;margin:20px auto 0;padding:18px 16px;text-align:center;border-top:1px solid rgba(148,163,184,.22);color:#94a3b8;font:12px/1.8 Arial,Tahoma,sans-serif;overflow-wrap:anywhere;"><strong style="display:block;color:#cbd5e1;font-size:13px;margin-bottom:4px;">شكراً لثقتك بمتجر حمزة</strong><span>بطاقات رقمية · تسليم سريع · نقاط ولاء ومزايا مستمرة</span><br><span style="color:#64748b;">هذه رسالة آلية، يرجى عدم الرد عليها مباشرة.</span></div>`;
  const html = `${responsiveEmailStyles}<div dir="rtl" style="width:100%;max-width:100%;min-height:100vh;margin:0;padding:18px 12px 28px;overflow-x:hidden;box-sizing:border-box;background:radial-gradient(circle at 10% 0%,#172554 0,#07111f 38%,#020617 100%);">${brandHeader}${contentFrame}${brandFooter}</div>`;
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
const instagramStoredToken = async (req) => {
  if (process.env.INSTAGRAM_ACCESS_TOKEN) return String(process.env.INSTAGRAM_ACCESS_TOKEN).trim();
  const connection = await AppState.findOne({ key: 'instagram_business_connection' }).lean();
  return connection?.value?.accessToken || '';
};
const requireInstagramOwner = async (req, res, next) => {
  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'يرجى تسجيل الدخول بحساب المالك أولاً.' });
  if (!user.isOwner || !checkOwnerAccess(user.email)) return res.status(403).json({ error: 'ربط Instagram مخصص لمالك المتجر فقط.' });
  req.user = user;
  next();
};
const instagramProxyUrl = (url) => url ? `/api/instagram/media-file?url=${encodeURIComponent(url)}` : '';

app.get('/api/instagram/oauth/start', requireInstagramOwner, (req, res) => {
  if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) return res.status(503).send('Instagram OAuth غير مفعّل بعد على الخادم.');
  const state = crypto.randomBytes(24).toString('hex');
  instagramOAuthStates.set(state, { createdAt: Date.now(), ownerId: String(req.user._id) });
  const authorizeUrl = new URL('https://www.instagram.com/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', INSTAGRAM_APP_ID);
  authorizeUrl.searchParams.set('redirect_uri', INSTAGRAM_REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'instagram_business_basic');
  authorizeUrl.searchParams.set('state', state);
  res.setHeader('Set-Cookie', `ig_oauth_state=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`);
  if (String(req.headers.accept || '').includes('application/json')) return res.json({ url: authorizeUrl.toString() });
  res.redirect(authorizeUrl.toString());
});

app.get('/api/instagram/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const returnUrl = `${FRONTEND_URL}/?instagram=${error ? 'cancelled' : 'connected'}`;
  if (error) return res.status(400).send(`<h2>Instagram login cancelled</h2><p>${String(req.query.error_description || error)}</p><p>Close this page and try again.</p>`);
  if (!code || !state || !instagramOAuthStates.has(String(state))) return res.status(400).send('<h2>Instagram login could not be verified</h2><p>The OAuth state was missing or expired. Start the connection again from the owner dashboard.</p>');
  const stateData = instagramOAuthStates.get(String(state));
  instagramOAuthStates.delete(String(state));
  try {
    const form = new URLSearchParams({ client_id: INSTAGRAM_APP_ID, client_secret: INSTAGRAM_APP_SECRET, grant_type: 'authorization_code', redirect_uri: INSTAGRAM_REDIRECT_URI, code: String(code) });
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
    if (!tokenResponse.ok) throw new Error(`Instagram token exchange failed: ${tokenResponse.status}`);
    const rawTokenData = await tokenResponse.json();
    const tokenData = Array.isArray(rawTokenData.data) ? rawTokenData.data[0] : rawTokenData;
    if (!tokenData?.access_token) throw new Error(`Instagram did not return an access token: ${JSON.stringify(rawTokenData).slice(0, 300)}`);
    const longLivedUrl = new URL('https://graph.instagram.com/access_token');
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longLivedUrl.searchParams.set('client_secret', INSTAGRAM_APP_SECRET);
    longLivedUrl.searchParams.set('access_token', tokenData.access_token);
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = longLivedResponse.ok ? await longLivedResponse.json() : tokenData;
    const maxAge = Number(longLivedData.expires_in || 60 * 24 * 60 * 60);
    await AppState.findOneAndUpdate(
      { key: 'instagram_business_connection' },
      { key: 'instagram_business_connection', value: { accessToken: longLivedData.access_token, connectedAt: new Date(), ownerId: stateData?.ownerId || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(200).send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تم ربط Instagram</title><body style="font-family:Arial;background:#07111f;color:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:560px;padding:32px;border:1px solid #334155;border-radius:20px;background:#111c32;text-align:center"><h2 style="color:#34d399">تم ربط حساب Instagram بنجاح</h2><p>تم حفظ التصريح بأمان على الخادم. اضغط الزر للعودة إلى المتجر.</p><a href="' + returnUrl + '" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none">العودة إلى المتجر</a></main></body></html>');
  } catch (oauthError) {
    console.error('Instagram OAuth callback failed:', oauthError.message || oauthError);
    return res.status(502).send(`<h2>Instagram login failed</h2><p>${String(oauthError.message || oauthError).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}</p><p>Check the Instagram App Secret and the exact OAuth Redirect URI in Meta, then try again.</p>`);
  }
});

app.get('/api/instagram/status', async (req, res) => {
  const token = await instagramStoredToken(req);
  if (!token) return res.json({ connected: false });
  try {
    const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username,account_type,name,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`);
    if (!profileResponse.ok) throw new Error('Instagram token is not valid');
    const profile = await profileResponse.json();
    res.json({ connected: true, profile: { ...profile, profile_picture_url_original: profile.profile_picture_url, profile_picture_url: instagramProxyUrl(profile.profile_picture_url) } });
  } catch (statusError) {
    res.setHeader('Set-Cookie', 'ig_access_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
    res.json({ connected: false, error: statusError.message });
  }
});

app.get('/api/instagram/media', async (req, res) => {
  const token = await instagramStoredToken(req);
  if (!token) return res.status(401).json({ connected: false, media: [] });
  try {
    const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username,account_type,name,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`);
    if (!profileResponse.ok) throw new Error('Instagram profile request failed');
    const rawProfile = await profileResponse.json();
    const profile = { ...rawProfile, profile_picture_url_original: rawProfile.profile_picture_url, profile_picture_url: instagramProxyUrl(rawProfile.profile_picture_url) };
    const mediaUrl = new URL(`https://graph.instagram.com/${profile.id}/media`);
    mediaUrl.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
    mediaUrl.searchParams.set('limit', '6');
    mediaUrl.searchParams.set('access_token', token);
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) throw new Error('Instagram media request failed');
    const mediaData = await mediaResponse.json();
    const media = Array.isArray(mediaData.data) ? mediaData.data.map((item) => ({ ...item, playable_url: instagramProxyUrl(item.media_url), playable_thumbnail_url: instagramProxyUrl(item.thumbnail_url) })) : [];
    res.json({ connected: true, profile, media });
  } catch (mediaError) {
    res.status(502).json({ connected: false, media: [], error: mediaError.message || 'Instagram media unavailable' });
  }
});

app.get('/api/instagram/media-file', async (req, res) => {
  const token = await instagramStoredToken(req);
  const mediaUrl = String(req.query.url || '');
  if (!token || !mediaUrl) return res.status(401).end();
  try {
    const parsedUrl = new URL(mediaUrl);
    const allowedHost = parsedUrl.hostname === 'graph.instagram.com' || parsedUrl.hostname.endsWith('.cdninstagram.com') || parsedUrl.hostname.endsWith('.fbcdn.net') || parsedUrl.hostname === 'fbsbx.com' || parsedUrl.hostname.endsWith('.fbsbx.com');
    if (!allowedHost) return res.status(400).send('Invalid Instagram media URL');
    // روابط صور Meta/CDN تكون موقعة مسبقاً؛ إضافة access_token إليها تكسر التوقيع.
    if (parsedUrl.hostname === 'graph.instagram.com') parsedUrl.searchParams.set('access_token', token);
    const mediaResponse = await fetch(parsedUrl, { headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*;q=0.8,*/*;q=0.5', 'User-Agent': 'Hamza-Store Instagram Media Proxy' } });
    if (!mediaResponse.ok) return res.status(mediaResponse.status).end();
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Type', mediaResponse.headers.get('content-type') || 'application/octet-stream');
    res.send(Buffer.from(await mediaResponse.arrayBuffer()));
  } catch (mediaError) {
    res.status(502).send(mediaError.message || 'Instagram media unavailable');
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
  deliveryType: { type: String, enum: ['code', 'id_topup', 'subscription', 'store_credit', 'game'], default: 'code' },
  gameUrl: { type: String, default: '' },
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
  provider: { type: String, default: '' },
  providerOrderId: { type: String, default: '', index: true },
  providerStatus: { type: String, default: '' },
  providerLastEventId: { type: String, default: '' },
  providerUpdatedAt: { type: Date },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerAddress: { type: String, required: true },
  items: [{ id: String, name: String, price: Number, quantity: Number, loyaltyPoints: Number, loyaltyOnly: Boolean, loyaltyPrice: Number, playerId: String, deliveredCodes: [String] }],
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'JOD' },
  paymentMethod: { type: String, default: '' },
  paymentMode: { type: String, enum: ['live', 'sandbox', 'balance', ''], default: '' },
  paymentStatus: { type: String, default: 'pending' },
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
  ownedGames: { type: [String], default: [] },
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
    ownedGames: Array.isArray(user.ownedGames) ? [...new Set(user.ownedGames.map((id) => String(id)).filter(Boolean))] : [],
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

app.get('/api/customerAiMetrics', verifyOwnerMiddleware, async (req, res) => {
  try {
    const [metrics, context] = await Promise.all([
      AppState.findOne({ key: 'customer_bot_metrics' }).lean(),
      buildPublicBotContext()
    ]);
    res.json({ requests: Number(metrics?.value || 0), contextUpdatedAt: context.generatedAt, counters: context.counters, publicFeatures: context.publicFeatures });
  } catch (error) {
    res.status(503).json({ error: 'تعذر تحميل عدادات البوت حالياً.' });
  }
});

// ------------------------------------------------------------------
// 🤖 مسارات روبوت خدمة العملاء باستخدام Groq SDK
// ------------------------------------------------------------------
const buildPublicBotContext = async (req = null) => {
  const [products, settings, featureNotes, categories, announcements] = await Promise.all([
    Product.find({ status: { $nin: ['inactive', 'غير نشط', 'deleted'] } }).select('name price discountPrice description category deliveryType stock codes loyaltyPoints loyaltyPrice storeCreditAmount').lean(),
    Settings.findOne().lean(),
    AppState.findOne({ key: 'store_feature_manifest' }).lean(),
    Category.find().select('name description image').sort({ name: 1 }).lean(),
    Announcement.find({ audience: { $in: ['customers', 'customer', 'public', 'all', 'everyone', 'العملاء', 'الزبائن'] } }).select('title message audience date createdAt').sort({ createdAt: -1, date: -1 }).limit(30).lean()
  ]);
  const catalog = products.map((product) => {
    const stock = product.deliveryType === 'store_credit' ? 'متوفر تلقائياً' : (Array.isArray(product.codes) ? product.codes.length : Number(product.stock || 0));
    return { name: String(product.name || ''), price: product.discountPrice ?? product.price ?? null, description: String(product.description || '').slice(0, 500), category: String(product.category || ''), deliveryType: String(product.deliveryType || ''), stock, pointsEarned: Number(product.loyaltyPoints || 0), pointsPrice: Number(product.loyaltyPrice || 0), storeCreditAmount: Number(product.storeCreditAmount || 0) };
  });
  const user = req?.headers?.authorization ? await getUserFromAuthHeader(req.headers.authorization).catch(() => null) : null;
  const pointsProducts = catalog.filter((item) => item.pointsEarned > 0 || item.pointsPrice > 0);
  const storeCreditProducts = catalog.filter((item) => item.deliveryType === 'store_credit' || item.storeCreditAmount > 0);
  const sensitiveKey = /(password|secret|token|api|key|oauth|jwt|smtp|bank|account|credential|hash|private|access)/i;
  const publicSettingKey = /^(store|currency|contact|phone|email|website|tagline|welcome|hero|footer|social|language|theme|payment|shipping|delivery|working|hours|return|refund|faq|support|announcement|maintenanceMessage)/i;
  const cleanPublicValue = (value, depth = 0) => {
    if (depth > 3 || value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.slice(0, 30).map((item) => cleanPublicValue(item, depth + 1));
    if (typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 1000) : value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKey.test(key) && !['_id', '__v', 'createdAt', 'updatedAt'].includes(key)).slice(0, 50).map(([key, item]) => [key, cleanPublicValue(item, depth + 1)]));
  };
  const publicSettings = Object.fromEntries(Object.entries(settings || {}).filter(([key, value]) => publicSettingKey.test(key) && !sensitiveKey.test(key) && value !== undefined && value !== null && value !== '').map(([key, value]) => [key, cleanPublicValue(value)]));
  const publicAnnouncements = announcements.map((item) => ({ title: String(item.title || ''), message: String(item.message || ''), date: item.date || item.createdAt || null })).filter((item) => item.title || item.message);
  const storeProfile = 'متجر حمزة متجر ألعاب رقمي شامل لكل ما يخص الألعاب والبطاقات. يبيع بطاقات الألعاب والشحن، بطاقات رصيد المتجر، الاشتراكات، الشحن الفوري، وكل المنتجات والخدمات الرقمية المتعلقة بالألعاب حسب الكتالوج الحالي. بطاقات رصيد المتجر فئة من فئات المتجر وليست تخصص المتجر الوحيد.';
  let developmentUpdates = { generatedAt: null, updates: [] };
  try {
    developmentUpdates = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'bot-updates.json'), 'utf8'));
  } catch (_) {}
  return {
    generatedAt: new Date().toISOString(),
    storeProfile,
    catalog,
    storeInfo: Object.fromEntries(['storeName', 'storeTagline', 'welcomeText', 'contactEmail', 'contactPhone', 'footerText'].filter((key) => settings?.[key]).map((key) => [key, settings[key]])),
    publicStore: {
      settings: publicSettings,
      categories: categories.map((item) => ({ name: String(item.name || ''), description: String(item.description || ''), image: String(item.image || '') })).filter((item) => item.name),
      announcements: publicAnnouncements,
      socialCards: Array.isArray(settings?.socialCards) ? settings.socialCards.filter((card) => card?.enabled !== false).map((card) => ({ platform: card.platform || '', account: card.account || '', title: card.title || '' })) : []
    },
    publicFeatures: featureNotes?.value?.public || [],
    loyaltyProgram: {
      active: pointsProducts.length > 0,
      earning: pointsProducts.filter((item) => item.pointsEarned > 0).map(({ name, pointsEarned }) => ({ name, pointsEarned })),
      redemption: pointsProducts.filter((item) => item.pointsPrice > 0).map(({ name, pointsPrice }) => ({ name, pointsPrice })),
      rewardThreshold: Number(user?.loyaltyThreshold || 100),
      note: 'النقاط تُستخدم داخل المتجر فقط، والمنتجات المتاحة بالنقاط تظهر بسعر النقاط على بطاقة المنتج.'
    },
    storeBalanceProgram: {
      active: storeCreditProducts.length > 0,
      products: storeCreditProducts.map(({ name, price, storeCreditAmount }) => ({ name, price, amount: storeCreditAmount || price })),
      note: 'بطاقة رصيد المتجر تُصدر كوداً تلقائياً بعد الشراء، وبعد استبدال الكود ينضاف الرصيد للحساب ويُستخدم للشراء داخل المتجر فقط وغير قابل للسحب.'
    },
    account: user ? { loyaltyPoints: Number(user.loyaltyPoints || 0), loyaltyThreshold: Number(user.loyaltyThreshold || 100), storeBalance: Number(user.storeBalance || 0) } : null,
    developmentUpdates: {
      generatedAt: developmentUpdates.generatedAt || null,
      updates: Array.isArray(developmentUpdates.updates) ? developmentUpdates.updates.slice(0, 20).map(({ id, date, title, areas }) => ({ id, date, title, areas })) : []
    },
    counters: { products: catalog.length, availableProducts: catalog.filter((item) => item.stock === 'متوفر تلقائياً' || Number(item.stock) > 0).length, loyaltyProducts: pointsProducts.length }
  };
};

app.get('/api/customerAiContext', async (req, res) => {
  try { res.json(await buildPublicBotContext(req)); }
  catch (error) { res.status(503).json({ error: 'تعذر تحديث معلومات المتجر حالياً.' }); }
});

app.post('/api/customerAiChat', publicActionLimiter, async (req, res) => {
  try {
    const { message, conversationHistory, persona, taskInstruction } = req.body;
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
    const liveContext = await buildPublicBotContext(req);

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
9. إذا سأل المستخدم عن آخر تحديث أو ميزة جديدة، اعتمد على developmentUpdates المنشورة داخل معلومات المتجر الحية. اذكر فقط التحديثات الموجودة هناك، وإذا ما كان وصف التغيير كافياً احكِ ذلك بصراحة ولا تستنتج تفاصيل من أسماء الملفات.
10. هوية المتجر: متجر حمزة متجر ألعاب رقمي شامل. بطاقات رصيد المتجر فئة واحدة فقط؛ لا تقل إن المتجر مختص ببطاقات رصيد المتجر وحدها. اذكر بطاقات الألعاب والشحن والاشتراكات والشحن الفوري والخدمات الرقمية المتعلقة بالألعاب حسب الكتالوج الحالي.
`;

    if (taskInstruction) dynamicSystemPrompt += `\nالمهمة الحالية: ${taskInstruction}`;
    dynamicSystemPrompt += `\nمعلومات المتجر الحية الموثوقة (تُجلب من الخادم وقت السؤال، اعتمد عليها فقط): ${JSON.stringify(liveContext)}`;

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

    const replyText = completion.choices[0]?.message?.content || 'يا هلا، صار عندي ضغط بسيط هسع. جرّب تبعثلي كمان شوي 🙏';
    await AppState.findOneAndUpdate({ key: 'customer_bot_metrics' }, { $inc: { value: 1 }, $set: { updatedAt: new Date() } }, { upsert: true });
    res.json({ reply: replyText, contextUpdatedAt: liveContext.generatedAt, counters: liveContext.counters });

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
  io, User, getUserFromAuthHeader, publicActionLimiter, SHOP2TOPUP_WEBHOOK_SECRET
}));

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
    const orderRows = validOrders.slice(0, 30).map((o) => `<tr><td style="padding:12px;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(o.orderNumber || o._id)}</td><td style="padding:12px;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(o.customerName || '')}</td><td style="padding:12px;text-align:left;overflow-wrap:anywhere;word-break:break-word">${Number(o.totalAmount || 0).toFixed(2)} JOD</td></tr>`).join('');
    const reportHtml = `<div dir="rtl" style="width:100%;box-sizing:border-box;margin:0;background:#07111f;padding:24px 10px;font-family:Arial,Tahoma,sans-serif;color:#e5e7eb;overflow-wrap:anywhere;word-break:break-word"><div style="width:100%;max-width:820px;box-sizing:border-box;margin:auto;background:linear-gradient(145deg,#111c32,#0b1220);border:1px solid #334155;border-radius:24px;overflow:hidden"><div style="padding:30px;background:linear-gradient(135deg,#0ea5e9,#2563eb 55%,#7c3aed);color:#fff"><div style="font-size:13px;opacity:.85">HAMZA STORE · لوحة الإدارة</div><h1 style="margin:9px 0 0;font-size:27px">التقرير ${reportLabel} الشامل</h1><p style="margin:8px 0 0;opacity:.9">${today} · ${reportTime} · ${DAILY_REPORT_TZ}</p></div><div style="padding:28px;box-sizing:border-box;overflow-wrap:anywhere;word-break:break-word"><div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 22px"><div style="flex:1;min-width:135px;background:#172554;border-radius:14px;padding:15px;color:#bfdbfe">👁️ الزوار<br><b style="font-size:24px;color:#fff">${uniqueVisitors}</b></div><div style="flex:1;min-width:135px;background:#172554;border-radius:14px;padding:15px;color:#bfdbfe">📦 المبيعات<br><b style="font-size:22px;color:#fff">${validOrders.length}</b></div><div style="flex:1;min-width:135px;background:#064e3b;border-radius:14px;padding:15px;color:#a7f3d0">💰 الإيرادات<br><b style="font-size:22px;color:#fff">${revenue.toFixed(2)} JOD</b></div><div style="flex:1;min-width:135px;background:#7f1d1d;border-radius:14px;padding:15px;color:#fecaca">📉 الخسائر<br><b style="font-size:22px;color:#fff">${expenses.toFixed(2)} JOD</b></div><div style="flex:1;min-width:135px;background:#3b1f5c;border-radius:14px;padding:15px;color:#e9d5ff">📈 الأرباح<br><b style="font-size:22px;color:#fff">${(income - expenses).toFixed(2)} JOD</b></div></div><div style="background:#0f1b30;border:1px solid #334155;border-radius:16px;padding:18px;line-height:2"><b style="color:#67e8f9">المخزون وحالة التشغيل</b><br>إجمالي كمية المخزون: <b>${inventoryQty}</b><br>منتجات منخفضة المخزون: <b style="color:#fbbf24">${lowStock.length}</b><br>منتجات نافدة: <b style="color:#f87171">${outOfStock.length}</b><br>عدد المنتجات: <b>${products.length}</b><br>ساعات العمل: <b>${hoursTotal.toFixed(2)} ساعة</b><br>سجلات الرواتب: <b>${salaries.length}</b></div><h2 style="color:#fbbf24;font-size:19px;margin-top:28px">آخر الطلبات</h2><table style="width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;background:#f8fafc;color:#172033;border-radius:14px;overflow:hidden;word-break:break-word"><thead><tr style="background:#dbeafe"><th style="width:35%;padding:12px;text-align:right;overflow-wrap:anywhere">رقم الطلب</th><th style="width:40%;padding:12px;text-align:right;overflow-wrap:anywhere">العميل</th><th style="width:25%;padding:12px;text-align:left;overflow-wrap:anywhere">الإجمالي</th></tr></thead><tbody>${orderRows || '<tr><td colspan="3" style="padding:15px;text-align:center">لا توجد طلبات في هذا التقرير</td></tr>'}</tbody></table><p style="color:#94a3b8;font-size:12px;line-height:1.8;margin-top:24px">تم إنشاء هذا التقرير تلقائياً ثلاث مرات يومياً، وهو تراكمي لليوم الحالي حتى وقت الإرسال.</p><div style="border-top:1px solid #334155;margin-top:22px;padding-top:16px;text-align:center;color:#94a3b8;font-size:12px">متجر حمزة · تقرير سري للإدارة</div></div></div></div>`;
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
