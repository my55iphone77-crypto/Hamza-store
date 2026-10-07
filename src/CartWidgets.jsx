import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getActivePaymentMethods } from './paymentMethods';

const glassBtn = {
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
};

export function HeaderControls({ authCart, onOpenDashboard }) {
  const safeAuthCart = authCart && typeof authCart === 'object' ? authCart : {};
  const {
    currentUser = null,
    isStaffUser = false,
    userRoleInfo = { label: 'ضيف', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: '#64748b' },
    cart = [],
    removeFromCart = () => {},
    updateCartItemQuantity = () => {},
    totalPrice = 0,
    totalPoints = 0,
    totalItemsCount = 0,
    showCartDropdown = false,
    setShowCartDropdown = () => {},
    setShowLoginPage = () => {},
    handleLogout = () => {},
    handleInitiateCheckout = () => {},
    storeCreditCode = '',
    setStoreCreditCode = () => {},
    redeemStoreCredit = () => {},
    redeemingStoreCredit = false,
  } = safeAuthCart;

  const safeCart = Array.isArray(cart) ? cart : [];
  const safeUserRoleInfo = userRoleInfo && typeof userRoleInfo === 'object' ? userRoleInfo : { label: 'ضيف', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: '#64748b' };
  const cartButtonRef = useRef(null);
  const [cartPanelPosition, setCartPanelPosition] = useState({ top: 76, right: 12 });

  useEffect(() => {
    if (!showCartDropdown || !cartButtonRef.current || typeof window === 'undefined') return;
    const rect = cartButtonRef.current.getBoundingClientRect();
    setCartPanelPosition({ top: rect.bottom + window.scrollY + 8, right: Math.max(12, window.innerWidth - rect.right) });
  }, [showCartDropdown]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', flexWrap: 'wrap' }}>

      <div className="hz-cart-shell" style={{ position: 'relative' }}>
        <button
          type="button"
          ref={cartButtonRef}
          onClick={() => setShowCartDropdown(!showCartDropdown)}
          style={{ ...glassBtn, color: '#38bdf8', padding: '10px 18px', borderRadius: '14px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          className="hz-admin-btn"
        >
          🛒 السلة <span style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '50%', boxShadow: '0 0 10px rgba(2, 132, 199, 0.5)' }}>{Number(totalItemsCount) || 0}</span>
        </button>

        {showCartDropdown && createPortal((
          <div className="hz-cart-menu" style={{ position: 'absolute', right: `${cartPanelPosition.right}px`, top: `${cartPanelPosition.top}px`, width: 'min(360px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 92px)', overflowY: 'auto', overscrollBehavior: 'contain', boxSizing: 'border-box', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(56,189,248,0.55)', borderTop: '2px solid rgba(56,189,248,0.8)', borderRadius: '16px', padding: '16px', zIndex: 1000, boxShadow: '0 18px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#38bdf8', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>محتويات سلة المشتريات</h4>

            {safeCart.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '12px', margin: '15px 0', textAlign: 'center' }}>السلة فارغة حالياً.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {safeCart.map((item, idx) => {
                  if (!item || typeof item !== 'object') return null;
                  const itemId = item.id || item._id || idx;
                  const itemName = String(item.name || 'منتج');
                  const itemQty = Number(item.quantity) || 1;
                  const itemPrice = Number(item.price) || 0;

                  return (
                    <div key={`${itemId}-${item.loyaltyOnly ? 'points' : 'cash'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: 'rgba(11,15,25,0.7)', border: '1px solid rgba(255,255,255,0.06)', padding: '10px', borderRadius: '10px', fontSize: '12px' }}>
                      <span style={{ color: '#f8fafc', minWidth: 0 }}>{itemName} <small style={{ color: '#94a3b8' }}>×{itemQty}</small> {item.loyaltyOnly && <small style={{ color: '#e9d5ff' }}>⭐ {Number(item.loyaltyPrice || 0) * itemQty} نقطة</small>}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!item.loyaltyOnly && <span style={{ color: '#facc15', fontWeight: 'bold' }}>{itemPrice * itemQty} دينار</span>}
                        {item.loyaltyOnly && <span style={{ color: '#e9d5ff', fontWeight: 'bold' }}>{Number(item.loyaltyPrice || 0) * itemQty} نقطة</span>}
                        <button type="button" onClick={() => updateCartItemQuantity(item.id || item._id, itemQty + 1, item.loyaltyOnly)} aria-label="زيادة الكمية" style={{ background: '#166534', color: '#fff', border: 'none', width: '22px', height: '22px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                        <button type="button" onClick={() => updateCartItemQuantity(item.id || item._id, itemQty - 1, item.loyaltyOnly)} aria-label="تقليل الكمية" style={{ background: '#92400e', color: '#fff', border: 'none', width: '22px', height: '22px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>−</button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id || item._id)}
                          className="hz-cart-remove-btn"
                          style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', border: 'none', width: '22px', height: '22px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span style={{ color: '#f8fafc' }}>إجمالي الدينار</span><span style={{ color: '#facc15' }}>{Number(totalPrice).toFixed(2)} دينار</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span style={{ color: '#f8fafc' }}>إجمالي النقاط</span><span style={{ color: '#e9d5ff' }}>{Number(totalPoints).toFixed(2)} نقطة</span></div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowCartDropdown(false); handleInitiateCheckout(); }}
                    className="hz-checkout-btn"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}
                  >
                    إتمام الشراء
                  </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ), document.body)}
      </div>

      {currentUser && (
        <div className="hz-header-wallet" title="الرصيد والنقاط مخصصة للشراء داخل المتجر فقط">
          <div className="hz-header-balances">
            <span className="hz-balance-pill">🪙 {Number(currentUser.storeBalance || 0).toFixed(2)} د.أ</span>
            <span className="hz-loyalty-pill">⭐ {Number(currentUser.loyaltyPoints || 0)} نقطة</span>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); redeemStoreCredit(); }} className="hz-redeem-form">
            <input value={storeCreditCode} onChange={(e) => setStoreCreditCode(e.target.value.toUpperCase())} placeholder="كود بطاقة الرصيد" maxLength={23} />
            <button type="submit" disabled={redeemingStoreCredit || !storeCreditCode.trim()}>{redeemingStoreCredit ? '...' : 'استبدال'}</button>
          </form>
        </div>
      )}

      {currentUser ? (
        <div style={{ ...glassBtn, display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px', borderRadius: '14px' }}>
          <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{String(currentUser.name || currentUser.email || 'مستخدم')}</span>
          <span style={{
            fontSize: '10px',
            color: safeUserRoleInfo.color || '#94a3b8',
            background: safeUserRoleInfo.bg || 'rgba(148,163,184,0.15)',
            border: `1px solid ${safeUserRoleInfo.border || '#64748b'}`,
            padding: '2px 8px',
            borderRadius: '999px',
            fontWeight: 'bold'
          }}>
            الحالة: {safeUserRoleInfo.label || 'ضيف'}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="hz-logout-btn"
            style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(220,38,38,0.9))', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
          >
            تسجيل الخروج 🚪
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '10px',
            color: safeUserRoleInfo.color || '#94a3b8',
            background: safeUserRoleInfo.bg || 'rgba(148,163,184,0.15)',
            border: `1px solid ${safeUserRoleInfo.border || '#64748b'}`,
            padding: '3px 10px',
            borderRadius: '999px',
            fontWeight: 'bold'
          }}>
            الحالة: {safeUserRoleInfo.label || 'ضيف'}
          </span>
          <button
            type="button"
            onClick={() => setShowLoginPage(true)}
            style={{ ...glassBtn, color: '#fff', padding: '10px 18px', borderRadius: '14px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
            className="hz-admin-btn"
          >
            تسجيل الدخول 👤
          </button>
        </div>
      )}

      {isStaffUser && typeof onOpenDashboard === 'function' && (
        <button
          type="button"
          onClick={onOpenDashboard}
          style={{ ...glassBtn, color: '#c4b5fd', padding: '10px 18px', borderRadius: '14px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)' }}
          className="hz-admin-btn"
        >
          لوحة التحكم ⚙️
        </button>
      )}
    </div>
  );
}

export function CheckoutForm({ authCart, inputStyle = {} }) {
  const safeAuthCart = authCart && typeof authCart === 'object' ? authCart : {};
  const {
    checkoutMode = false,
    currentUser = null,
    cart = [],
    updateCartItemPlayerId = () => {},
    totalPrice = 0,
    loyaltyPointsCost = 0,
    submittingCheckout = false,
    handleCheckout = () => {},
    setCheckoutMode = () => {},
    paymentMethod = '',
    setPaymentMethod = () => {},
    couponCode = '',
    setCouponCode = () => {},
    appliedCoupon = null,
    setAppliedCoupon = () => {},
    couponSubmitting = false,
    applyCoupon = async () => ({ success: false, error: 'تعذر تطبيق الكوبون.' }),
    finalTotal = totalPrice
  } = safeAuthCart;
  const activeMethods = getActivePaymentMethods();

  if (!checkoutMode) return null;

  const safeCart = Array.isArray(cart) ? cart : [];

  return (
    <form className="hz-checkout-form" onSubmit={handleCheckout} style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(11, 15, 25, 0.95))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.4)', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 25px 50px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '22px', fontWeight: 'bold', boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)' }}>+</div>
        <div>
          <h3 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '18px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>🧾 مراجعة الطلب وتأكيد التسليم الرقمي</h3>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>
            التسليم رقمي بالكامل عبر البريد: <span style={{ color: '#38bdf8' }}>{String(currentUser?.email || 'غير متوفر')}</span>
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)', color: '#fde68a', fontSize: '12px' }}>
          رصيد المتجر: <strong>{Number(currentUser?.storeBalance || 0).toFixed(2)} دينار</strong><br /><span style={{ color: '#94a3b8' }}>للشراء فقط، غير قابل للسحب</span>
        </div>
        <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', color: '#ddd6fe', fontSize: '12px' }}>
          نقاط الولاء: <strong>{Number(currentUser?.loyaltyPoints || 0)}</strong> / {Number(currentUser?.loyaltyThreshold || 100)}<br /><span style={{ color: '#94a3b8' }}>نقاط المكافأة عند الشراء يحددها المتجر لكل منتج — وسعر الشراء بالنقاط يحدد يدويًا أيضًا</span>
        </div>
        {Number(loyaltyPointsCost) > 0 && <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)', color: '#e9d5ff', fontSize: '12px' }}>
          تكلفة المنتجات بالنقاط: <strong>{Number(loyaltyPointsCost)} نقطة</strong>
        </div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {safeCart.map((item, idx) => {
          const itemId = item.id || item._id || idx;
          return (
            <div key={itemId} style={{ background: 'rgba(11, 15, 25, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{item.name} (×{item.quantity})</span>
                {item.loyaltyOnly ? <span style={{ color: '#e9d5ff', fontWeight: 'bold' }}>⭐ {Number(item.loyaltyPrice || 0) * (item.quantity || 1)} نقطة</span> : <span style={{ color: '#facc15', fontWeight: 'bold' }}>{(item.price || 0) * (item.quantity || 1)} دينار</span>}
              </div>

              {item.deliveryType === 'id_topup' && (
                <input
                  type="text"
                  placeholder="أدخل آيدي اللاعب لهذا المنتج..."
                  value={item.playerId || ''}
                  onChange={(e) => updateCartItemPlayerId(itemId, e.target.value)}
                  required
                  style={{ background: '#0b0f19', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none', ...(inputStyle || {}) }}
                />
              )}

              {(item.deliveryType === 'code' || item.deliveryType === 'subscription') && (
                <span style={{ color: '#38bdf8', fontSize: '12px' }}>📦 كود جاهز — يُسلَّم فوراً بعد التأكيد</span>
              )}
              {item.deliveryType === 'store_credit' && (
                <span style={{ color: '#facc15', fontSize: '12px' }}>🪙 يمكنك دفع هذه البطاقة من رصيد المتجر، وسيتم توليد كود جديد تلقائياً بعد التأكيد.</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', flexWrap: 'wrap', padding: '12px', borderRadius: '12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
        <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="أدخل كود الخصم من قسم الكوبونات" disabled={Boolean(appliedCoupon) || couponSubmitting} style={{ flex: '1 1 220px', minWidth: 0, background: '#0b0f19', border: '1px solid rgba(56,189,248,0.35)', padding: '11px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none', ...(inputStyle || {}) }} />
        {appliedCoupon ? (
          <button type="button" onClick={() => { setCouponCode(''); setAppliedCoupon(null); }} style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>إزالة الكوبون</button>
        ) : (
          <button type="button" disabled={couponSubmitting} onClick={async () => { const result = await applyCoupon(); if (!result.success) alert(result.error); }} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', cursor: couponSubmitting ? 'wait' : 'pointer', fontWeight: 'bold' }}>{couponSubmitting ? 'جاري التحقق...' : 'تطبيق الكود'}</button>
        )}
        {appliedCoupon && <span style={{ width: '100%', color: '#6ee7b7', fontSize: '12px' }}>✅ تم تطبيق خصم {Number(appliedCoupon.discount || 0).toFixed(2)} دينار</span>}
      </div>

      {activeMethods.length > 0 && (
        <div>
          <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>💳 اختر طريقة الدفع</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
            {activeMethods.map(m => {
              const selected = paymentMethod === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className="hz-pay-card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'right', cursor: 'pointer',
                    padding: '14px', borderRadius: '14px', color: '#f8fafc',
                    background: selected ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(5, 150, 105, 0.08))' : 'rgba(11, 15, 25, 0.75)',
                    border: selected ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: selected ? '0 0 0 4px rgba(16, 185, 129, 0.12)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '26px' }}>{m.icon || '💳'}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 'bold', fontSize: '14px' }}>{m.name}</span>
                    {m.description && <span style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{m.description}</span>}
                  </span>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    border: selected ? '6px solid #10b981' : '2px solid #475569', background: selected ? '#fff' : 'transparent',
                    transition: 'all 0.2s ease'
                  }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {Number(currentUser?.storeBalance || 0) >= Number(finalTotal || 0) && Number(finalTotal || 0) > 0 && (
        <button type="button" onClick={() => setPaymentMethod(paymentMethod === 'store_balance' ? '' : 'store_balance')} style={{ padding: '12px', borderRadius: '12px', textAlign: 'right', color: '#f8fafc', cursor: 'pointer', background: paymentMethod === 'store_balance' ? 'rgba(250,204,21,0.18)' : 'rgba(11,15,25,0.75)', border: paymentMethod === 'store_balance' ? '2px solid #facc15' : '1px solid rgba(250,204,21,0.35)' }}>
          🪙 الدفع بالدينار من رصيد المتجر — {Number(finalTotal).toFixed(2)} د.أ <small style={{ color: '#fde68a' }}>(1 رصيد = 1 دينار للشراء)</small>
        </button>
      )}

      {Number(finalTotal || 0) > 0 && activeMethods.length === 0 && paymentMethod !== 'store_balance' && (
        <div role="status" style={{ padding: '12px 14px', borderRadius: '12px', color: '#fde68a', background: 'rgba(120,53,15,0.22)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '13px', lineHeight: 1.7 }}>
          ⚠️ لا توجد بوابة دفع إلكترونية مفعّلة حالياً. اختر الدفع من رصيد المتجر إذا كان رصيدك كافياً، أو أعد المحاولة بعد ربط بوابة دفع آمنة.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
        <span style={{ color: '#f8fafc' }}>الإجمالي</span>
        <span style={{ color: '#facc15', fontSize: '18px' }}>{appliedCoupon && <s style={{ color: '#94a3b8', fontSize: '13px', marginLeft: '8px' }}>{Number(totalPrice).toFixed(2)}</s>}{Number(finalTotal).toFixed(2)} دينار</span>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="submit" disabled={submittingCheckout || (Number(finalTotal || 0) > 0 && activeMethods.length === 0 && paymentMethod !== 'store_balance')} className="hz-checkout-btn" style={{ flex: 1, background: submittingCheckout ? '#065f46' : 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', cursor: submittingCheckout ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)' }}>
          {submittingCheckout ? 'جاري تأكيد الطلب...' : (activeMethods.length > 0 ? `ادفع ${Number(finalTotal).toFixed(2)} دينار واستلم أكوادك 🔓` : 'تأكيد الطلب والتسليم الرقمي 🛒')}
        </button>
        <button type="button" onClick={() => setCheckoutMode(false)} className="hz-cancel-btn" style={{ background: 'linear-gradient(135deg, #4b5563, #374151)', color: '#fff', border: 'none', padding: '14px 22px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

const RECEIPT_STYLES = `
  @keyframes hzRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes hzPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes hzDraw { to { stroke-dashoffset: 0; } }
  @keyframes hzPulseRing { 0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 50% { box-shadow: 0 0 0 14px rgba(16, 185, 129, 0); } }
  @keyframes hzSpark { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; } }
  .hz-rc-item { animation: hzRise 0.55s ease both; }
  .hz-rc-btn { transition: all 0.2s ease; }
  .hz-rc-btn:hover { transform: translateY(-2px); filter: brightness(1.12); }
  .hz-rc-code:hover { border-color: rgba(52, 211, 153, 0.7) !important; }
  .hz-pay-card:hover { border-color: rgba(16, 185, 129, 0.6) !important; transform: translateY(-1px); }
`;

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }
}

function CopyButton({ text, label = 'نسخ', doneLabel = 'تم النسخ ✓', style = {} }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="hz-rc-btn"
      onClick={async () => {
        const ok = await copyToClipboard(String(text));
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }
      }}
      style={{
        background: copied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.12)',
        color: copied ? '#34d399' : '#38bdf8',
        border: `1px solid ${copied ? 'rgba(52, 211, 153, 0.5)' : 'rgba(56, 189, 248, 0.35)'}`,
        padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
        ...style
      }}
    >
      {copied ? doneLabel : label}
    </button>
  );
}

// تأثير "فك التشفير" عند ظهور الكود؛ النص النهائي والمنسوخ دائماً هو الكود الحقيقي
function ScrambleText({ text }) {
  const real = String(text);
  const [out, setOut] = useState(() => real.replace(/[A-Za-z0-9]/g, '•'));
  useEffect(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const total = 18;
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      const reveal = Math.floor((frame / total) * real.length);
      setOut(real.split('').map((c, i) => (i < reveal || !/[A-Za-z0-9]/.test(c) ? c : chars[Math.floor(Math.random() * chars.length)])).join(''));
      if (frame >= total) {
        clearInterval(id);
        setOut(real);
      }
    }, 45);
    return () => clearInterval(id);
  }, [real]);
  return <>{out}</>;
}

const SPARKS = [
  { dx: '-46px', dy: '-38px', c: '#facc15', d: '0s' }, { dx: '44px', dy: '-42px', c: '#38bdf8', d: '0.05s' },
  { dx: '-58px', dy: '4px', c: '#34d399', d: '0.1s' }, { dx: '60px', dy: '6px', c: '#f472b6', d: '0.15s' },
  { dx: '-38px', dy: '44px', c: '#38bdf8', d: '0.2s' }, { dx: '40px', dy: '46px', c: '#facc15', d: '0.25s' },
  { dx: '0px', dy: '-62px', c: '#34d399', d: '0.3s' }, { dx: '0px', dy: '62px', c: '#f472b6', d: '0.35s' },
];

function OrderReceipt({ order, onClose }) {
  const [showCodes, setShowCodes] = useState(true);
  const items = Array.isArray(order.items) ? order.items : [];
  const orderNumber = order.orderNumber || order.orderId || order.id || order._id || '';
  const paymentLabel = order.paymentMethodName || order.paymentMethod || '';
  const paid = Boolean(paymentLabel);
  let dateText = '';
  if (order.createdAt || order.date) {
    const d = new Date(order.createdAt || order.date);
    if (!Number.isNaN(d.getTime())) dateText = d.toLocaleString('ar-JO');
  }

  const allCodesText = items
    .filter(it => Array.isArray(it.deliveredCodes) && it.deliveredCodes.length > 0)
    .map(it => `${it.name}${it.quantity > 1 ? ` (×${it.quantity})` : ''}\n${it.deliveredCodes.join('\n')}`)
    .join('\n\n');

  const infoBox = (label, value, copyable) => (
    <div style={{ background: 'rgba(11, 15, 25, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{label}</span>
      <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '13px', wordBreak: 'break-all' }}>{value}</span>
      {copyable && <CopyButton text={value} label="نسخ الرقم" style={{ alignSelf: 'flex-start', marginTop: '4px' }} />}
    </div>
  );

  return (
    <div className="hz-order-receipt" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(11, 15, 25, 0.98))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.5)', marginBottom: '25px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.12)' }} dir="rtl">
      <style>{RECEIPT_STYLES}</style>

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '76px', height: '76px', margin: '0 auto 12px' }}>
          {SPARKS.map((sp, i) => (
            <span key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: '7px', height: '7px', borderRadius: '50%', background: sp.c, '--dx': sp.dx, '--dy': sp.dy, animation: `hzSpark 0.9s ease-out ${sp.d} both` }} />
          ))}
          <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'hzPop 0.6s ease both, hzPulseRing 2s ease-in-out 0.6s 2' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: 'hzDraw 0.5s ease 0.35s forwards' }} />
            </svg>
          </div>
        </div>
        <h3 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '20px' }}>{paid ? '🎉 تم الدفع بنجاح' : '✅ تم تأكيد طلبك بنجاح'}</h3>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>أكوادك جاهزة بالأسفل، وتقدر تنسخها بضغطة وحدة</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '18px' }}>
        {orderNumber && infoBox('رقم الطلب', String(orderNumber), true)}
        {dateText && infoBox('التاريخ', dateText)}
        {paid && infoBox('طريقة الدفع', String(paymentLabel))}
        {infoBox('الإجمالي', `${order.totalAmount} دينار`)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {items.map((item, idx) => {
          const codes = Array.isArray(item.deliveredCodes) ? item.deliveredCodes : [];
          return (
            <div key={idx} className="hz-rc-item" style={{ animationDelay: `${0.15 * idx}s`, background: 'rgba(11, 15, 25, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: '#f8fafc', fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>
                <span>{item.name} (×{item.quantity})</span>
                {item.price !== undefined && <span style={{ color: '#facc15' }}>{(Number(item.price) || 0) * (Number(item.quantity) || 1)} دينار</span>}
              </div>

              {item.playerId && (
                <div style={{ color: '#38bdf8', fontSize: '13px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '9px 12px' }}>
                  🆔 تمت تعبئة الآيدي: <strong>{item.playerId}</strong>
                </div>
              )}

              {codes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {codes.map((code, cIdx) => (
                    <div key={cIdx} className="hz-rc-code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#020617', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '10px', padding: '10px 12px', transition: 'border-color 0.2s ease' }}>
                      <code dir="ltr" style={{ flex: 1, color: '#34d399', fontSize: '14px', letterSpacing: '1.5px', fontFamily: 'ui-monospace, Consolas, monospace', background: 'transparent', padding: 0, wordBreak: 'break-all', filter: showCodes ? 'none' : 'blur(7px)', userSelect: showCodes ? 'text' : 'none', transition: 'filter 0.25s ease' }}>
                        <ScrambleText text={code} />
                      </code>
                      <CopyButton text={code} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        {allCodesText && <CopyButton text={allCodesText} label="📋 نسخ كل الأكواد" doneLabel="تم نسخ الكل ✓" style={{ padding: '10px 16px', fontSize: '13px' }} />}
        {allCodesText && (
          <button type="button" className="hz-rc-btn" onClick={() => setShowCodes(v => !v)} style={{ background: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.3)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            {showCodes ? '🙈 إخفاء الأكواد' : '👁️ إظهار الأكواد'}
          </button>
        )}
      </div>

      <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: '0 0 6px 0' }}>📧 تم إرسال نسخة من هذه التفاصيل إلى بريدك الإلكتروني أيضاً.</p>
      <p style={{ color: '#fbbf24', fontSize: '12.5px', margin: '0 0 16px 0' }}>🔒 احتفظ بأكوادك ولا تشاركها مع أي شخص.</p>

      <button type="button" onClick={onClose} className="hz-continue-btn hz-rc-btn" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
        متابعة التسوق
      </button>
    </div>
  );
}

export function OrderConfirmation({ authCart }) {
  const safeAuthCart = authCart && typeof authCart === 'object' ? authCart : {};
  const { lastOrder = null, setLastOrder = () => {}, setCheckoutMode = () => {} } = safeAuthCart;

  if (!lastOrder) return null;

  return <OrderReceipt order={lastOrder} onClose={() => { setLastOrder(null); setCheckoutMode(false); }} />;
}

export function EmailVerificationBanner({ authCart }) {
  const safeAuthCart = authCart && typeof authCart === 'object' ? authCart : {};
  const { currentUser = null, handleResendVerification = () => {}, resendVerificationSubmitting = false } = safeAuthCart;
  const [sent, setSent] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (!currentUser || currentUser.emailVerified !== false) return null;

  const resend = async () => {
    if (!currentUser.email || typeof handleResendVerification !== 'function') return;
    const res = await handleResendVerification(currentUser.email);
    if (res && res.success && isMounted.current) {
      setSent(true);
    }
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(51, 42, 26, 0.9), rgba(30, 24, 15, 0.95))', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fcd34d', padding: '14px 20px', borderRadius: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '13px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      <span>⚠️ حسابك غير مفعّل بعد. تحقق من بريدك الإلكتروني لتفعيله.</span>
      {sent ? (
        <span style={{ color: '#a7f3d0', fontWeight: 'bold' }}>تم إرسال الرابط ✅</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={resendVerificationSubmitting}
          className="hz-resend-btn"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '10px', cursor: resendVerificationSubmitting ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)' }}
        >
          {resendVerificationSubmitting ? 'جاري الإرسال...' : 'إعادة إرسال رابط التفعيل'}
        </button>
      )}
    </div>
  );
}
