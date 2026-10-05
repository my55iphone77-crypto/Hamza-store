import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from './AppContext';

const ORDER_STATUSES = ['جديد', 'قيد المعالجة', 'تم الدفع', 'تم التسليم', 'مكتمل', 'ملغي'];
const idOf = (row) => row?._id || row?.id;
const money = (value) => `${Number(value || 0).toFixed(2)} ${value === undefined ? '' : 'د.أ'}`;

export default function Orders() {
  const { apiRequest, orders = [], setOrders = () => {}, triggerGlobalSync, addLog } = useApp() || {};
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = useCallback(async () => {
    if (typeof apiRequest !== 'function') return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/orders', 'GET');
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'تعذر تحميل الطلبات من الخادم.');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, setOrders]);

  // تحميل بيانات خارجية عند فتح القسم؛ التحديثات الداخلية تتم عبر callbacks الطلبات.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const updateStatus = async (order, status) => {
    const id = idOf(order);
    if (!id || status === order.status) return;
    setSavingId(id);
    setError('');
    try {
      const updated = await apiRequest(`/orders/${id}`, 'PUT', { status });
      setOrders((prev) => prev.map((item) => idOf(item) === id ? (updated || { ...item, status }) : item));
      if (typeof addLog === 'function') addLog({ action: `🧾 تم تغيير حالة الطلب ${order.orderNumber || id} إلى (${status})`, type: 'order_status_update' });
      if (typeof triggerGlobalSync === 'function') triggerGlobalSync({ type: 'ORDERS' });
    } catch (err) {
      setError(err?.message || 'تعذر تحديث حالة الطلب.');
    } finally {
      setSavingId('');
    }
  };

  const safeOrders = useMemo(() => Array.isArray(orders) ? orders : [], [orders]);
  const filtered = useMemo(() => safeOrders.filter((order) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [order.orderNumber, order.customerName, order.customerEmail]
      .some((value) => String(value || '').toLowerCase().includes(term));
    return matchesSearch && (statusFilter === 'all' || order.status === statusFilter);
  }), [safeOrders, search, statusFilter]);

  const counts = useMemo(() => ({
    all: safeOrders.length,
    open: safeOrders.filter((order) => !['مكتمل', 'ملغي', 'تم التسليم'].includes(order.status)).length,
    revenue: safeOrders.filter((order) => order.status !== 'ملغي').reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
  }), [safeOrders]);

  return (
    <section className="hz-orders-panel" dir="rtl">
      <header className="hz-orders-header">
        <div>
          <h2>📦 مركز الطلبات</h2>
          <p>متابعة الطلب من لحظة إنشائه حتى التسليم، مع تحديث الحالة من نفس الشاشة.</p>
        </div>
        <button type="button" className="hz-glass-btn hz-orders-refresh" onClick={loadOrders} disabled={loading}>
          {loading ? 'جاري التحميل...' : 'تحديث البيانات ↻'}
        </button>
      </header>

      {error && <div className="hz-orders-alert">⚠️ {error}</div>}

      <div className="hz-orders-stats">
        <div><span>كل الطلبات</span><strong>{counts.all}</strong></div>
        <div><span>قيد المتابعة</span><strong>{counts.open}</strong></div>
        <div><span>إجمالي غير الملغي</span><strong>{money(counts.revenue)}</strong></div>
      </div>

      <div className="hz-orders-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث برقم الطلب أو اسم العميل أو البريد..." />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">كل الحالات</option>
          {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      {loading ? <div className="hz-orders-empty">⏳ جاري تحميل الطلبات...</div> : filtered.length === 0 ? <div className="hz-orders-empty">لا توجد طلبات مطابقة للفلتر الحالي.</div> : (
        <div className="hz-orders-list">
          {filtered.map((order) => {
            const id = idOf(order);
            return (
              <article className="hz-order-card" key={id || order.orderNumber}>
                <div className="hz-order-main">
                  <div className="hz-order-number">{order.orderNumber || 'طلب بدون رقم'}</div>
                  <strong>{order.customerName || 'عميل غير مسمى'}</strong>
                  <span>{order.customerEmail || 'بدون بريد'} · {order.date ? new Date(order.date).toLocaleString('ar-JO') : 'بدون تاريخ'}</span>
                </div>
                <div className="hz-order-items">{Array.isArray(order.items) ? order.items.map((item, index) => <span key={`${id}-item-${index}`}>{item.name || 'منتج'} × {item.quantity || 1}</span>) : 'لا توجد تفاصيل'}</div>
                <div className="hz-order-total">{money(order.totalAmount)}</div>
                <label className="hz-order-status">
                  <span>الحالة</span>
                  <select value={order.status || 'جديد'} onChange={(event) => updateStatus(order, event.target.value)} disabled={savingId === id}>
                    {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
