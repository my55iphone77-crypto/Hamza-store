const express = require('express');
const passport = require('passport');

module.exports = function buildAuthCoreRouter(deps) {
  const {
    User, bcrypt, crypto,
    JWT_SECRET, jwt,
    FRONTEND_URL, APP_NAME,
    sendStoreEmail, checkOwnerAccess,
    requireAuth, authLimiter,
    issueSessionToken, issueTwoFactorTempToken,
    publicUser
  } = deps;

  const router = express.Router();
  // منع تكوين روابط من نوع //reset-password إذا انتهى FRONTEND_URL بشرطة مائلة.
  const frontendBaseUrl = String(FRONTEND_URL || '').replace(/\/+$/, '');

  router.get('/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return res.status(200).json({ success: false, user: null });
      }

      const token = authHeader.split(' ')[1];
      if (!token || typeof token !== 'string') {
        return res.status(200).json({ success: false, user: null });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(200).json({ success: false, user: null });
      }

      if (!decoded || decoded.purpose && decoded.purpose !== 'session' || !decoded.id) {
        return res.status(200).json({ success: false, user: null });
      }

      const user = await User.findById(decoded.id).lean();
      if (!user) {
        return res.status(200).json({ success: false, user: null });
      }

      const isRealOwner = checkOwnerAccess(user.email);
      if (isRealOwner && (!user.isOwner || user.role !== 'owner')) {
        await User.findByIdAndUpdate(user._id, { isOwner: true, role: 'owner' });
        user.isOwner = true;
        user.role = 'owner';
      }

      res.json({ success: true, user: publicUser(user) });
    } catch (err) {
      res.status(200).json({ success: false, user: null });
    }
  });

  router.post('/register', authLimiter, async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ error: 'البريد الإلكتروني مستخدم مسبقاً.' });
      }

      const isOwnerAccount = checkOwnerAccess(cleanEmail);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const rawVerifyToken = crypto.randomBytes(32).toString('hex');
      const hashedVerifyToken = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');

      const cleanName = name && typeof name === 'string' ? name.trim() : (isOwnerAccount ? 'حمزة (المالك)' : 'مستخدم');

      const newUser = new User({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: isOwnerAccount ? 'owner' : 'customer',
        isOwner: isOwnerAccount,
        emailVerified: false,
        emailVerificationToken: hashedVerifyToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await newUser.save();

      const verifyLink = `${frontendBaseUrl}/verify-email?email=${encodeURIComponent(cleanEmail)}&token=${rawVerifyToken}`;
      sendStoreEmail(
        cleanEmail,
        `🎉 أهلاً بك في ${APP_NAME || 'متجر حمزة'} - تفعيل الحساب`,
        `<div dir="rtl" style="margin:0;background:#07111f;padding:24px 10px;font-family:Arial,Tahoma,sans-serif;color:#e5e7eb"><div style="max-width:640px;margin:auto;background:linear-gradient(145deg,#111c32,#0b1220);border:1px solid #334155;border-radius:24px;overflow:hidden"><div style="padding:32px;background:linear-gradient(135deg,#0ea5e9,#2563eb 55%,#7c3aed);color:#fff;text-align:center"><div style="font-size:14px;opacity:.9">HAMZA STORE</div><h1 style="margin:12px 0 0;font-size:29px">أهلاً وسهلاً بك!</h1></div><div style="padding:30px"><h2 style="color:#67e8f9;margin-top:0">مرحباً ${cleanName}،</h2><p style="font-size:16px;line-height:2;color:#cbd5e1">نحن سعداء بانضمامك إلى ${APP_NAME || 'متجر حمزة'} 🎉 تم إنشاء حسابك بنجاح، وبقيت خطوة واحدة لتفعيل بريدك الإلكتروني والاستفادة من جميع خدمات المتجر.</p><div style="text-align:center;margin:28px 0"><a href="${verifyLink}" style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#2563eb);color:#fff;padding:15px 28px;border-radius:13px;text-decoration:none;font-weight:bold;font-size:16px">تفعيل الحساب الآن</a></div><div style="background:#172033;border:1px solid #334155;border-radius:14px;padding:16px;line-height:2;color:#cbd5e1"><b style="color:#fbbf24">مميزات حسابك:</b><br>🎮 شراء بطاقات وألعاب رقمية بسرعة<br>⭐ جمع نقاط الولاء مع كل عملية شراء<br>💳 استخدام رصيد المتجر للشراء الداخلي<br>📧 استلام الفواتير والأكواد مباشرة على بريدك</div><p style="color:#94a3b8;font-size:12px;line-height:1.8;margin-top:24px">رابط التفعيل صالح لمدة 24 ساعة. رصيد المتجر ونقاط الولاء للاستخدام داخل متجر حمزة فقط وغير قابلين للسحب.</p><div style="border-top:1px solid #334155;margin-top:24px;padding-top:18px;text-align:center;color:#94a3b8;font-size:12px">شكراً لاختيارك متجر حمزة — نتمنى لك تجربة ممتعة</div></div></div></div>`
      );

      const token = issueSessionToken(newUser);

      res.json({
        success: true,
        message: 'تم إنشاء الحساب بنجاح، تحقق من بريدك الإلكتروني لتفعيله.',
        user: publicUser(newUser),
        token
      });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' });
    }
  });

  router.post('/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      let user = await User.findOne({ email: cleanEmail });

      if (!user) {
        return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
      }

      if (checkOwnerAccess(cleanEmail)) {
        user.role = 'owner';
        user.isOwner = true;
        if (!user.name || user.name === 'مستخدم') user.name = 'حمزة (المالك)';
        await user.save();
      }

      if (user.twoFactorEnabled) {
        const tempToken = issueTwoFactorTempToken(user);
        return res.json({ success: true, requires2FA: true, tempToken });
      }

      const token = issueSessionToken(user);

      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        user: publicUser(user),
        token
      });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
    }
  });

  router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: cleanEmail });

      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();

        const resetLink = `${frontendBaseUrl}/reset-password?email=${encodeURIComponent(cleanEmail)}&token=${rawToken}`;

        const emailSent = await sendStoreEmail(
          cleanEmail,
          'إعادة تعيين كلمة المرور - متجر حمزة',
          `<div dir="rtl" style="max-width:640px;margin:0 auto;font-family:Arial,Tahoma,sans-serif;color:#e5e7eb;text-align:right"><div style="background:#172033;border:1px solid #334155;border-radius:16px;padding:22px"><h2 style="margin:0 0 14px;color:#67e8f9;font-size:22px">مرحباً ${user.name || ''}،</h2><p style="line-height:1.9;color:#cbd5e1">تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في متجر حمزة.</p><div style="text-align:center;margin:24px 0"><a href="${resetLink}" style="display:inline-block;max-width:100%;background:#2563eb;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">إعادة تعيين كلمة المرور</a></div><p style="font-size:13px;line-height:1.8;color:#94a3b8">الرابط صالح لمدة ساعة واحدة فقط. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة بأمان.</p></div></div>`
        );
        if (!emailSent) return res.status(502).json({ error: 'تعذر إرسال البريد حالياً. يرجى التحقق من إعدادات SMTP أو المحاولة لاحقاً.' });
      }

      res.json({ success: true, message: 'إذا كان هذا البريد مسجلاً لدينا، تم إرسال رابط إعادة التعيين.' });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ، حاول لاحقاً.' });
    }
  });

  router.post('/reset-password', authLimiter, async (req, res) => {
    try {
      const { email, token, newPassword } = req.body;
      if (!email || !token || !newPassword || typeof email !== 'string' || typeof token !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'بيانات ناقصة أو غير صالحة.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        email: cleanEmail,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({ error: 'الرابط غير صالح أو انتهت صلاحيته، يرجى طلب رابط جديد.' });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن.' });
    } catch (err) {
      res.status(500).json({ error: 'تعذّر إعادة تعيين كلمة المرور.' });
    }
  });

  router.post('/change-password', authLimiter, requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية والجديدة.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.' });
      }

      const user = req.user;
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح.' });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء تغيير كلمة المرور.' });
    }
  });

  router.post('/verify-email', authLimiter, async (req, res) => {
    try {
      const { email, token } = req.body;
      if (!email || !token || typeof email !== 'string' || typeof token !== 'string') {
        return res.status(400).json({ error: 'بيانات ناقصة أو غير صالحة.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        email: cleanEmail,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({ error: 'رابط التفعيل غير صالح أو منتهي الصلاحية، يمكنك طلب رابط جديد.' });
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      res.json({ success: true, message: 'تم تفعيل بريدك الإلكتروني بنجاح.' });
    } catch (err) {
      res.status(500).json({ error: 'تعذّر تفعيل البريد الإلكتروني.' });
    }
  });

  router.post('/resend-verification', authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: cleanEmail });

      if (user && !user.emailVerified) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();

        const verifyLink = `${frontendBaseUrl}/verify-email?email=${encodeURIComponent(cleanEmail)}&token=${rawToken}`;
        await sendStoreEmail(
          cleanEmail,
          'تفعيل حسابك - متجر حمزة',
          `<div dir="rtl" style="max-width:640px;margin:0 auto;font-family:Arial,Tahoma,sans-serif;color:#e5e7eb;text-align:right"><div style="background:#172033;border:1px solid #334155;border-radius:16px;padding:22px"><h2 style="margin:0 0 14px;color:#67e8f9;font-size:22px">مرحباً ${user.name || ''}،</h2><p style="line-height:1.9;color:#cbd5e1">بقيت خطوة واحدة لتفعيل بريدك الإلكتروني والاستفادة من خدمات متجر حمزة.</p><div style="text-align:center;margin:24px 0"><a href="${verifyLink}" style="display:inline-block;max-width:100%;background:#06b6d4;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">تفعيل البريد الإلكتروني</a></div><p style="font-size:13px;line-height:1.8;color:#94a3b8">رابط التفعيل صالح لمدة 24 ساعة فقط.</p></div></div>`
        );
      }

      res.json({ success: true, message: 'إذا كان الحساب موجوداً وغير مفعّل، تم إرسال رابط التفعيل إليه.' });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ، حاول لاحقاً.' });
    }
  });

return router;
};
