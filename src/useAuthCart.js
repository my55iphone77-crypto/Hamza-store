import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from './app/AppContext';
import { getActivePaymentMethods } from './paymentMethods';

export function useAuthCart({ api, fetchProducts, searchTerm, setError }) {
  const appData = useApp() || {};
  const {
    currentUser = null, setCurrentUser = () => {}, token = '', setToken = () => {},
    showLoginPage = false, setShowLoginPage = () => {},
    loginSubmitting = false, loginError = '', setLoginError = () => {},
    handleLoginSubmit = () => {}, handleSocialLogin = () => {},
    pendingTwoFactor = null, setPendingTwoFactor = () => {}, twoFactorSubmitting = false, handleVerifyTwoFactorLogin = () => {},
    showForgotPassword = false, setShowForgotPassword = () => {},
    forgotPasswordSubmitting = false, forgotPasswordSent = false, setForgotPasswordSent = () => {},
    handleForgotPasswordRequest = () => {}, handleResetPassword = () => {}, resetPasswordSubmitting = false,
  } = appData;

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const isAdminUser = Boolean(currentUser && (currentUser.isOwner || currentUser.role === 'owner'));
  const isStaffUser = Boolean(currentUser && (
    ['owner', 'admin', 'manager', 'stock', 'sales', 'support', 'employee', 'staff'].includes(currentUser.role) || currentUser.isOwner === true
  ));

  const userRoleInfo = (() => {
    if (!currentUser) return { label: 'ضيف', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: '#64748b' };
    if (currentUser.isOwner === true || currentUser.role === 'owner' || currentUser.role === 'admin') {
      return { label: 'مدير', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)', border: '#ef4444' };
    }
    if (currentUser.role === 'employee') {
      return { label: 'موظف', color: '#c4b5fd', bg: 'rgba(124,58,237,0.15)', border: '#7c3aed' };
    }
    return { label: 'عميل', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: '#0284c7' };
  })();

  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('hamza_cart');
      const parsed = savedCart ? JSON.parse(savedCart) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  const [showCartDropdown, setShowCartDropdown] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [resendVerificationSubmitting, setResendVerificationSubmitting] = useState(false);
  // 🆕 آخر طلب ناجح — لعرض شاشة التأكيد (المنتجات + الأكواد المسلَّمة)
  const [lastOrder, setLastOrder] = useState(null);
  // 💳 طريقة الدفع المختارة (من paymentMethods.js)
  const [paymentMethod, setPaymentMethod] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponSubmitting, setCouponSubmitting] = useState(false);
  const [storeCreditCode, setStoreCreditCode] = useState('');
  const [redeemingStoreCredit, setRedeemingStoreCredit] = useState(false);

  const redeemStoreCredit = useCallback(async () => {
    if (!currentUser || !storeCreditCode.trim()) return;
    setRedeemingStoreCredit(true);
    try {
      const response = await api.post('/store-credit/redeem', { code: storeCreditCode.trim() });
      if (response?.data) setCurrentUser(prev => ({ ...(prev || {}), storeBalance: response.data.storeBalance }));
      setStoreCreditCode('');
      alert(response?.data?.message || 'تمت إضافة الرصيد بنجاح. الرصيد غير قابل للسحب ويُستخدم للشراء داخل المتجر فقط.');
    } catch (err) {
      alert(err?.response?.data?.error || 'تعذر استبدال كود بطاقة الرصيد.');
    } finally {
      setRedeemingStoreCredit(false);
    }
  }, [api, currentUser, storeCreditCode, setCurrentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('hamza_cart', JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  const addToCart = (product) => {
    if (!product || typeof product !== 'object') return;
    const isOpenStoreCredit = product.deliveryType === 'store_credit';
    const isDynamicTopup = product.deliveryType === 'id_topup' && Number(product.shop2topupItemId || 0) > 0;
    const stockCount = typeof product.stock === 'number' ? product.stock : 0;
    if (!isOpenStoreCredit && !isDynamicTopup && stockCount <= 0) {
      alert('⚠️ عذراً، هذا المنتج نفد من المخزون حالياً.');
      return;
    }
    const prodId = product.id || product._id;
    if (!prodId) return;

    setCart(prevCart => {
      const safePrevCart = Array.isArray(prevCart) ? prevCart : [];
      const existing = safePrevCart.find(item => item && (item.id === prodId || item._id === prodId) && Boolean(item.loyaltyOnly) === Boolean(product.loyaltyOnly));
      if (existing) {
        const currentQty = typeof existing.quantity === 'number' ? existing.quantity : 1;
        if (!isOpenStoreCredit && !isDynamicTopup && currentQty >= stockCount) {
          alert('⚠️ لقد وصلت للحد الأقصى المتوفر في المخزون لهذا المنتج.');
          return safePrevCart;
        }
        return safePrevCart.map(item =>
          item && (item.id === prodId || item._id === prodId) && Boolean(item.loyaltyOnly) === Boolean(product.loyaltyOnly) ? { ...item, quantity: currentQty + 1 } : item
        );
      }
      // 🆕 نحتفظ بـ deliveryType بالعنصر ونضيف playerId فاضي لو النوع id_topup
      return [...safePrevCart, { ...product, id: prodId, quantity: 1, playerId: '' }];
    });
  };

  const removeFromCart = (id) => {
    if (!id) return;
    setCart(prev => (Array.isArray(prev) ? prev.filter(item => item && item.id !== id && item._id !== id) : []));
  };

  const updateCartItemQuantity = (id, quantity, loyaltyOnly = false) => {
    if (!id) return;
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    setCart(prev => (Array.isArray(prev)
      ? prev.map(item => {
        if (!item || !(item.id === id || item._id === id) || Boolean(item.loyaltyOnly) !== Boolean(loyaltyOnly)) return item;
        const isOpenStoreCredit = item.deliveryType === 'store_credit';
        const isDynamicTopup = item.deliveryType === 'id_topup' && Number(item.shop2topupItemId || 0) > 0;
        const stockCount = Number(item.stock || 0);
        const maxQuantity = !isOpenStoreCredit && !isDynamicTopup && stockCount > 0 ? stockCount : requestedQuantity;
        return { ...item, quantity: Math.min(requestedQuantity, maxQuantity) };
      })
      : []));
  };

  // 🆕 تحديث آيدي اللاعب لعنصر معيّن بالسلة (لمنتجات تعبئة الآيدي فقط)
  const updateCartItemPlayerId = (id, playerId) => {
    if (!id) return;
    setCart(prev => (Array.isArray(prev)
      ? prev.map(item => (item && (item.id === id || item._id === id)) ? { ...item, playerId } : item)
      : []));
  };

  const safeCart = Array.isArray(cart) ? cart : [];
  const totalPrice = safeCart.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 1), 0);
  const loyaltyPointsCost = safeCart.reduce((sum, item) => sum + (item?.loyaltyOnly ? Number(item.loyaltyPrice || 0) * (Number(item.quantity) || 1) : 0), 0);
  const totalPoints = loyaltyPointsCost;
  const finalTotal = Math.max(0, totalPrice - Number(appliedCoupon?.discount || 0));
  const totalItemsCount = safeCart.reduce((acc, item) => acc + (Number(item?.quantity) || 1), 0);
  const isStoreBalancePayment = ['balance', 'store_balance'].includes(String(paymentMethod || '').trim().toLowerCase());

  useEffect(() => {
    const active = getActivePaymentMethods();
    if (isStoreBalancePayment && Number(currentUser?.storeBalance || 0) >= Number(finalTotal || 0) && Number(finalTotal || 0) > 0) return;
    if (active.length > 0 && !active.some(m => m.id === paymentMethod)) {
      setPaymentMethod(active[0].id);
    }
  }, [paymentMethod, currentUser, finalTotal, isStoreBalancePayment]);

  useEffect(() => {
    setAppliedCoupon(null);
  }, [totalPrice]);

  const applyCoupon = useCallback(async () => {
    const cleanCode = String(couponCode || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'أدخل كود الخصم.' };
    if (totalPrice <= 0) return { success: false, error: 'السلة فارغة.' };
    setCouponSubmitting(true);
    try {
      const response = await api.post('/coupons/validate', { code: cleanCode, subtotal: totalPrice });
      setAppliedCoupon(response?.data || null);
      setCouponCode(cleanCode);
      return { success: true };
    } catch (err) {
      setAppliedCoupon(null);
      return { success: false, error: err?.response?.data?.error || 'تعذر تطبيق كود الخصم.' };
    } finally {
      setCouponSubmitting(false);
    }
  }, [api, couponCode, totalPrice]);

  // 🆕 هل بالسلة منتج بيحتاج آيدي لاعب؟
  const requiresPlayerId = safeCart.some(item => item && item.deliveryType === 'id_topup');

  const handleInitiateCheckout = () => {
    if (safeCart.length === 0) {
      alert("⚠️ السلة فارغة.");
      return;
    }
    if (!currentUser) {
      setShowLoginPage(true);
      return;
    }
    setLastOrder(null);
    setCheckoutMode(true);
  };

  const handleCheckout = useCallback(async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!currentUser) {
      setShowLoginPage(true);
      return;
    }
    if (loyaltyPointsCost > Number(currentUser.loyaltyPoints || 0)) {
      if (typeof setError === 'function') setError(`لا يمكن إتمام الطلب: تحتاج ${loyaltyPointsCost} نقطة، والمتوفر لديك ${Number(currentUser.loyaltyPoints || 0)} نقطة.`);
      return;
    }
    if (isStoreBalancePayment && Number(currentUser.storeBalance || 0) < Number(finalTotal || 0)) {
      if (typeof setError === 'function') setError(`رصيد المتجر غير كافٍ: المطلوب ${Number(finalTotal || 0).toFixed(2)} د.أ والمتوفر ${Number(currentUser.storeBalance || 0).toFixed(2)} د.أ.`);
      return;
    }

    if (Number(finalTotal || 0) > 0 && !isStoreBalancePayment && getActivePaymentMethods().length === 0) {
      if (typeof setError === 'function') setError('لا توجد بوابة دفع مفعّلة حالياً. لا يمكن إتمام طلب مدفوع حتى يتم ربط طريقة دفع آمنة.');
      return;
    }

    // 🆕 تحقق: كل منتج تعبئة آيدي لازم يكون له آيدي مُدخَل
    const missingPlayerId = safeCart.find(item => item && item.deliveryType === 'id_topup' && !String(item.playerId || '').trim());
    if (missingPlayerId) {
      alert(`⚠️ يرجى إدخال آيدي اللاعب لمنتج "${missingPlayerId.name}".`);
      return;
    }

    if (getActivePaymentMethods().length > 0 && !paymentMethod && !isStoreBalancePayment) {
      alert('⚠️ يرجى اختيار طريقة الدفع.');
      return;
    }

    if (!api || typeof api.post !== 'function') {
      if (typeof setError === 'function') {
        setError('⚠️ خدمة الاتصال بالخادم غير متاحة.');
      }
      return;
    }

    if (isMounted.current) setSubmittingCheckout(true);
    if (typeof setError === 'function') setError('');

    try {
      const response = await api.post('/orders', {
        customerName: currentUser.name || currentUser.email || 'عميل',
        customerEmail: currentUser.email || 'غير متوفر',
        customerAddress: currentUser.address || 'طلب رقمي من المتجر',
        items: safeCart.map(item => ({
          id: item.id || item._id,
          name: item.name || 'منتج',
          price: item.price || 0,
          quantity: item.quantity || 1,
          loyaltyOnly: Boolean(item.loyaltyOnly),
          loyaltyPrice: Number(item.loyaltyPrice || 0),
          playerId: item.deliveryType === 'id_topup' ? String(item.playerId || '').trim() : undefined,
          shop2topupCategoryId: item.deliveryType === 'id_topup' ? Number(item.shop2topupCategoryId || 0) || undefined : undefined,
          shop2topupItemId: item.deliveryType === 'id_topup' ? Number(item.shop2topupItemId || 0) || undefined : undefined,
          topupRequirements: item.deliveryType === 'id_topup' ? { ...(item.topupRequirements || {}), player_id: String(item.playerId || '').trim() } : undefined
        })),
        totalAmount: finalTotal,
        paymentMethod: paymentMethod || undefined,
        redeemPoints,
        couponCode: appliedCoupon?.code || couponCode || undefined
      });

      if (isMounted.current) {
        if (response?.data?.account) setCurrentUser(prev => ({ ...(prev || {}), ...response.data.account }));
        setLastOrder(response?.data?.order || null); // 🆕 لعرض شاشة التأكيد
        setCart([]);
        setCouponCode('');
        setAppliedCoupon(null);
        setRedeemPoints(false);
        try { localStorage.removeItem('hamza_cart'); } catch (err) {}
        setCheckoutMode(false);
        setShowCartDropdown(false);
      }

      if (typeof fetchProducts === 'function') {
        fetchProducts(typeof searchTerm === 'string' ? searchTerm : '');
      }
    } catch (err) {
      const errorMsg = err && err.response && err.response.data && err.response.data.error;
      if (isMounted.current && typeof setError === 'function') {
        if (err?.response?.status === 401) {
          setToken('');
          setCurrentUser(null);
          setShowLoginPage(true);
          setError('انتهت جلسة الدخول أو لم تعد صالحة. سجّل الدخول مرة أخرى ثم أعد المحاولة.');
        } else {
          setError(errorMsg || (err?.message ? `تعذر إتمام الطلب: ${err.message}` : 'فشل إتمام عملية الشراء عبر الخادم.'));
        }
      }
    } finally {
      if (isMounted.current) setSubmittingCheckout(false);
    }
  }, [api, safeCart, currentUser, loyaltyPointsCost, totalPrice, finalTotal, paymentMethod, isStoreBalancePayment, redeemPoints, appliedCoupon, couponCode, fetchProducts, searchTerm, setError, setShowLoginPage, setCurrentUser]);

  const handleLogout = useCallback(() => {
    setCart([]);
    try { localStorage.removeItem('hamza_cart'); } catch (e) {}
    setCurrentUser(null);
    setToken('');
    ['user', 'token', 'hamza_user', 'hamza_token'].forEach((key) => {
      try { localStorage.removeItem(key); } catch (e) {}
    });
    alert('تم تسجيل الخروج بنجاح.');
  }, [setCurrentUser, setToken]);

  const handleResendVerification = useCallback(async (email) => {
    if (!email || typeof email !== 'string' || !email.trim()) {
      return { success: false, error: 'البريد الإلكتروني مطلوب.' };
    }
    if (!api || typeof api.post !== 'function') {
      return { success: false, error: 'خدمة الاتصال غير متاحة.' };
    }
    if (isMounted.current) setResendVerificationSubmitting(true);
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      return { success: true };
    } catch (err) {
      const errorMsg = err && err.response && err.response.data && err.response.data.error;
      return { success: false, error: errorMsg || 'حدث خطأ.' };
    } finally {
      if (isMounted.current) setResendVerificationSubmitting(false);
    }
  }, [api]);

  return {
    currentUser, isAdminUser, isStaffUser, userRoleInfo,
    cart, setCart, addToCart, removeFromCart, updateCartItemQuantity, updateCartItemPlayerId, requiresPlayerId,
    totalPrice, finalTotal, loyaltyPointsCost, totalPoints, totalItemsCount,
    showCartDropdown, setShowCartDropdown,
    checkoutMode, setCheckoutMode,
    submittingCheckout, lastOrder, setLastOrder,
    paymentMethod, setPaymentMethod,
    redeemPoints, setRedeemPoints,
    couponCode, setCouponCode, appliedCoupon, setAppliedCoupon, couponSubmitting, applyCoupon,
    storeCreditCode, setStoreCreditCode, redeemingStoreCredit, redeemStoreCredit,
    showLoginPage, setShowLoginPage,
    handleInitiateCheckout, handleCheckout, handleLogout,
    loginSubmitting, loginError, setLoginError,
    handleLoginSubmit, handleSocialLogin,
    pendingTwoFactor, setPendingTwoFactor, twoFactorSubmitting, handleVerifyTwoFactorLogin,
    showForgotPassword, setShowForgotPassword,
    forgotPasswordSubmitting, forgotPasswordSent, setForgotPasswordSent,
    handleForgotPasswordRequest, handleResetPassword, resetPasswordSubmitting,
    resendVerificationSubmitting, handleResendVerification,
  };
}
