// ═══════════════════════════════════════════════════════════════
// 💳 طرق الدفع — المصدر الوحيد في المشروع
// أي طريقة enabled !== false بتظهر تلقائياً:
//   1) بصفحة تأكيد الطلب (CheckoutForm)
//   2) بجواب البوت لما الزبون يسأل "شو طرق الدفع؟"
//
// ⚠️ مهم: خلّي enabled: false لحد ما تربط الطريقة بالسيرفر
// (والسيرفر لازم يتأكد من الدفع قبل ما يسلّم الأكواد). تفعيلها قبل
// هيك بيخلي الزبون يختار طريقة دفع وهي مش شغالة فعلياً.
// ═══════════════════════════════════════════════════════════════

export const PAYMENT_METHODS = [
  {
    id: 'card',
    name: 'بطاقة بنكية (فيزا / ماستركارد)',
    icon: '💳',
    description: 'دفع إلكتروني آمن وتأكيد فوري',
    enabled: false,
  },
  {
    id: 'wallet',
    name: 'محفظة إلكترونية / كليك',
    icon: '📱',
    description: 'تأكيد تلقائي بعد إتمام الدفع',
    enabled: false,
  },
  {
    id: 'balance',
    name: 'رصيد المتجر',
    icon: '👛',
    description: 'الدفع من رصيد حسابك داخل المتجر',
    enabled: false,
  },
];

export function getActivePaymentMethods() {
  return PAYMENT_METHODS.filter(m => m && m.enabled !== false && m.id && typeof m.name === 'string' && m.name.trim());
}