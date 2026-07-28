import React, { useState, useEffect } from 'react';

function Storefront({ 
  products = [], 
  setProducts = () => {}, 
  transactions = [], 
  setTransactions = () => {}, 
  mails = [], 
  setMails = () => {}, 
  requests = [], 
  setRequests = () => {}, 
  inputStyle = {},
  isAdmin = false 
}) {
  const [cart, setCart] = useState([]);
  const [showCartDropdown, setShowCartDropdown] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // حالات نموذج خدمة العملاء في المتجر
  const [supportName, setSupportName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportLocation, setSupportLocation] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);

  // 💾 حالات مساحة التخزين المحلية
  const [storageSize, setStorageSize] = useState('0');
  const [storageItemsCount, setStorageItemsCount] = useState(0);

  const updateStorageInfo = () => {
    let totalBytes = 0;
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key) || '';
      totalBytes += new Blob([key + value]).size;
      count++;
    }
    setStorageSize((totalBytes / 1024).toFixed(2));
    setStorageItemsCount(count);
  };

  useEffect(() => {
    updateStorageInfo();
  }, [products, transactions, mails, requests]);

  const sendMail = (to, subject, body, attachment = null) => {
    const mail = {
      id: Date.now(),
      sender: "واجهة المتجر الرقمي",
      recipient: to,
      subject,
      body,
      attachment,
      read: false,
      date: new Date().toLocaleString("ar-JO")
    };
    if (setMails && typeof setMails === 'function') {
      setMails(prev => Array.isArray(prev) ? [...prev, mail] : [mail]);
    }
    updateStorageInfo();
  };

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert('⚠️ عذراً، هذا المنتج نفد من المخزون حالياً.');
      return;
    }

    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert('⚠️ لقد وصلت للحد الأقصى المتوفر في المخزون لهذا المنتج.');
        return;
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckout = (e) => {
    e.preventDefault();
    if (!customerName || !customerEmail || !customerAddress) {
      alert("⚠️ يرجى إدخال كافة بيانات العميل (الاسم، البريد، والعنوان)");
      return;
    }

    if (cart.length === 0) {
      alert("⚠️ السلة فارغة.");
      return;
    }

    // خصم المخزون وتحديثه مباشرة عبر الـ props المربوطة بلوحة التحكم
    const updatedProducts = products.map(prod => {
      const cartItem = cart.find(item => item.id === prod.id);
      if (cartItem) {
        return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
      }
      return prod;
    });
    setProducts(updatedProducts);

    const itemsDescription = cart.map(i => `${i.name} (×${i.quantity})`).join(', ');
    const newTransaction = {
      id: Date.now(),
      type: 'income',
      amount: totalPrice,
      description: `مبيعات متجر للعميل ${customerName}: [${itemsDescription}]`,
      date: new Date().toLocaleString("ar-JO")
    };
    
    if (setTransactions && typeof setTransactions === 'function') {
      setTransactions(prev => Array.isArray(prev) ? [...prev, newTransaction] : [newTransaction]);
    }

    sendMail(
      "manager@company.com",
      "🛒 طلب شراء جديد من واجهة المتجر",
      `تم استلام طلب جديد بقيمة ${totalPrice}$ من العميل: ${customerName} (${customerEmail}).\nالمنتجات: ${itemsDescription}\nعنوان التسليم: ${customerAddress}`,
      "order_invoice.pdf"
    );

    alert(`✅ شكراً لك يا ${customerName}! تم إتمام الطلب بنجاح وتم خصم المشتريات من المخزون وتوثيق الإيراد المالي.`);
    
    setCart([]);
    setCheckoutMode(false);
    setShowCartDropdown(false);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerAddress('');
    updateStorageInfo();
  };

  const handleSupportSubmit = (e) => {
    e.preventDefault();
    if (!supportName || !supportPhone || !supportMessage) {
      alert("⚠️ يرجى إدخال الاسم، رقم الهاتف، وتفاصيل الشكوى.");
      return;
    }

    const newRequest = {
      id: Date.now(),
      customerName: supportName,
      phone: supportPhone,
      location: supportLocation || 'متجر الألعاب الرقمية',
      issue: supportMessage,
      complaintType: 'service',
      target: 'خدمة العملاء',
      date: new Date().toLocaleString("ar-JO"),
      status: 'قيد المراجعة',
      response: ''
    };

    if (setRequests && typeof setRequests === 'function') {
      setRequests(prev => Array.isArray(prev) ? [...prev, newRequest] : [newRequest]);
    }

    sendMail(
      "support@company.com",
      "🎧 شكوى جديدة واصلة من واجهة المتجر",
      `اسم العميل: ${supportName}\nالهاتف: ${supportPhone}\nالموقع: ${supportLocation}\nالمشكلة: ${supportMessage}`
    );

    setSupportSubmitted(true);
    setSupportName('');
    setSupportPhone('');
    setSupportLocation('');
    setSupportMessage('');
    setTimeout(() => setSupportSubmitted(false), 5000);
    updateStorageInfo();
  };

  const filteredProducts = products.filter(p => 
    (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* 🏷️ رأس الصفحة والشريط العلوي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: '22px', fontWeight: 'bold' }}>
            🛍️ متجر حمزة لبطاقات الألعاب الرقمية
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>استعراض بطاقات الألعاب المتاحة، الشحن الفوري، وطلب الدعم الفني.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', flexWrap: 'wrap' }}>
          
          <div className="storage-badge" style={{ background: '#111827', border: '1px solid #334155', padding: '8px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#38bdf8' }}>
            <span>💾 التخزين:</span>
            <span style={{ color: '#facc15', fontWeight: 'bold' }}>{storageSize} KB</span>
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>({storageItemsCount} مفتاح)</span>
          </div>
          
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowCartDropdown(!showCartDropdown)}
              style={{ background: '#111827', color: '#38bdf8', border: '1px solid #334155', padding: '10px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              🛒 السلة <span style={{ background: '#0284c7', color: '#fff', fontSize: '11px', padding: '2px 7px', borderRadius: '50%' }}>{totalItemsCount}</span>
            </button>

            {showCartDropdown && (
              <div style={{ position: 'absolute', left: '0', top: '45px', width: '320px', background: '#111827', border: '1px solid #38bdf8', borderRadius: '14px', padding: '15px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '14px', borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>محتويات سلة المشتريات</h4>
                
                {cart.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '12px', margin: '10px 0', textAlign: 'center' }}>السلة فارغة حالياً.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {cart.map((item, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b0f19', padding: '8px', borderRadius: '8px', fontSize: '12px' }}>
                        <span>{item.name} (×{item.quantity})</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#facc15' }}>{item.price * item.quantity}$</span>
                          <button onClick={() => removeFromCart(item.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1f2937', fontWeight: 'bold', fontSize: '13px' }}>
                      <span>الإجمالي: <span style={{ color: '#facc15' }}>{totalPrice}$</span></span>
                      <button 
                        onClick={() => { setShowCartDropdown(false); setCheckoutMode(true); }}
                        style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        إتمام الشراء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ background: '#111827', color: '#38bdf8', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
            المنتجات المتوفرة: {products.length}
          </div>
        </div>
      </div>

      {/* 🔍 شريط البحث */}
      <div style={{ marginBottom: '25px' }}>
        <input 
          type="text" 
          placeholder="🔍 ابحث عن بطاقة ألعاب، شحن رصيد..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          style={{ width: '100%', background: '#111827', border: '1px solid #334155', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '14px', boxSizing: 'border-box', ...inputStyle }} 
        />
      </div>

      {/* 🧾 نموذج إتمام الدفع */}
      {checkoutMode && (
        <form onSubmit={handleCheckout} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #10b981', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: '0', color: '#10b981', fontSize: '16px' }}>🧾 بيانات إتمام الطلب والشحن الفوري</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="الاسم الكامل للعميل..." 
              value={customerName} 
              onChange={(e) => setCustomerName(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
            />
            <input 
              type="email" 
              placeholder="البريد الإلكتروني لإرسال البطاقات..." 
              value={customerEmail} 
              onChange={(e) => setCustomerEmail(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
            />
            <input 
              type="text" 
              placeholder="عنوان التسليم أو رقم الحساب المستهدف..." 
              value={customerAddress} 
              onChange={(e) => setCustomerAddress(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
              تأكيد الطلب وخصم المخزون وتوثيق الإيراد 🛒
            </button>
            <button type="button" onClick={() => setCheckoutMode(false)} style={{ background: '#4b5563', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* 🎮 شبكة المنتجات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {filteredProducts.length === 0 ? (
          <p style={{ color: '#9ca3af', gridColumn: '1 / -1', textAlign: 'center', padding: '30px' }}>لا توجد منتجات مطابقة لعملية البحث</p>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '15px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '28px' }}>🎮</span>
                  <span style={{ background: product.stock > 0 ? '#065f46' : '#991b1b', color: product.stock > 0 ? '#34d399' : '#fca5a5', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                    {product.stock > 0 ? `المخزون: ${product.stock}` : 'نفد المخزون'}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '16px' }}>{product.name}</h4>
                <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px', lineHeight: '1.4' }}>{product.description}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid #1f2937' }}>
                <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: '16px' }}>💰 {product.price}$</span>
                <button 
                  onClick={() => addToCart(product)} 
                  disabled={product.stock <= 0}
                  style={{ background: product.stock > 0 ? '#10b981' : '#4b5563', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: product.stock > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '13px' }}
                >
                  {product.stock > 0 ? 'أضف للسلة ➕' : 'غير متوفر'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 🎧 خدمة العملاء والدعم الفوري */}
      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1.5px solid #f59e0b', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.1)' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎧 خدمة العملاء والدعم الفوري
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 15px 0' }}>تواجه مشكلة في الشحن أو استلام البطاقة؟ أرسل شكواك وسوف تظهر فوراً لدى موظفي خدمة العملاء والإدارة للمتابعة.</p>

        {supportSubmitted ? (
          <div style={{ background: '#065f46', color: '#34d399', padding: '12px', borderRadius: '10px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
            ✅ تم إرسال شكواك بنجاح إلى نظام خدمة العملاء وسيتم معالجتها قريباً!
          </div>
        ) : (
          <form onSubmit={handleSupportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="اسم العميل..." 
                value={supportName} 
                onChange={(e) => setSupportName(e.target.value)} 
                style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
              />
              <input 
                type="text" 
                placeholder="رقم الهاتف..." 
                value={supportPhone} 
                onChange={(e) => setSupportPhone(e.target.value)} 
                style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
              />
              <input 
                type="text" 
                placeholder="الموقع (اختياري)..." 
                value={supportLocation} 
                onChange={(e) => setSupportLocation(e.target.value)} 
                style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
              />
            </div>
            <textarea 
              rows="3" 
              placeholder="اكتب المشكلة أو البلاغ هنا..." 
              value={supportMessage} 
              onChange={(e) => setSupportMessage(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', resize: 'vertical', ...inputStyle }} 
            />
            <button 
              type="submit" 
              style={{ background: '#f59e0b', color: '#111827', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', alignSelf: 'flex-start' }}
            >
              إرسال البلاغ لتطبيق خدمة العملاء 🚀
            </button>
          </form>
        )}
      </div>

    </div>
  );
}

export default Storefront;