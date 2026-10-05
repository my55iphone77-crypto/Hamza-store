import { useEffect, useMemo, useState } from 'react';
import { useApp } from './AppContext';

const stockOf = (product) => product?.deliveryType === 'store_credit' ? Infinity : product?.deliveryType === 'id_topup' ? Number(product?.stock || 0) : Number(product?.codes?.length ?? product?.stock ?? 0);

export default function StockAlerts({ onOpenProducts }) {
  const { products = [] } = useApp() || {};
  const [dismissed, setDismissed] = useState(() => new Set());
  const lowStock = useMemo(() => (Array.isArray(products) ? products : []).filter((product) => stockOf(product) <= Number(product.lowStockThreshold ?? 3)), [products]);
  const alertKey = lowStock.map((product) => `${product._id || product.id}:${stockOf(product)}`).join('|');

  useEffect(() => {
    if (!alertKey) return;
    try { localStorage.setItem('hamza_last_stock_alert', alertKey); } catch { /* التخزين المحلي اختياري */ }
  }, [alertKey]);

  const visible = lowStock.filter((product) => !dismissed.has(String(product._id || product.id)));
  if (!visible.length) return null;

  return (
    <section className="hz-stock-alert" role="status" aria-live="polite" dir="rtl">
      <div className="hz-stock-alert-heading">
        <div><strong>⚠️ تنبيه مخزون فوري</strong><span>{visible.length} منتج يحتاج متابعة قبل نفاده</span></div>
        <div className="hz-stock-alert-actions"><button type="button" onClick={onOpenProducts}>فتح المنتجات</button><button type="button" onClick={() => setDismissed(new Set(visible.map((product) => String(product._id || product.id))))}>إخفاء</button></div>
      </div>
      <div className="hz-stock-alert-list">{visible.slice(0, 6).map((product) => <button type="button" key={product._id || product.id} onClick={onOpenProducts}><span>{product.name || 'منتج بدون اسم'}</span><b>{stockOf(product)} متاح</b></button>)}</div>
    </section>
  );
}
