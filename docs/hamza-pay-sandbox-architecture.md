# Hamza Pay — التصميم المعماري الكامل لوضع Sandbox

> **الحالة:** تصميم تقني للمرحلة الأولى — لا يعالج أموالًا حقيقية ولا يخزن بيانات بطاقات حقيقية.
>
> **المشروع المضيف:** Hamza Store
>
> **العملة الافتراضية:** JOD
>
> **الهدف:** بناء طبقة دفع مستقلة وقابلة للتبديل، تبدأ بمحاكاة Sandbox، ثم يمكن ربطها لاحقًا بمزوّد مرخّص أو بنك دون إعادة بناء Checkout أو الطلبات.

## 1. حدود Sandbox

### ما ينفذه Sandbox

- إنشاء جلسة دفع مستقلة لكل محاولة دفع.
- محاكاة نجاح الدفع، رفضه، تعليقه، أو انتهاء صلاحيته.
- ربط جلسة الدفع بالطلب دون الثقة بسعر الواجهة.
- منع تكرار إنشاء العملية أو تكرار تطبيق نتيجة الدفع عبر مفاتيح Idempotency.
- تسجيل كل انتقال في حالة الدفع داخل سجل أحداث غير قابل للتعديل منطقيًا.
- استقبال Webhook تجريبي موقّع للتحقق من تصميم التكامل.
- دعم صفحة Checkout الحالية دون تغيير نظام البطاقات الزجاجية.
- توفير بيانات اختبار ثابتة لا تشبه بيانات بطاقات حقيقية.

### ما لا ينفذه Sandbox

- لا يتصل بشبكة Visa أو Mastercard أو بنك.
- لا يستقبل رقم بطاقة أو CVV حقيقيًا.
- لا يخزن PAN أو CVV أو كلمات مرور الدفع.
- لا يخصم أو يحوّل أو يسوّي أموالًا.
- لا يُستخدم للإعلان عن قبول مدفوعات حقيقية.

## 2. مبادئ التصميم

1. **Payment Core مستقل:** منطق الدفع لا يوضع داخل مكوّنات المنتجات أو البريد.
2. **Order هو صاحب الحقيقة التجارية:** الطلب يملك المبلغ والمنتجات، والدفع يثبت نتيجة التحصيل فقط.
3. **Sandbox Provider قابل للاستبدال:** نفس العقد البرمجي سيُستخدم لاحقًا لمزوّد Live معتمد.
4. **لا بيانات بطاقات حساسة:** Sandbox يستقبل `testScenario` أو `testToken` فقط.
5. **Idempotency افتراضي:** كل إنشاء دفع أو Webhook يجب أن يكون آمنًا عند التكرار.
6. **حالة قابلة للتدقيق:** كل عملية لها أحداث زمنية ومصدر وطلب مرتبط.
7. **الفصل بين الدفع والتسليم:** لا يتم تسليم الأكواد أو خصم المخزون إلا بعد حالة دفع نهائية ناجحة.
8. **التصميم المرئي ثابت:** Hamza Pay يظهر داخل نفس Glassmorphism/Card System، مع شارة واضحة `Sandbox`.

## 3. الهيكل البرمجي المقترح

```text
Hamza-store/
├── server.cjs                         # تسجيل النماذج وربط الراوتر
├── store-routes.cjs                   # توافق الطلبات الحالية ومسار إنشاء الطلب
├── payment-core.cjs                   # محرك الدفع: الجلسات، الحالات، idempotency
├── payment-sandbox.cjs                # مزود Sandbox فقط
├── payment-routes.cjs                 # REST API للدفع وWebhooks التجريبية
├── payment-security.cjs               # توقيع Webhook، إخفاء البيانات، حدود الطلبات
├── payment-reconciliation.cjs         # تجهيز التسويات المستقبلية، لا أموال في Sandbox
├── models/
│   ├── payment-session.cjs            # مخطط جلسة الدفع
│   ├── payment-event.cjs              # مخطط سجل الأحداث
│   ├── payment-refund.cjs             # مخطط المرتجعات المستقبلية
│   └── payment-idempotency.cjs        # مخطط مفاتيح منع التكرار
├── src/
│   ├── paymentMethods.js              # تعريف طرق العرض الحالية
│   ├── paymentApi.js                   # عميل API موحد للواجهة
│   ├── components/payment/
│   │   ├── PaymentMethodCards.jsx      # بطاقات طرق الدفع
│   │   ├── SandboxPaymentPanel.jsx     # أدوات الاختبار المحلية فقط
│   │   ├── PaymentStatus.jsx            # حالة العملية
│   │   └── PaymentReceipt.jsx           # إيصال الدفع
│   └── app/Payments.jsx                # مركز عمليات الدفع للإدارة
└── docs/
    └── hamza-pay-sandbox-architecture.md
```

### مسؤوليات الطبقات

| الطبقة | المسؤولية | ممنوع عليها |
|---|---|---|
| `payment-routes.cjs` | التحقق من المدخلات، المصادقة، واستدعاء المحرك | حساب الأسعار أو إصدار الأكواد |
| `payment-core.cjs` | إنشاء الجلسة، انتقالات الحالة، idempotency | قراءة بيانات البطاقة |
| `payment-sandbox.cjs` | محاكاة النتيجة وفق سيناريو اختبار | الاتصال بمزوّد خارجي |
| `store-routes.cjs` | إنشاء الطلب التجاري والتسليم بعد نتيجة صحيحة | اعتبار طلب الواجهة مدفوعًا دون إثبات |
| `PaymentSession` | حفظ حالة العملية والمبلغ المرجعي | حفظ PAN/CVV |
| `PaymentEvent` | سجل التدقيق والـ Webhook | تعديل الأحداث القديمة |
| الواجهة | عرض المبلغ والحالة وإرسال token تجريبي | تحديد أن الدفع نجح بنفسها |

## 4. نموذج المجال وحالات الدفع

### PaymentSession

تمثل محاولة دفع واحدة. يمكن للطلب الواحد أن يملك أكثر من جلسة، لكن جلسة ناجحة واحدة فقط يمكنها تثبيت التحصيل.

### PaymentEvent

حدث append-only منطقيًا؛ لا نعدل الحدث السابق. إذا حدث تصحيح، نضيف حدثًا جديدًا.

### IdempotencyRecord

يربط `merchantAccount + operation + idempotencyKey` بالنتيجة السابقة لمنع إنشاء جلسات مكررة أو تكرار Webhook.

### الحالات المسموحة

```text
created
  ├── requires_action
  │     ├── authorized
  │     ├── declined
  │     └── expired
  └── canceled

authorized ── capture_requested ── succeeded
succeeded  ── refund_requested ── partially_refunded / refunded
```

في Sandbox، يمكن اختصار التدفق إلى `created → succeeded` أو اختبار أي حالة صراحة.

### قواعد الانتقال

- لا يمكن الانتقال من `succeeded` إلى `declined`.
- لا يمكن إعادة تشغيل عملية `succeeded` بنفس الـ idempotency key بنتيجة مختلفة.
- لا يعتبر الطلب مدفوعًا إلا عند `paymentSession.status = succeeded`.
- `declined` و`expired` لا يخصمان مخزونًا ولا يصدران أكوادًا.
- `refund` لا يُفعل تجاريًا قبل وجود تكامل Live مرخّص؛ في Sandbox هو سجل محاكاة فقط.

## 5. مخططات MongoDB المقترحة

### 5.1 PaymentSession

```js
const paymentSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  orderNumber: { type: String, required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  customerEmailHash: { type: String, required: true, index: true },
  provider: { type: String, enum: ['hamza_sandbox'], default: 'hamza_sandbox', index: true },
  mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox', index: true },
  method: { type: String, enum: ['hamza_pay_sandbox'], required: true },
  amountMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['JOD'], default: 'JOD' },
  status: {
    type: String,
    enum: ['created', 'requires_action', 'authorized', 'declined', 'expired', 'canceled', 'succeeded', 'capture_requested', 'partially_refunded', 'refunded'],
    default: 'created', index: true
  },
  scenario: { type: String, enum: ['success', 'decline', 'pending', 'expire'], default: 'success' },
  clientReference: { type: String, maxlength: 120 },
  providerReference: { type: String, unique: true, sparse: true, index: true },
  failureCode: { type: String, default: '' },
  failureMessage: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, index: true },
  authorizedAt: Date,
  succeededAt: Date,
  canceledAt: Date
}, { timestamps: true });
```

**ملاحظات:**

- `amountMinor` يخزن الفلس كعدد صحيح؛ مثال `12.50 JOD = 1250`.
- `customerEmailHash` يستخدم للتدقيق دون تكرار البريد في سجلات الدفع.
- `metadata` لا يقبل card data أو tokens حساسة.
- لا يضاف `cardNumber`, `pan`, `cvv`, `expiry` إلى أي Schema.

### 5.2 PaymentEvent

```js
const paymentEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  type: {
    type: String,
    enum: ['session.created', 'payment.requires_action', 'payment.authorized', 'payment.declined', 'payment.expired', 'payment.succeeded', 'payment.canceled', 'refund.created'],
    required: true
  },
  status: { type: String, required: true },
  source: { type: String, enum: ['api', 'sandbox', 'webhook', 'system', 'admin'], required: true },
  idempotencyKey: { type: String, default: '' },
  payloadHash: { type: String, required: true },
  payloadSafe: { type: mongoose.Schema.Types.Mixed, default: {} },
  processedAt: { type: Date, default: Date.now },
  processingError: { type: String, default: '' }
}, { timestamps: true });
```

### 5.3 PaymentIdempotency

```js
const paymentIdempotencySchema = new mongoose.Schema({
  scope: { type: String, required: true },
  key: { type: String, required: true },
  requestHash: { type: String, required: true },
  responseStatus: { type: Number, required: true },
  responseBody: { type: mongoose.Schema.Types.Mixed, required: true },
  lockedUntil: Date,
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true });
paymentIdempotencySchema.index({ scope: 1, key: 1 }, { unique: true });
```

### 5.4 PaymentRefund

يُضاف من البداية لتثبيت النموذج المستقبلي، لكن لا يرسل أموالًا في Sandbox:

```js
const paymentRefundSchema = new mongoose.Schema({
  refundId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'JOD' },
  reason: { type: String, maxlength: 500 },
  status: { type: String, enum: ['requested', 'succeeded', 'failed', 'canceled'], default: 'requested' },
  mode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date
}, { timestamps: true });
```

## 6. تعديل Order بدون كسر المخطط الحالي

المخطط الحالي يملك `provider`, `providerOrderId`, `providerStatus`, `providerLastEventId`, `paymentMode`, و`paymentStatus`. سنحافظ عليها للتوافق، ونضيف حقولًا محدودة:

```js
paymentSessionId: { type: String, default: '', index: true },
paymentProvider: { type: String, default: 'hamza_sandbox' },
paymentAmountMinor: { type: Number, min: 0 },
paymentAuthorizedAt: Date,
paymentSucceededAt: Date,
paymentFailureCode: { type: String, default: '' },
paymentUpdatedAt: Date
```

**قاعدة التوافق:** لا نحذف أو نعيد تسمية الحقول القديمة في هذه المرحلة. مسار الطلب الحالي يستمر بالعمل، بينما المسار الجديد يثبت `paymentSessionId` ويربط النتيجة بالطلب.

## 7. REST API المقترح

كل المسارات تحت `/api/payments` ما عدا Webhook الاختبار.

| الطريقة | المسار | المصادقة | الغرض |
|---|---|---|---|
| `POST` | `/api/payments/sessions` | مستخدم مسجل | إنشاء جلسة دفع من `orderId` أو مسودة طلب |
| `GET` | `/api/payments/sessions/:sessionId` | مالك الجلسة/موظف | قراءة الحالة العامة بدون أسرار |
| `POST` | `/api/payments/sessions/:sessionId/confirm` | مالك الجلسة | تأكيد Sandbox باستخدام `testScenario` فقط |
| `POST` | `/api/payments/sessions/:sessionId/cancel` | مالك الجلسة/موظف | إلغاء جلسة غير نهائية |
| `POST` | `/api/payments/webhooks/sandbox` | توقيع Sandbox | اختبار استقبال حدث خارجي موقّع |
| `GET` | `/api/payments/methods` | عام | عرض الطرق المفعّلة ووضعها |
| `GET` | `/api/payments/admin/sessions` | staff | قائمة عمليات الدفع مع فلاتر |
| `GET` | `/api/payments/admin/events/:sessionId` | staff | سجل أحداث جلسة |
| `POST` | `/api/payments/admin/sessions/:id/refunds` | owner | إنشاء محاكاة مرتجع فقط |
| `GET` | `/api/payments/health` | عام | حالة المحرك: `sandbox=true`, `live=false` |

### إنشاء جلسة

```json
{
  "orderId": "...",
  "method": "hamza_pay_sandbox",
  "clientReference": "checkout-...",
  "idempotencyKey": "checkout-session-unique-key"
}
```

الخادم يعيد حساب المبلغ من الطلب، ويتحقق من أن الطلب يخص المستخدم، ثم يعيد:

```json
{
  "success": true,
  "sessionId": "hp_sbx_...",
  "mode": "sandbox",
  "status": "requires_action",
  "amount": 12.5,
  "currency": "JOD",
  "expiresAt": "...",
  "testInstructions": "استخدم السيناريو من لوحة الاختبار فقط"
}
```

### تأكيد Sandbox

```json
{
  "testScenario": "success",
  "idempotencyKey": "confirm-session-unique-key"
}
```

القيم المسموحة: `success`, `decline`, `pending`, `expire`.

لا يقبل المسار `cardNumber`, `cvv`, `pan`, `expiry`, أو أي حقل بطاقة.

## 8. Webhook Sandbox

### التوقيع

```text
X-HamzaPay-Event-Id: hp_evt_...
X-HamzaPay-Timestamp: 1791600000
X-HamzaPay-Signature: sha256=<HMAC_SHA256(timestamp + '.' + rawBody, HAMZA_PAY_SANDBOX_WEBHOOK_SECRET)>
```

### قواعد المعالجة

1. رفض التوقيع المفقود أو غير الصحيح.
2. رفض timestamp أقدم من نافذة السماح، مثل 5 دقائق.
3. حفظ `eventId` قبل تنفيذ الأثر التجاري.
4. إذا كان `eventId` موجودًا، إعادة `200` دون تكرار الأثر.
5. تحديث جلسة الدفع بانتقال حالة صالح فقط.
6. عند `payment.succeeded`، تشغيل معالج تسليم idempotent مرة واحدة.
7. عدم قبول Webhook لإتمام طلب لا يرتبط بجلسة موجودة.

## 9. تدفق Checkout الكامل

```text
اختيار المنتجات
  → إنشاء الطلب بحالة paymentStatus=pending
  → POST /payments/sessions
  → عرض بطاقة Hamza Pay Sandbox
  → اختيار سيناريو اختبار
  → POST /sessions/:id/confirm
  → إنشاء payment.succeeded أو payment.declined
  → تحديث Order داخل معاملة/قفل منطقي
  → عند النجاح فقط: خصم المخزون وإصدار الأكواد
  → حفظ PaymentEvent
  → عرض الإيصال وإرسال البريد في الخلفية
```

### منع التسليم المكرر

يجب أن يكون معالج النجاح مشروطًا بـ:

```js
{ paymentSessionId: sessionId, paymentStatus: { $ne: 'paid' } }
```

ثم يثبت `paymentStatus: 'paid'` و`paymentSucceededAt` قبل إصدار الأثر. إذا فشل إصدار الأثر، يسجل فشلًا قابلًا لإعادة المحاولة ولا ينشئ أكوادًا ثانية.

## 10. الأمان والامتثال

- Sandbox مغلق افتراضيًا عبر `HAMZA_PAY_MODE=sandbox`.
- أي قيمة غير `sandbox` تحتاج إعدادًا صريحًا ومراجعة مستقلة.
- لا تسجل body كاملًا إذا احتوى حقول دفع مستقبلية.
- لا نقبل بيانات بطاقة في API حتى في Sandbox.
- استخدام `crypto.randomUUID()` لمعرفات الجلسات والأحداث.
- HMAC للـ Webhook مع مقارنة ثابتة الوقت.
- Rate limit منفصل لإنشاء الجلسات والتأكيد والـ Webhook.
- التحقق من ملكية الطلب قبل إنشاء أو قراءة جلسة.
- منع تعديل حالة الدفع من مسار إدارة الطلبات العام؛ التعديل يمر عبر Payment Core.
- فصل صلاحية `view_payments` عن `refund_payments`.
- تشفير أو hashing للبريد المرجعي في سجلات الدفع.
- الاحتفاظ بسجل التدقيق، مع منع حذف الأحداث من الواجهة.
- رسائل الواجهة توضح دائمًا: **هذه عملية تجريبية ولا يتم خصم أموال حقيقية**.

## 11. مركز الإدارة

قسم جديد باسم **Hamza Pay** ضمن مجموعة «الطلبات والمال»، ويظهر فيه:

- مؤشر الوضع الحالي: `Sandbox — مغلق عن الأموال الحقيقية`.
- إجمالي الجلسات اليوم.
- الناجحة / المرفوضة / المعلقة.
- حجم العمليات التجريبي بالدينار.
- نسبة النجاح.
- جدول الجلسات مع البحث بالطلب أو البريد أو `sessionId`.
- عرض timeline للأحداث.
- زر محاكاة Webhook للمالك فقط.
- زر محاكاة مرتجع، مع وسم واضح أنه لا يعيد أي أموال.
- لا يظهر أي رقم بطاقة أو أسرار توقيع.

## 12. إعدادات البيئة

```env
HAMZA_PAY_MODE=sandbox
HAMZA_PAY_PROVIDER=hamza_sandbox
HAMZA_PAY_SANDBOX_WEBHOOK_SECRET=change-me-in-render
HAMZA_PAY_SESSION_TTL_MINUTES=30
HAMZA_PAY_IDEMPOTENCY_TTL_HOURS=24
HAMZA_PAY_ALLOW_TEST_CONTROLS=false
```

`HAMZA_PAY_ALLOW_TEST_CONTROLS=true` يستخدم محليًا أو للمالك في بيئة اختبار فقط. لا يستخدم لتفعيل Live.

## 13. خطة التنفيذ المرحلية

### المرحلة A — الأساس

- استخراج نماذج الدفع في ملفات مستقلة.
- إضافة Payment Core وSandbox Provider.
- إضافة مفاتيح البيئة والتحقق من وضع Sandbox.
- إضافة `/api/payments/health` و`/api/payments/methods`.
- عدم تغيير Checkout الحالي بعد.

### المرحلة B — جلسات الدفع

- إضافة `POST /sessions` و`GET /sessions/:id`.
- إضافة Idempotency.
- ربط الجلسة بالطلب الحالي وحقول Order الجديدة.

### المرحلة C — التأكيد والتسليم

- إضافة confirm بالسيناريوهات الأربعة.
- بناء state machine.
- جعل التسليم بعد `succeeded` فقط.
- تسجيل PaymentEvent.

### المرحلة D — Webhook ومركز الإدارة

- توقيع Webhook وفحص التكرار.
- شاشة Hamza Pay داخل لوحة التحكم بنفس Glassmorphism.
- فلاتر وتدقيق ومرتجع Sandbox.

### المرحلة E — اختبارات الإنتاج قبل أي Live

- اختبارات انتقالات الحالات.
- اختبارات التكرار والتزامن.
- اختبارات عدم تسريب بيانات حساسة.
- اختبار فشل البريد دون فشل الدفع.
- مراجعة قانونية وتقنية قبل أي اتصال بمزوّد حقيقي.

## 14. معايير قبول التصميم

- لا توجد بيانات بطاقة حقيقية في قاعدة البيانات أو السجلات.
- لا يمكن تأكيد عملية دون جلسة صالحة ومبلغ مطابق للطلب.
- إعادة إرسال نفس الطلب بنفس idempotency key تعيد نفس النتيجة.
- إعادة إرسال Webhook لا تصدر أكوادًا أو تخصم مخزونًا مرة ثانية.
- الدفع المرفوض أو المنتهي لا يغير حالة التسليم.
- الدفع الناجح يربط الطلب بجلسة واضحة ويظهر في الإيصال ومركز الإدارة.
- كل عملية تحمل `mode=sandbox` واسم المزود التجريبي بوضوح.
- عدم كسر الطلبات الحالية أو الدفع من رصيد المتجر.
- الحفاظ على نظام البطاقات الزجاجية ودعم RTL وجميع الأجهزة.
