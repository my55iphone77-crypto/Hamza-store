import React, { useState, useEffect } from "react";

function Products({ products = [], setProducts = [], mails = [], setMails = [] }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('الكل');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // 💾 سعة التخزين الضخمة: جلب الفئات المحفوظة أو استخدام الافتراضية
  const [categories, setCategories] = useState(() => {
    const savedCategories = localStorage.getItem('store_categories');
    return savedCategories ? JSON.parse(savedCategories) : [
      'بطاقات جوجل بلاي',
      'بطاقات أبل ستور',
      'بطاقات بلايستيشن',
      'شحن ألعاب (بيبجي/فري فاير)',
      'بطاقات إكس بوكس'
    ];
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  // 💾 حفظ الفئات تلقائياً في التخزين المحلي عند أي تغيير
  useEffect(() => {
    localStorage.setItem('store_categories', JSON.stringify(categories));
  }, [categories]);

  // 💾 حفظ المنتجات تلقائياً في التخزين المحلي عند أي تغيير
  useEffect(() => {
    if (products && products.length > 0) {
      localStorage.setItem('store_products', JSON.stringify(products));
    }
  }, [products]);

  // حقول إضافة منتج جديد
  const [name, setName] = useState('');
  const [category, setCategory] = useState('بطاقات جوجل بلاي');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [image, setImage] = useState('');
  const [status, setStatus] = useState('منشور');
  const [scheduledDate, setScheduledDate] = useState('');

  // حقول تعديل المنتج
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDiscountPrice, setEditDiscountPrice] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editScheduledDate, setEditScheduledDate] = useState('');

  // حقل إضافة كود شحن رقمي فوري
  const [newCodeText, setNewCodeText] = useState('');

  // ⏰ فحص مواعيد النشر التلقائي المجدولة بدقة
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let updated = false;

      const newProducts = (products || []).map((prod) => {
        if (prod.scheduledDate && prod.status === 'غير منشور') {
          const targetTime = new Date(prod.scheduledDate);
          if (now >= targetTime) {
            updated = true;
            return { ...prod, status: 'منشور', scheduledDate: '' };
          }
        }
        return prod;
      });

      if (updated) {
        setProducts(newProducts);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [products, setProducts]);

  // ➕ إضافة فئة جديدة وتوثيقها في السجل
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    if (!categories.includes(newCategoryName.trim())) {
      const updatedCategories = [...categories, newCategoryName.trim()];
      setCategories(updatedCategories);
      const log = `🏷️ تم اعتماد وإضافة فئة جديدة للمتجر: ${newCategoryName.trim()}`;
      if (setMails && Array.isArray(mails)) setMails([...mails, log]);
    }
    setNewCategoryName('');
  };

  // ➕ إضافة منتج رقمي جديد
  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!name || !price) {
      alert('الرجاء إدخال اسم المنتج والسعر على الأقل!');
      return;
    }

    const newProduct = {
      id: Date.now(),
      name,
      category: category || 'عام',
      quantity: quantity ? parseInt(quantity) : 0,
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : '',
      image: image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300',
      status: status || 'منشور',
      scheduledDate: scheduledDate || '',
      codes: []
    };

    const updated = [...(products || []), newProduct];
    setProducts(updated);

    const log = `📦 تم إضافة منتج جديد بنجاح: ${name} ضمن فئة (${category})`;
    if (setMails && Array.isArray(mails)) setMails([...mails, log]);

    setName('');
    setCategory('بطاقات جوجل بلاي');
    setQuantity('');
    setPrice('');
    setDiscountPrice('');
    setImage('');
    setStatus('منشور');
    setScheduledDate('');
    setIsAddModalOpen(false);
  };

  // ✏️ بدء التعديل
  const handleStartEdit = (prod) => {
    setSelectedProduct(prod);
    setEditName(prod.name || '');
    setEditCategory(prod.category || 'بطاقات جوجل بلاي');
    setEditQuantity(prod.quantity || '');
    setEditPrice(prod.price || '');
    setEditDiscountPrice(prod.discountPrice || '');
    setEditImage(prod.image || '');
    setEditStatus(prod.status || 'منشور');
    setEditScheduledDate(prod.scheduledDate || '');
    setIsEditing(true);
    setActiveTab('details');
  };

  // 💾 حفظ التعديلات
  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updatedProducts = (products || []).map((prod) => {
      if (prod.id === selectedProduct.id) {
        return {
          ...prod,
          name: editName,
          category: editCategory,
          quantity: editQuantity !== '' ? parseInt(editQuantity) : prod.quantity,
          price: parseFloat(editPrice),
          discountPrice: editDiscountPrice ? parseFloat(editDiscountPrice) : '',
          image: editImage,
          status: editStatus,
          scheduledDate: editScheduledDate
        };
      }
      return prod;
    });

    setProducts(updatedProducts);
    setSelectedProduct(updatedProducts.find(p => p.id === selectedProduct.id));
    setIsEditing(false);

    const log = `✏️ تم تحديث بيانات المنتج: ${editName}`;
    if (setMails && Array.isArray(mails)) setMails([...mails, log]);
  };

  // 🌐 تبديل حالة النشر فورياً
  const handleTogglePublish = (prod) => {
    const newStatus = prod.status === 'منشور' ? 'غير منشور' : 'منشور';
    const updatedProducts = (products || []).map((p) => {
      if (p.id === prod.id) {
        return { ...p, status: newStatus };
      }
      return p;
    });
    setProducts(updatedProducts);
    setSelectedProduct({ ...prod, status: newStatus });
  };

  // 🗑️ حذف منتج
  const handleDeleteProduct = (id, prodName) => {
    const updated = (products || []).filter(p => p.id !== id);
    setProducts(updated);
    setSelectedProduct(null);
    setIsEditing(false);

    const log = `🗑️ تم إزالة المنتج نهائياً من المخزن: ${prodName}`;
    if (setMails && Array.isArray(mails)) setMails([...mails, log]);
  };

  // 🔑 إضافة كود رقمي شحن فوري
  const handleAddCode = (e) => {
    e.preventDefault();
    if (!newCodeText.trim()) return;

    const updatedProducts = (products || []).map((prod) => {
      if (prod.id === selectedProduct.id) {
        const updatedCodes = [...(prod.codes || []), newCodeText.trim()];
        const updatedProd = { ...prod, codes: updatedCodes, quantity: updatedCodes.length };
        setSelectedProduct(updatedProd);
        return updatedProd;
      }
      return prod;
    });

    setProducts(updatedProducts);
    setNewCodeText('');
  };

  // ❌ حذف كود شحن
  const handleDeleteCode = (index) => {
    const updatedProducts = (products || []).map((prod) => {
      if (prod.id === selectedProduct.id) {
        const updatedCodes = prod.codes.filter((_, i) => i !== index);
        const updatedProd = { ...prod, codes: updatedCodes, quantity: updatedCodes.length };
        setSelectedProduct(updatedProd);
        return updatedProd;
      }
      return prod;
    });

    setProducts(updatedProducts);
  };

  // تصفية المنتجات
  const filteredProducts = (products || []).filter((prod) => {
    const matchesSearch = !searchTerm || 
      (prod.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prod.category || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategoryFilter === 'الكل' || prod.category === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ background: '#0f172a', padding: '30px', borderRadius: '20px', color: '#fff', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: '22px', fontWeight: 'bold' }}>
            🛒 إدارة المخزون وبطاقات الشحن الفوري (Products)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة المنتجات الرقمية، الأكواد، وتتبع حالة العرض مع سعة تخزين محلية ضخمة ومستمرة.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="بحث سريع عن منتج..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: '#111827', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none', width: '220px' }}
          />
          <div style={{ background: '#1e293b', color: '#facc15', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
            إجمالي المنتجات: {(products || []).length}
          </div>
        </div>
      </div>

      {/* شريط الفئات وإضافتها */}
      <div style={{ marginBottom: '25px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
          <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px', fontWeight: 'bold' }}>🏷️ الفئات والأقسام الرقمية المحفوظة</h4>
          
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="اسم الفئة الجديدة..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ background: '#0f172a', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '12px', width: '180px' }}
            />
            <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              + إضافة فئة
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategoryFilter('الكل')}
            style={{ background: selectedCategoryFilter === 'الكل' ? '#facc15' : '#0f172a', color: selectedCategoryFilter === 'الكل' ? '#000' : '#94a3b8', border: '1px solid #334155', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            الكل ({(products || []).length})
          </button>
          {categories.map((cat, idx) => {
            const count = (products || []).filter(p => p.category === cat).length;
            return (
              <button
                key={idx}
                onClick={() => setSelectedCategoryFilter(cat)}
                style={{ background: selectedCategoryFilter === cat ? '#38bdf8' : '#0f172a', color: selectedCategoryFilter === cat ? '#000' : '#94a3b8', border: '1px solid #334155', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* شبكة عرض المنتجات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* زر إضافة منتج جديد */}
        <div
          onClick={() => { setIsAddModalOpen(true); setIsEditing(false); }}
          style={{
            background: '#1e293b',
            border: '2px dashed #10b981',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '12px',
            cursor: 'pointer',
            minHeight: '200px',
            transition: '0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#34d399'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#10b981'}
        >
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#10b981', fontWeight: 'bold' }}>+</div>
          <h4 style={{ margin: '0', color: '#10b981', fontSize: '15px', fontWeight: 'bold' }}>إضافة منتج أو بطاقة جديدة</h4>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>انقر لإنشاء بطاقة شحن فورية 🚀</span>
        </div>

        {/* عرض المنتجات المفلترة */}
        {filteredProducts.map((prod) => (
          <div
            key={prod.id}
            onClick={() => { setSelectedProduct(prod); setIsEditing(false); setActiveTab('details'); }}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '10px',
              cursor: 'pointer',
              position: 'relative',
              transition: '0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#38bdf8'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
          >
            <span style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: prod.status === 'منشور' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: prod.status === 'منشور' ? '#34d399' : '#f87171', border: '1px solid', borderColor: prod.status === 'منشور' ? '#059669' : '#dc2626' }}>
              {prod.status === 'منشور' ? '🟢 منشور' : '🔴 غير منشور'}
            </span>

            <img src={prod.image} alt={prod.name} style={{ width: '65px', height: '65px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #334155', marginTop: '10px' }} />

            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{prod.name}</h4>
              <span style={{ fontSize: '11px', color: '#38bdf8', background: '#0f172a', padding: '2px 8px', borderRadius: '10px', border: '1px solid #334155', display: 'inline-block' }}>
                {prod.category}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#94a3b8', marginTop: 'auto' }}>
              <span>السعر: <strong style={{ color: '#10b981' }}>${prod.price}</strong></span>
              <span>الكمية/الأكواد: <strong style={{ color: '#facc15' }}>{prod.codes?.length || prod.quantity || 0}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* نافذة إضافة منتج جديد */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }} dir="rtl">
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '25px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative' }}>
            <button onClick={() => setIsAddModalOpen(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: '#0f172a', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>

            <h3 style={{ margin: '0', color: '#10b981', fontSize: '17px', fontWeight: 'bold' }}>+ إضافة بطاقة أو منتج جديد</h3>
            
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="اسم المنتج/البطاقة * (مثال: بطاقة جوجل بلاي 10$)" value={name} onChange={(e) => setName(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#38bdf8' }}>الفئة:</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' }}>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <input type="number" placeholder="السعر الأصلي ($) *" value={price} onChange={(e) => setPrice(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="number" placeholder="سعر الخصم (اختياري)" value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="text" placeholder="رابط صورة المنتج" value={image} onChange={(e) => setImage(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#facc15' }}>حالة النشر:</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' }}>
                  <option value="منشور">🟢 منشور فوراً</option>
                  <option value="غير منشور">🔴 غير منشور</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#38bdf8' }}>⏰ جدولة النشر التلقائي (اختياري):</label>
                <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              </div>

              <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                حفظ وإضافة للمخزن 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل وتعديل المنتج وإدارة الأكواد */}
      {selectedProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }} dir="rtl">
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '25px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative' }}>
            
            <button onClick={() => { setSelectedProduct(null); setIsEditing(false); }} style={{ position: 'absolute', top: '15px', left: '15px', background: '#0f172a', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>

            {!isEditing ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
                  <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: '65px', height: '65px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #38bdf8' }} />
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{selectedProduct.name}</h3>
                    <span style={{ fontSize: '12px', color: '#38bdf8' }}>الفئة: {selectedProduct.category}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', background: '#0f172a', padding: '6px', borderRadius: '10px' }}>
                  <button onClick={() => setActiveTab('details')} style={{ flex: 1, background: activeTab === 'details' ? '#1e293b' : 'transparent', color: activeTab === 'details' ? '#facc15' : '#94a3b8', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                    📋 التفاصيل الأساسية
                  </button>
                  <button onClick={() => setActiveTab('codes')} style={{ flex: 1, background: activeTab === 'codes' ? '#1e293b' : 'transparent', color: activeTab === 'codes' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                    🔑 أكواد الشحن الفوري ({selectedProduct.codes?.length || 0})
                  </button>
                </div>

                {activeTab === 'details' ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#0f172a', padding: '15px', borderRadius: '10px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                        <span>السعر الأصلي:</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>${selectedProduct.price}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                        <span>سعر الخصم:</span>
                        <span style={{ color: '#facc15', fontWeight: 'bold' }}>{selectedProduct.discountPrice ? `$${selectedProduct.discountPrice}` : 'لا يوجد'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                        <span>عدد الأكواد المتاحة:</span>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedProduct.codes?.length || 0} كود</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                        <span>الحالة:</span>
                        <span style={{ color: selectedProduct.status === 'منشور' ? '#34d399' : '#f87171', fontWeight: 'bold' }}>{selectedProduct.status}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={() => handleStartEdit(selectedProduct)} style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        تعديل ✏️
                      </button>
                      <button onClick={() => handleTogglePublish(selectedProduct)} style={{ flex: 1, background: selectedProduct.status === 'منشور' ? '#d97706' : '#059669', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        {selectedProduct.status === 'منشور' ? 'إلغاء النشر 🛑' : 'نشر 🌐'}
                      </button>
                      <button onClick={() => handleDeleteProduct(selectedProduct.id, selectedProduct.name)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        حذف 🗑️
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <form onSubmit={handleAddCode} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="أدخل كود الشحن الفوري الجديد..."
                        value={newCodeText}
                        onChange={(e) => setNewCodeText(e.target.value)}
                        style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', padding: '9px', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      />
                      <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                        + إضافة كود
                      </button>
                    </form>

                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', background: '#0f172a', padding: '10px', borderRadius: '8px' }}>
                      {(!selectedProduct.codes || selectedProduct.codes.length === 0) ? (
                        <span style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '15px' }}>لا توجد أكواد شحن مضافة لهذا المنتج بعد.</span>
                      ) : (
                        selectedProduct.codes.map((code, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
                            <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '13px' }}>{code}</span>
                            <button onClick={() => handleDeleteCode(idx)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '16px', fontWeight: 'bold' }}>تعديل المنتج</h3>
                
                <input type="text" placeholder="اسم المنتج..." value={editName} onChange={(e) => setEditName(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '12px' }}>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>

                <input type="number" placeholder="السعر..." value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <input type="number" placeholder="سعر الخصم..." value={editDiscountPrice} onChange={(e) => setEditDiscountPrice(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <input type="text" placeholder="رابط الصورة..." value={editImage} onChange={(e) => setEditImage(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />

                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ background: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '12px' }}>
                  <option value="منشور">🟢 منشور</option>
                  <option value="غير منشور">🔴 غير منشور</option>
                </select>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button type="submit" style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                    حفظ التعديلات ✅
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, background: '#334155', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                    إلغاء ✕
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

export default Products;