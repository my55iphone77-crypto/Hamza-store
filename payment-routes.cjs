const express = require('express');

const ALLOWED_METHODS = new Set(['hamza_pay_sandbox']);
const ALLOWED_SCENARIOS = new Set(['success', 'decline', 'pending', 'expire']);
const FINAL_STATUSES = new Set(['succeeded', 'declined', 'expired', 'canceled']);

const hashValue = (crypto, value) => crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');
const safeAmountMinor = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) return null;
  return Math.round(amount * 100);
};
const newId = (crypto, prefix) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

module.exports = function buildPaymentRouter(deps) {
  const {
    PaymentSession, PaymentEvent, PaymentIdempotency,
    mongoose, crypto, getUserFromAuthHeader, publicActionLimiter
  } = deps;
  const router = express.Router();

  const getUser = async (req) => getUserFromAuthHeader(req.headers.authorization);
  const sessionForUser = (session, user) => session && user && session.customerEmailHash === hashValue(crypto, user.email);
  const safeSession = (session) => {
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      mode: session.mode,
      provider: session.provider,
      method: session.method,
      amount: Number(session.amountMinor || 0) / 100,
      amountMinor: Number(session.amountMinor || 0),
      currency: session.currency,
      status: session.status,
      scenario: session.scenario,
      providerReference: session.providerReference || '',
      failureCode: session.failureCode || '',
      failureMessage: session.failureMessage || '',
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      succeededAt: session.succeededAt
    };
  };

  const recordEvent = async ({ session, type, source, status, idempotencyKey = '', payloadSafe = {} }) => {
    const eventId = newId(crypto, 'hp_evt');
    const payloadHash = hashValue(crypto, JSON.stringify(payloadSafe));
    return PaymentEvent.create({
      eventId,
      sessionId: session.sessionId,
      orderId: session.orderId || undefined,
      type,
      status,
      source,
      idempotencyKey,
      payloadHash,
      payloadSafe
    });
  };

  const idempotentResponse = async ({ scope, key, body, handler }) => {
    const cleanKey = String(key || '').trim();
    if (!cleanKey) return handler();
    const requestHash = hashValue(crypto, JSON.stringify(body || {}));
    const existing = await PaymentIdempotency.findOne({ scope, key: cleanKey }).lean();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        const error = new Error('مفتاح Idempotency مستخدم لطلب مختلف.');
        error.status = 409;
        throw error;
      }
      return { status: existing.responseStatus, body: existing.responseBody, replayed: true };
    }
    const result = await handler();
    await PaymentIdempotency.create({
      scope,
      key: cleanKey,
      requestHash,
      responseStatus: result.status,
      responseBody: result.body,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    return result;
  };

  router.get('/health', (_req, res) => res.json({
    success: true,
    mode: 'sandbox',
    provider: 'hamza_sandbox',
    liveEnabled: false,
    message: 'Hamza Pay Sandbox يعمل بدون خصم أموال حقيقية.'
  }));

  router.get('/methods', (_req, res) => res.json({
    success: true,
    methods: [{
      id: 'hamza_pay_sandbox',
      name: 'Hamza Pay Sandbox',
      description: 'محاكاة دفع آمنة — لا يتم خصم أموال حقيقية',
      mode: 'sandbox',
      enabled: true
    }]
  }));

  router.post('/sessions', publicActionLimiter, async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'سجّل الدخول أولاً لإنشاء جلسة دفع.' });
      const method = String(req.body?.method || '').trim().toLowerCase();
      const amountMinor = safeAmountMinor(req.body?.amount);
      const currency = String(req.body?.currency || 'JOD').trim().toUpperCase();
      if (!ALLOWED_METHODS.has(method)) return res.status(400).json({ error: 'طريقة الدفع القديمة أو غير المعروفة غير مفعّلة. استخدم Hamza Pay Sandbox.' });
      if (amountMinor === null || amountMinor <= 0) return res.status(400).json({ error: 'مبلغ الدفع غير صالح.' });
      if (currency !== 'JOD') return res.status(400).json({ error: 'العملة المتاحة حاليًا هي الدينار الأردني JOD.' });

      const key = req.get('Idempotency-Key') || req.body?.idempotencyKey;
      const result = await idempotentResponse({
        scope: `session:${String(user._id)}`,
        key,
        body: { method, amountMinor, currency, clientReference: String(req.body?.clientReference || '').slice(0, 120) },
        handler: async () => {
          const session = await PaymentSession.create({
            sessionId: newId(crypto, 'hp_sbx'),
            customerEmailHash: hashValue(crypto, user.email),
            provider: 'hamza_sandbox',
            mode: 'sandbox',
            method,
            amountMinor,
            currency,
            status: 'requires_action',
            scenario: 'success',
            clientReference: String(req.body?.clientReference || '').slice(0, 120),
            providerReference: newId(crypto, 'hp_ref'),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000)
          });
          await recordEvent({ session, type: 'session.created', status: session.status, source: 'api', payloadSafe: { method, amountMinor, currency } });
          return { status: 201, body: { success: true, session: safeSession(session), testScenarios: [...ALLOWED_SCENARIOS] } };
        }
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error('[hamza-pay] create session failed:', error);
      res.status(error.status || 500).json({ error: error.message || 'تعذر إنشاء جلسة الدفع.' });
    }
  });

  router.get('/sessions/:sessionId', publicActionLimiter, async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'سجّل الدخول أولاً.' });
      const session = await PaymentSession.findOne({ sessionId: String(req.params.sessionId || '') });
      if (!session || !sessionForUser(session, user)) return res.status(404).json({ error: 'جلسة الدفع غير موجودة.' });
      res.json({ success: true, session: safeSession(session) });
    } catch (error) {
      res.status(500).json({ error: 'تعذر جلب جلسة الدفع.' });
    }
  });

  router.post('/sessions/:sessionId/confirm', publicActionLimiter, async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'سجّل الدخول أولاً.' });
      const sessionId = String(req.params.sessionId || '').trim();
      const scenario = String(req.body?.testScenario || 'success').trim().toLowerCase();
      if (!ALLOWED_SCENARIOS.has(scenario)) return res.status(400).json({ error: 'سيناريو الاختبار غير صالح.' });
      const session = await PaymentSession.findOne({ sessionId });
      if (!session || !sessionForUser(session, user)) return res.status(404).json({ error: 'جلسة الدفع غير موجودة.' });
      const key = req.get('Idempotency-Key') || req.body?.idempotencyKey;
      const result = await idempotentResponse({
        scope: `confirm:${sessionId}`,
        key,
        body: { sessionId, scenario },
        handler: async () => {
          if (FINAL_STATUSES.has(session.status)) return { status: 200, body: { success: true, session: safeSession(session), replayed: true } };
          if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
            session.status = 'expired';
            session.scenario = 'expire';
          } else if (scenario === 'success') {
            session.status = 'succeeded';
            session.succeededAt = new Date();
          } else if (scenario === 'decline') {
            session.status = 'declined';
            session.failureCode = 'sandbox_declined';
            session.failureMessage = 'تم رفض العملية التجريبية حسب سيناريو الاختبار.';
          } else if (scenario === 'pending') {
            session.status = 'requires_action';
          } else {
            session.status = 'expired';
            session.expiresAt = new Date();
          }
          session.scenario = scenario;
          await session.save();
          const type = session.status === 'succeeded' ? 'payment.succeeded' : session.status === 'declined' ? 'payment.declined' : session.status === 'expired' ? 'payment.expired' : 'payment.requires_action';
          await recordEvent({ session, type, status: session.status, source: 'sandbox', payloadSafe: { scenario } });
          return { status: 200, body: { success: session.status === 'succeeded', session: safeSession(session) } };
        }
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error('[hamza-pay] confirm failed:', error);
      res.status(error.status || 500).json({ error: error.message || 'تعذر تأكيد جلسة الدفع.' });
    }
  });

  router.post('/sessions/:sessionId/cancel', publicActionLimiter, async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'سجّل الدخول أولاً.' });
      const session = await PaymentSession.findOne({ sessionId: String(req.params.sessionId || '') });
      if (!session || !sessionForUser(session, user)) return res.status(404).json({ error: 'جلسة الدفع غير موجودة.' });
      if (FINAL_STATUSES.has(session.status)) return res.status(409).json({ error: 'لا يمكن إلغاء جلسة نهائية.' });
      session.status = 'canceled';
      session.canceledAt = new Date();
      await session.save();
      await recordEvent({ session, type: 'payment.canceled', status: session.status, source: 'api', payloadSafe: {} });
      res.json({ success: true, session: safeSession(session) });
    } catch (error) {
      res.status(500).json({ error: 'تعذر إلغاء جلسة الدفع.' });
    }
  });

  router.post('/webhooks/sandbox', async (req, res) => {
    // هذا المسار محلي/تجريبي فقط؛ لا يستقبل أموالًا أو أحداثًا من مزود حقيقي.
    const eventId = String(req.get('X-HamzaPay-Event-Id') || '').trim();
    if (!eventId) return res.status(400).json({ error: 'معرف حدث Sandbox مطلوب.' });
    const existing = await PaymentEvent.findOne({ eventId }).lean();
    if (existing) return res.status(200).json({ received: true, duplicate: true });
    return res.status(400).json({ error: 'استخدم مسار confirm لإنشاء أحداث Sandbox الموقعة داخليًا.' });
  });

  router.get('/admin/sessions', async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user || !['owner', 'manager'].includes(String(user.role || '').toLowerCase()) && !user.isOwner) return res.status(403).json({ error: 'غير مصرح.' });
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const query = {};
      if (req.query.status) query.status = String(req.query.status).trim();
      const sessions = await PaymentSession.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      res.json({ success: true, mode: 'sandbox', sessions: sessions.map(safeSession) });
    } catch (error) {
      res.status(500).json({ error: 'تعذر جلب عمليات Hamza Pay.' });
    }
  });

  router.get('/admin/events/:sessionId', async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user || !['owner', 'manager'].includes(String(user.role || '').toLowerCase()) && !user.isOwner) return res.status(403).json({ error: 'غير مصرح.' });
      const events = await PaymentEvent.find({ sessionId: String(req.params.sessionId || '') }).sort({ createdAt: 1 }).lean();
      res.json({ success: true, events: events.map(({ payloadSafe, ...event }) => ({ ...event, payloadSafe })) });
    } catch (error) {
      res.status(500).json({ error: 'تعذر جلب سجل الدفع.' });
    }
  });

  return router;
};

module.exports.ALLOWED_METHODS = ALLOWED_METHODS;
module.exports.ALLOWED_SCENARIOS = ALLOWED_SCENARIOS;
module.exports.safeAmountMinor = safeAmountMinor;
