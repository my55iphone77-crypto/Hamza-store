// ═══════════════════════════════════════════════════════════════
// بوابات الدفع — وضع تجريبي فقط
// هذه الخيارات لا تحوّل أموالاً ولا تخصم رصيداً ولا تُصدر أكواداً حقيقية.
// عند جاهزية الترخيص، تُستبدل بموصلات Live معتمدة من مزود الدفع.
// ═══════════════════════════════════════════════════════════════

export const PAYMENT_METHODS = [
  {
    id: 'sandbox_card',
    name: 'بطاقة بنكية تجريبية (Visa / Mastercard)',
    icon: '🧪',
    description: 'Sandbox — لا يتم خصم أي مبلغ حقيقي',
    enabled: true,
    sandbox: true,
  },
  {
    id: 'sandbox_wallet',
    name: 'محفظة إلكترونية تجريبية / كليك',
    icon: '🧪',
    description: 'Sandbox — محاكاة نجاح الدفع فقط',
    enabled: true,
    sandbox: true,
  },
  {
    id: 'sandbox_bank',
    name: 'تحويل بنكي تجريبي',
    icon: '🧪',
    description: 'Sandbox — لا يحتاج إلى حساب بنكي',
    enabled: true,
    sandbox: true,
  },
];

export function getActivePaymentMethods() {
  return PAYMENT_METHODS.filter(m => m && m.enabled !== false && m.id && typeof m.name === 'string' && m.name.trim());
}

export function isSandboxPaymentMethod(id) {
  return getActivePaymentMethods().some(m => m.id === id && m.sandbox === true);
}
