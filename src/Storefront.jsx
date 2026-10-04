import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useApp } from './app/AppContext';
import LoginPage from './app/LoginPage';
import { useProducts, ProductSearchBar, ProductGrid } from './StoreProducts';
import SupportSection from './SupportSection';
import { useAuthCart, HeaderControls, CheckoutForm, OrderConfirmation, ResetPasswordPage } from './AuthCartCheckout';

const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const API_BASE_URL = isLocal ? 'http://localhost:4000/api' : '/api';
const SOCKET_URL = isLocal ? 'http://localhost:4000' : window.location.origin;

const GLASS_STYLE = `
  /* ✅ إصلاح السكرول: overflow-x:hidden على html و body معاً كان يحوّل body لحاوية سكرول ثانية */
  html { margin: 0; padding: 0; background: #05060a; -webkit-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; background: #05060a; overflow-x: clip; overscroll-behavior-x: none; }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hz-product-card {
    --glow: #10b981;
    position: relative;
    background:
      radial-gradient(130% 65% at 12% 0%, rgba(255,255,255,0.38), transparent 55%),
      linear-gradient(155deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 55%);
    backdrop-filter: blur(26px) saturate(200%);
    -webkit-backdrop-filter: blur(26px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 18px;
    padding: 16px;
    overflow: hidden;
    transition: transform 0.35s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.35s ease, border-color 0.3s ease;
    box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .hz-product-card::before {
    content: '';
    position: absolute; inset: -50% -50% auto -50%; height: 220%;
    background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.16) 50%, transparent 58%);
    transform: translateX(-65%);
    transition: transform 0.7s ease;
    pointer-events: none;
    z-index: 3;
  }
  .hz-product-card:hover::before { transform: translateX(65%); }
  .hz-product-card:hover {
    transform: translateY(-10px) scale(1.015);
    border-color: var(--glow);
    box-shadow: 0 30px 60px rgba(0,0,0,0.55), 0 0 45px color-mix(in srgb, var(--glow) 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.4);
  }

  .hz-product-media { position: absolute; inset: 0; z-index: 0; }
  .hz-product-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s ease; }
  .hz-product-card:hover .hz-product-media img { transform: scale(1.08); }
  .hz-product-media::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(5,6,10,0.15) 0%, rgba(5,6,10,0.55) 55%, rgba(5,6,10,0.92) 100%);
  }
  .hz-product-media.hz-no-image {
    background: radial-gradient(130% 90% at 30% 10%, rgba(16,185,129,0.25), transparent 60%), linear-gradient(155deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 60%);
  }
  .hz-product-media.hz-no-image::after { background: none; }
  .hz-product-body { position: relative; z-index: 2; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px; }
  .hz-product-glasschip { background: rgba(15,20,30,0.45); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.18); }

  .hz-category-glass-bar {
    background: radial-gradient(130% 65% at 12% 0%, rgba(255,255,255,0.25), transparent 60%), rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(24px) saturate(190%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px; padding: 12px 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px;
  }
  .hz-category-chip {
    background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12); color: #cbd5e1;
    padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .hz-category-chip:hover { background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.4); color: #f8fafc; transform: translateY(-2px); }
  .hz-category-chip.active {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.4), rgba(59, 130, 246, 0.25));
    border-color: rgba(96, 165, 250, 0.6); color: #fff; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
  }
  .hz-header-wallet { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .hz-header-balances { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .hz-header-balances span { display: inline-flex; align-items: center; white-space: nowrap; padding: 5px 8px; border-radius: 9px; font-size: 11px; font-weight: 700; }
  .hz-balance-pill { color: #fde68a; background: rgba(250,204,21,0.12); border: 1px solid rgba(250,204,21,0.35); }
  .hz-loyalty-pill { color: #e9d5ff; background: rgba(168,85,247,0.14); border: 1px solid rgba(168,85,247,0.35); }
  .hz-redeem-form { display: flex; align-items: center; gap: 5px; }
  .hz-redeem-form input { width: 130px; background: rgba(11,15,25,0.7); border: 1px solid rgba(250,204,21,0.35); border-radius: 8px; padding: 6px 8px; color: #fff; font-size: 11px; }
  .hz-redeem-form button { background: #a16207; color: #fff; border: none; border-radius: 8px; padding: 6px 8px; cursor: pointer; font-size: 11px; }

  .hz-glass-card {
    position: relative;
    background: radial-gradient(130% 65% at 12% 0%, rgba(255,255,255,0.38), transparent 55%), linear-gradient(155deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 55%);
    backdrop-filter: blur(26px) saturate(200%); border: 1px solid rgba(255,255,255,0.2); border-radius: 18px; padding: 18px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .hz-glass-btn {
    background: radial-gradient(120% 100% at 20% 0%, rgba(255,255,255,0.18), transparent 60%), rgba(17,24,39,0.5);
    backdrop-filter: blur(22px); border: 1px solid rgba(255,255,255,0.2);
    transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .hz-glass-btn:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.4); box-shadow: 0 10px 24px rgba(0,0,0,0.5); }
  .hz-atmosphere {
    background:
      radial-gradient(ellipse 800px 500px at 10% -5%, rgba(249,115,22,0.38), transparent 55%),
      radial-gradient(ellipse 700px 500px at 95% 0%, rgba(56,189,248,0.35), transparent 55%),
      radial-gradient(ellipse 900px 600px at 50% 105%, rgba(168,85,247,0.30), transparent 55%),
      radial-gradient(ellipse 500px 350px at 25% 55%, rgba(16,185,129,0.20), transparent 60%),
      #05060a;
  }

  /* ================= إصلاحات الأداء (بدون أي تغيير بالشكل) ================= */
  /* بطاقة فيها صورة: الصورة تغطيها بالكامل، فالبلور تحتها مش ظاهر أصلاً → نوقفه (الشكل نفسه تماماً) */
  .hz-product-card.hz-has-img { backdrop-filter: none; -webkit-backdrop-filter: none; }
  /* زر "أضف للسلة": خلفيته خضراء معتمة، فالبلور فيه مش ظاهر */
  .hz-add-btn { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  /* لا نستخدم content-visibility هنا لأنه يسبب قفزات وتعليقاً في بعض متصفحات الهاتف أثناء التمرير */
  .hz-grid { min-width: 0; touch-action: pan-y; overscroll-behavior-y: contain; }
  .hz-product-card { min-width: 0; touch-action: pan-y; }
  /* شات البوت: بلور داخل بلور (الخلفية تحته نفس اللون) → ما بيظهر فرق بس بيكلّف كتير */
  .hz-bot-inner-panel, .hz-bot-bubble-user, .hz-bot-bubble-bot, .hz-bot-input {
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
  /* على اللمس: hover بيعلق ويسبب لاج، فنلغي حركته فقط (على الماوس يبقى كما هو) */
  @media (hover: none), (pointer: coarse) {
    .hz-product-card::before { display: none; }
    .hz-product-card:hover { transform: none; border-color: rgba(255,255,255,0.2); box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3); }
    .hz-product-card:hover .hz-product-media img { transform: none; }
    .hz-glass-btn:hover, .hz-category-chip:hover { transform: none; }
  }

  /* ================= تجاوب الأبعاد مع كل الأجهزة ================= */
  .hz-container { width: 100%; max-width: 1440px; min-width: 0; margin: 0 auto; }
  .hz-grid {
    display: grid; width: 100%; box-sizing: border-box;
    grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
    gap: clamp(12px, 2vw, 24px);
  }
  /* موبايل */
  @media (max-width: 559px) {
    .hz-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%; }
    .hz-category-glass-bar { padding: 12px; border-radius: 16px; }
    /* بطاقات مضغوطة عشان تكفي عمودين جنب بعض بالموبايل */
    .hz-product-card { border-radius: 18px; }
    .hz-product-body { padding: 12px !important; min-height: 190px; }
    .hz-product-body h3 { font-size: 13px !important; line-height: 1.3; margin-bottom: 6px !important;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .hz-product-body p { font-size: 11px !important; margin-bottom: 8px !important;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .hz-product-glasschip { font-size: 10px !important; padding: 3px 7px !important; }
    .hz-price-row { flex-wrap: wrap; gap: 8px !important; margin-top: 8px !important; padding-top: 10px !important; }
    .hz-price-row .hz-add-btn { width: 100%; padding: 8px 6px !important; font-size: 12px !important; }
    .hz-root input, .hz-root textarea, .hz-root select { font-size: 16px !important; }
    .hz-header-wallet { width: 100%; justify-content: center; order: 3; }
    .hz-redeem-form input { width: 120px; }
  }
  /* تابلت / آيباد */
  @media (min-width: 560px) and (max-width: 1023px) { .hz-grid { grid-template-columns: repeat(3, 1fr); } }
  /* لابتوب */
  @media (min-width: 1024px) and (max-width: 1439px) { .hz-grid { grid-template-columns: repeat(3, 1fr); } }
  /* كمبيوتر */
  @media (min-width: 1440px) and (max-width: 1919px) { .hz-grid { grid-template-columns: repeat(4, 1fr); } }
  /* شاشات كبيرة / تلفزيون / بلايستيشن */
  @media (min-width: 1920px) { .hz-root { zoom: 1; } .hz-grid { grid-template-columns: repeat(5, 1fr); } }
  @media (min-width: 2560px) { .hz-root { zoom: 1; } .hz-grid { grid-template-columns: repeat(6, 1fr); } }
  /* أزرار مريحة للمس */
  @media (pointer: coarse) { .hz-category-chip, .hz-add-btn, .hz-root button { min-height: 44px; } }
  /* تركيز واضح للكيبورد والريموت */
  .hz-root button:focus-visible, .hz-root input:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
`;

export default function Storefront({ inputStyle = {}, onOpenDashboard = () => {} }) {
  const { token, products: globalProducts, setProducts: setGlobalProducts, globalEventBus, handleForgotPasswordRequest: globalForgot, forgotPasswordSent, forgotPasswordSubmitting, loginError } = useApp();
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const socketRef = useRef(null);

  const [trackerOrderId, setTrackerOrderId] = useState('');
  const [orderStatusResult, setOrderStatusResult] = useState(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [sensitiveSyncStatus, setSensitiveSyncStatus] = useState('متصل وآمن 🔒');

  const api = useMemo(() => {
    try {
      const safeToken = typeof token === 'string' ? token.trim() : '';
      return axios.create({
        baseURL: API_BASE_URL,
        timeout: 10000,
        headers: safeToken ? { 'Authorization': `Bearer ${safeToken}` } : {}
      });
    } catch (e) {
      return axios.create({ baseURL: API_BASE_URL, timeout: 10000 });
    }
  }, [token]);

  const { products: localProducts, loading, searchTerm, setSearchTerm, fetchProducts } = useProducts({ api, setError });

  const products = useMemo(() => {
    return (globalProducts && globalProducts.length > 0) ? globalProducts : localProducts;
  }, [globalProducts, localProducts]);

  const authCart = useAuthCart({ api, fetchProducts, searchTerm, setError });

  // 🔄 WebSocket & Global Event Bus Integration
  useEffect(() => {
    const safeToken = typeof token === 'string' ? token.trim() : '';

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // ✅ fallback للـ polling
      auth: { token: safeToken },
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('UPDATE_DATA', (data) => {
      if (data && (data.type === 'PRODUCTS' || data.type === 'REFRESH_ALL')) {
        if (typeof fetchProducts === 'function') fetchProducts();
      }
    });

    socket.on('PRODUCT_UPDATED', () => {
      if (typeof fetchProducts === 'function') fetchProducts();
    });

    socket.on('PRODUCT_DELETED', () => {
      if (typeof fetchProducts === 'function') fetchProducts();
    });

    socket.on('SENSITIVE_DATA_UPDATED', () => {
      setSensitiveSyncStatus('⚡ تم مزامنة الملفات الحساسة لحظياً');
      if (typeof fetchProducts === 'function') fetchProducts();
      setTimeout(() => setSensitiveSyncStatus('متصل وآمن 🔒'), 3000);
    });

    socket.on('ADMIN_SYNC', () => {
      if (typeof fetchProducts === 'function') fetchProducts();
    });

    let unsubscribeBus = () => {};
    if (globalEventBus && typeof globalEventBus.subscribe === 'function') {
      unsubscribeBus = globalEventBus.subscribe('GLOBAL_SYNC_EVENT', (payload) => {
        if (payload && payload.key === 'products' && Array.isArray(payload.value)) {
          if (typeof setGlobalProducts === 'function') {
            setGlobalProducts(payload.value);
          }
        }
      });
    }

    return () => {
      socket.disconnect();
      unsubscribeBus();
    };
  }, [fetchProducts, token, globalEventBus, setGlobalProducts]);

  const categories = useMemo(() => {
    const set = new Set(['all']);
    if (Array.isArray(products)) {
      products.forEach(p => {
        const statusVal = String(p.status || '').toLowerCase();
        const isPub = p.isPublished === true || p.published === true || p.isPublished === undefined && p.published === undefined;
        const isNotDraftOrUnpublished = statusVal !== 'unpublished' && statusVal !== 'draft' && statusVal !== 'inactive';

        const isPublished = (isPub || statusVal === 'active' || statusVal === 'published') && isNotDraftOrUnpublished;

        if (isPublished && p.category) {
          const cleanCat = String(p.category).trim();
          if (cleanCat) set.add(cleanCat);
        }
      });
    }
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter(p => {
      const statusVal = String(p.status || '').toLowerCase();
      const isPub = p.isPublished === true || p.published === true || p.isPublished === undefined && p.published === undefined;
      const isNotDraftOrUnpublished = statusVal !== 'unpublished' && statusVal !== 'draft' && statusVal !== 'inactive';

      const isPublished = (isPub || statusVal === 'active' || statusVal === 'published') && isNotDraftOrUnpublished;

      if (!isPublished) return false;
      if (selectedCategory === 'all') return true;

      return String(p.category || '').trim() === String(selectedCategory).trim();
    });
  }, [products, selectedCategory]);

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    if (!trackerOrderId.trim()) return;
    setTrackerLoading(true);
    setOrderStatusResult(null);
    try {
      const res = await api.get(`/orders/${trackerOrderId.trim()}`);
      setOrderStatusResult(res.data);
    } catch (err) {
      setOrderStatusResult({ error: 'لم يتم العثور على طلب بهذا الرقم، تأكد من البيانات المدخلة.' });
    } finally {
      setTrackerLoading(false);
    }
  };

  const resetParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const resetEmail = resetParams?.get('email') || '';
  const resetToken = resetParams?.get('token') || '';
  if (typeof window !== 'undefined' && window.location.pathname === '/reset-password' && resetEmail && resetToken) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f19', padding: '20px', boxSizing: 'border-box' }} dir="rtl">
        <ResetPasswordPage authCart={authCart} email={resetEmail} token={resetToken} />
      </div>
    );
  }

  if (authCart && authCart.showLoginPage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#0b0f19', padding: '20px', boxSizing: 'border-box' }} dir="rtl">
        {!authCart.showForgotPassword ? (
          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <LoginPage
              onLoginSuccess={() => authCart.setShowLoginPage(false)}
              authCart={authCart}
            />
            <button
              type="button"
              onClick={() => { if (typeof authCart.setShowForgotPassword === 'function') authCart.setShowForgotPassword(true); }}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '13px', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold' }}
            >
              نسيت كلمة المرور؟ 🔄
            </button>
          </div>
        ) : (
          <div className="hz-glass-card" style={{ padding: '30px', width: '100%', maxWidth: '420px', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '18px' }}>🔄 استعادة كلمة المرور الفورية</h3>
            {forgotPasswordSent ? (
              <div>
                <p style={{ color: '#34d399', fontSize: '13px', lineHeight: '1.6' }}>✅ تم إرسال رابط حقيقي وفعلي لإعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.</p>
                <button
                  onClick={() => {
                    if (typeof authCart.setShowForgotPassword === 'function') authCart.setShowForgotPassword(false);
                  }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', width: '100%', marginTop: '15px', fontWeight: 'bold' }}
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const emailInput = e.target.elements.resetEmail ? e.target.elements.resetEmail.value : '';
                    if (typeof globalForgot === 'function') {
                      await globalForgot(emailInput);
                    } else if (typeof authCart.handleForgotPasswordRequest === 'function') {
                      await authCart.handleForgotPasswordRequest(emailInput);
                    }
                  } catch (err) { console.error(err); }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}
              >
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', lineHeight: '1.5' }}>أدخل بريدك الإلكتروني المسجل لنرسل لك رسالة حقيقية لاستعادة الحساب بكامل الأمان والشكل الزجاجي.</p>
                {loginError && (
                  <div style={{ color: '#fca5a5', background: 'rgba(127, 29, 29, 0.4)', border: '1px solid #ef4444', borderRadius: '10px', padding: '10px', fontSize: '12px' }}>
                    {loginError}
                  </div>
                )}
                <input type="email" name="resetEmail" placeholder="البريد الإلكتروني..." required
                  style={{ background: 'rgba(11, 15, 25, 0.6)', border: '1px solid rgba(255,255,255,0.2)', padding: '14px', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button type="submit" disabled={forgotPasswordSubmitting}
                    style={{ flex: 1, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {forgotPasswordSubmitting ? 'جاري الإرسال الفعلي...' : 'إرسال البريد الحقيقي 📧'}
                  </button>
                  <button type="button"
                    onClick={() => { if (typeof authCart.setShowForgotPassword === 'function') authCart.setShowForgotPassword(false); }}
                    style={{ background: 'rgba(75, 85, 99, 0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '14px 18px', borderRadius: '12px', cursor: 'pointer' }}>
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hz-atmosphere hz-root" style={{
      width: '100%',
      minHeight: '100dvh',
      padding: 'clamp(12px, 2vw, 24px)',
      paddingTop: 'max(clamp(12px, 2vw, 24px), env(safe-area-inset-top))',
      paddingBottom: 'max(clamp(12px, 2vw, 24px), env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
      color: '#f8fafc',
      fontFamily: 'Tajawal, sans-serif',
      margin: '0',
      position: 'relative'
    }} dir="rtl">

      <style>{GLASS_STYLE}</style>

      <div className="hz-container">

      <div className="hz-glass-btn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', marginBottom: '20px', borderRadius: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Hamza Store" style={{ width: '118px', height: 'auto', maxHeight: '52px', objectFit: 'contain', objectPosition: 'left center', display: 'block' }} />
          <span style={{ fontSize: '11px', padding: '3px 10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            {sensitiveSyncStatus}
          </span>
        </div>

        <HeaderControls authCart={authCart} onOpenDashboard={onOpenDashboard} />
      </div>

      <div style={{ width: '100%', marginBottom: '20px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(240, 192, 96, 0.35)', boxShadow: '0 18px 50px rgba(0, 0, 0, 0.35)', background: '#080b10' }}>
        <img src="/hero-banner.png" alt="Hamza Store - ألعاب وتقنية بلمسة فاخرة" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 'clamp(220px, 42vw, 520px)', objectFit: 'cover', objectPosition: 'center' }} />
      </div>

      <CheckoutForm authCart={authCart} inputStyle={inputStyle} />
      <OrderConfirmation authCart={authCart} />

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: 'clamp(19px, 3vw, 24px)', fontWeight: 'bold' }}>
          🛍️ متجر بطاقات الألعاب الرقمية السحابي
        </h2>
        <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>مرتبط كلياً بقنوات الآمان وتحديثات الملفات والبيانات الحساسة في جزء من الثانية عبر Global State Bus.</p>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <ProductSearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} inputStyle={inputStyle} />

      <div className="hz-category-glass-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 'bold', fontSize: '14px', marginLeft: '10px' }}>
          <span>🏷️</span>
          <span>الفئات والأقسام:</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const displayName = cat === 'all' ? 'جميع المنتجات 🌟' : cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`hz-category-chip ${isActive ? 'active' : ''}`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>جاري تحميل المنتجات السحابية...</div>
        ) : !filteredProducts.length ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>لا توجد منتجات متاحة في هذه الفئة حالياً.</div>
        ) : (
          <div className="hz-grid">
            {filteredProducts.map((product) => {
              const isOpenStoreCredit = product.deliveryType === 'store_credit';
              const stock = product.stock ?? product.quantity ?? 0;
              const originalPrice = Number(product.price ?? 0);

              const rawDiscount = product.discountPrice ?? product.salePrice ?? 0;
              const discountPrice = Number(rawDiscount);
              const hasDiscount = discountPrice > 0 && discountPrice < originalPrice;
              const displayPrice = hasDiscount ? discountPrice : originalPrice;
              const loyaltyPrice = Math.max(0, Number(product.loyaltyPrice || 0));

              const name = product.name || product.title || 'منتج رقمي';
              const imageUrl = product.image || product.imageUrl || product.img || product.photo || product.picture || '';

              return (
                <div
                  key={product._id || product.id}
                  className={`hz-product-card${imageUrl ? ' hz-has-img' : ''}`}
                  style={{ '--glow': '#10b981', padding: 0 }}
                >
                  <div className={`hz-product-media${imageUrl ? '' : ' hz-no-image'}`}>
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={name}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('hz-no-image'); }}
                      />
                    )}
                  </div>

                  <div className="hz-product-body" style={{ padding: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span className="hz-product-glasschip" style={{ fontSize: '11px', color: '#34d399', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                          المخزون: {isOpenStoreCredit ? 'مفتوح' : stock}
                        </span>
                        {hasDiscount && (
                          <span className="hz-product-glasschip" style={{ fontSize: '11px', color: '#f59e0b', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                            خصم 🔥
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: '#f8fafc', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                        {name}
                      </h3>
                      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
                        {product.description || 'بطاقة رقمية سحابية أصلية.'}
                      </p>
                    </div>

                    <div className="hz-price-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '15px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                          {displayPrice} دينار
                        </span>
                        {loyaltyPrice > 0 && <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e9d5ff' }}>أو ⭐ {loyaltyPrice} نقطة</span>}
                        {hasDiscount && (
                          <span style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through' }}>
                            {originalPrice} دينار
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => authCart && authCart.addToCart && authCart.addToCart({ ...product, price: displayPrice })}
                        className="hz-glass-btn hz-add-btn"
                        style={{
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '13px'
                        }}
                      >
                        أضف للسلة 🛒
                      </button>
                      {loyaltyPrice > 0 && (
                        <button
                          onClick={() => authCart && authCart.addToCart && authCart.addToCart({ ...product, price: 0, loyaltyOnly: true, loyaltyPrice })}
                          className="hz-glass-btn hz-add-btn"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          شراء بالنقاط ⭐
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ maxWidth: '600px', margin: '40px auto 20px auto' }}>
        <div className="hz-glass-card" style={{ padding: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <span style={{ fontSize: '20px' }}>📦</span>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '16px' }}>التحقق الفعلي من حالة طلبك</h3>
          </div>
          <p style={{ margin: '0 0 15px 0', color: '#94a3b8', fontSize: '12px' }}>أدخل رقم الطلب لجلب حالته من قاعدة البيانات مباشرة:</p>

          <form onSubmit={handleTrackOrder} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="أدخل رقم الطلب هنا..."
              value={trackerOrderId}
              onChange={(e) => setTrackerOrderId(e.target.value)}
              style={{
                flex: 1, background: 'rgba(11, 15, 25, 0.6)', border: '1px solid rgba(255,255,255,0.2)',
                padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={trackerLoading}
              className="hz-glass-btn"
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
            >
              {trackerLoading ? 'جاري البحث...' : 'بحث 🔍'}
            </button>
          </form>

          {orderStatusResult && (
            <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(15,23,42,0.7)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px' }}>
              {orderStatusResult.error ? (
                <span style={{ color: '#fca5a5' }}>{orderStatusResult.error}</span>
              ) : (
                <div>
                  <p style={{ margin: '0 0 6px 0', color: '#34d399', fontWeight: 'bold' }}>✅ حالة الطلب: {orderStatusResult.status || 'مكتمل'}</p>
                  {orderStatusResult.orderNumber && <p style={{ margin: '0 0 6px 0', color: '#cbd5e1' }}>رقم الطلب: <strong>{orderStatusResult.orderNumber}</strong></p>}
                  <p style={{ margin: 0, color: '#cbd5e1' }}>المبلغ: {orderStatusResult.totalAmount ?? orderStatusResult.price ?? 0} دينار</p>
                  {Array.isArray(orderStatusResult.items) && orderStatusResult.items.some((item) => Array.isArray(item.deliveredCodes) && item.deliveredCodes.length > 0) && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <strong style={{ color: '#34d399' }}>🔐 الأكواد الخاصة بطلبك:</strong>
                      {orderStatusResult.items.flatMap((item) => (Array.isArray(item.deliveredCodes) ? item.deliveredCodes.map((code, index) => (
                        <code key={`${item.id || item.name}-${index}`} dir="ltr" style={{ display: 'block', background: '#020617', color: '#34d399', padding: '9px 10px', borderRadius: '8px', wordBreak: 'break-all', letterSpacing: '1px' }}>{code}</code>
                      )) : []))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <SupportSection api={api} currentUser={authCart && authCart.currentUser} inputStyle={inputStyle} />
      </div>

      </div>
    </div>
  );
}
