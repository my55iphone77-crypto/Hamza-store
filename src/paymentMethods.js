// Hamza Pay — وضع Sandbox الرسمي للمتجر.
// لا يتم استقبال أو تخزين أرقام بطاقات، ولا يتم خصم أموال حقيقية.
export const PAYMENT_METHODS = [
  {
    id: 'hamza_pay_sandbox',
    name: 'Hamza Pay Sandbox',
    icon: '🧪',
    description: 'محاكاة آمنة — لا يتم خصم أي مبلغ حقيقي',
    enabled: true,
    sandbox: true,
  },
];

export function getActivePaymentMethods() {
  return PAYMENT_METHODS.filter(m => m && m.enabled !== false && m.id && typeof m.name === 'string' && m.name.trim());
}

export function isSandboxPaymentMethod(id) {
  return id === 'hamza_pay_sandbox';
}
