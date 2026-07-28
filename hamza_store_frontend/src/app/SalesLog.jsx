import React, { useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js/auto';

function SalesLog({ sales = [], setSales = () => {}, inputStyle = {}, mails = [], setMails = () => {} }) {
  const [customerName, setCustomerName] = useState('');
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // حالات نافذة التعديل (Modal) لعمليات البيع
  const [editingSale, setEditingSale] = useState(null);
  const [editCustomer, setEditCustomer] = useState('');
  const [editProduct, setEditProduct] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // ➕ إضافة عملية بيع جديدة مع ربط السجل الحي (Mails/Logs)
  const addSale = (e) => {
    e.preventDefault();
    if (!customerName || !product || !quantity || !price) return;

    const qtyVal = parseInt(quantity) || 0;
    const priceVal = parseFloat(price) || 0;
    const totalVal = qtyVal * priceVal;

    const newSale = {
      id: Date.now(),
      customerName,
      product,
      quantity: qtyVal,
      price: priceVal,
      total: totalVal,
      date: new Date().toLocaleString('ar-JO')
    };

    setSales([...sales, newSale]);

    const logText = `💰 عملية بيع جديدة: العميل (${customerName}) اشترى ${qtyVal} × (${product}) بقيمة إجمالية $${totalVal}`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    setCustomerName('');
    setProduct('');
    setQuantity('');
    setPrice('');
  };

  // 🗑️ حذف عملية بيع مع التوثيق
  const deleteSale = (id) => {
    const target = sales.find(s => s.id === id);
    setSales(sales.filter(s => s.id !== id));

    const logText = `🗑️ تم حذف عملية البيع الخاصة بالعميل (${target?.customerName || 'غير معروف'}) للمنتج (${target?.product || ''})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    if (editingSale && editingSale.id === id) {
      setEditingSale(null);
    }
  };

  // ✏️ فتح نافذة التعديل
  const openEditModal = (s) => {
    setEditingSale(s);
    setEditCustomer(s.customerName || '');
    setEditProduct(s.product || '');
    setEditQuantity(s.quantity !== undefined ? s.quantity : '');
    setEditPrice(s.price !== undefined ? s.price : '');
  };

  // 💾 حفظ تعديلات البيع مع التوثيق المباشر
  const handleSaveEdit = () => {
    if (!editingSale) return;

    const qtyVal = parseInt(editQuantity) || 0;
    const priceVal = parseFloat(editPrice) || 0;
    const totalVal = qtyVal * priceVal;

    setSales(sales.map(s => {
      if (s.id === editingSale.id) {
        return {
          ...s,
          customerName: editCustomer,
          product: editProduct,
          quantity: qtyVal,
          price: priceVal,
          total: totalVal
        };
      }
      return s;
    }));

    const logText = `✏️ تم تحديث عملية البيع للعميل (${editCustomer}) للمنتج (${editProduct}) بقيمة $${totalVal}`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    setEditingSale(null);
  };

  // 🔍 فلترة المبيعات بشكل آمن
  const filteredSales = (sales || []).filter(s =>
    ((s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
     (s.product || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 📊 تقرير عام
  const totalSales = (sales || []).reduce((sum, s) => sum + (s.total || 0), 0);
  const avgSale = sales.length ? (totalSales / sales.length).toFixed(2) : 0;

  // 📈 بيانات الرسم البياني حسب التاريخ
  const salesByDate = {};
  (sales || []).forEach(s => {
    if (!s.date) return;
    const day = s.date.split(',')[0];
    if (!salesByDate[day]) salesByDate[day] = 0;
    salesByDate[day] += (s.total || 0);
  });

  const dates = Object.keys(salesByDate);
  const salesData = {
    labels: dates,
    datasets: [
      {
        label: 'إجمالي المبيعات اليومية',
        data: dates.map(d => salesByDate[d]),
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
        tension: 0.3
      }
    ]
  };

  // 📊 مقارنة المبيعات بين المنتجات
  const salesByProduct = {};
  (sales || []).forEach(s => {
    if (!s.product) return;
    if (!salesByProduct[s.product]) salesByProduct[s.product] = 0;
    salesByProduct[s.product] += (s.total || 0);
  });

  const products = Object.keys(salesByProduct);
  const productData = {
    labels: products,
    datasets: [
      {
        label: 'إجمالي المبيعات حسب المنتج',
        data: products.map(p => salesByProduct[p]),
        backgroundColor: '#f97316'
      }
    ]
  };

  // 📤 تصدير CSV
  const exportCSV = () => {
    const header = "ID,Customer,Product,Quantity,Price,Total,Date\n";
    const rows = (sales || []).map(s => `${s.id},${s.customerName},${s.product},${s.quantity},${s.price},${s.total},${s.date}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sales_log.csv";
    link.click();
  };

  // 📤 تصدير PDF
  const exportPDF = () => {
    const printContent = (sales || []).map(s => 
      `📅 ${s.date} | 👤 ${s.customerName} | 📦 ${s.product} | 🔢 ${s.quantity} | 💵 ${s.price} | 💰 ${s.total}`
    ).join("\n");
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write("<pre style='font-family: Tahoma; direction: rtl;'>" + printContent + "</pre>");
      newWindow.print();
    }
  };

  return (
    <div style={{ 
      background: '#0b0f19', 
      padding: '35px', 
      borderRadius: '24px', 
      color: '#f8fafc', 
      fontFamily: 'Tajawal, sans-serif', 
      border: '1px solid #1e293b', 
      boxShadow: '0 25px 30px -10px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px' 
    }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid #1e293b', 
        paddingBottom: '20px', 
        flexWrap: 'wrap', 
        gap: '15px' 
      }}>
        <div>
          <h2 style={{ margin: '0 0 6px 0', color: '#f97316', fontSize: '24px', fontWeight: 'bold' }}>
            💼 سجل المبيعات والعمليات (Sales Log)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13.5px' }}>
            تسجيل ومتابعة مبيعات المنتجات وبطاقات الألعاب، وتصدير التقارير البيانية الحية.
          </p>
        </div>

        <div style={{ 
          background: '#1e293b', 
          color: '#f97316', 
          padding: '10px 18px', 
          borderRadius: '12px', 
          fontSize: '13.5px', 
          border: '1px solid #334155', 
          fontWeight: 'bold' 
        }}>
          إجمالي العمليات: {sales.length}
        </div>
      </div>

      {/* نموذج إضافة عملية بيع جديدة */}
      <form onSubmit={addSale} style={{ 
        background: '#111827', 
        padding: '24px', 
        borderRadius: '18px', 
        border: '1px solid #1f2937', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '18px' 
      }}>
        <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '16px' }}>➕ تسجيل عملية بيع جديدة</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <input type="text" placeholder="اسم العميل..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }} />
          <input type="text" placeholder="اسم المنتج أو البطاقة..." value={product} onChange={(e) => setProduct(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }} />
          <input type="number" placeholder="الكمية..." value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }} />
          <input type="number" placeholder="السعر..." value={price} onChange={(e) => setPrice(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }} />
        </div>

        <button type="submit" style={{ 
          background: '#3b82f6', 
          color: '#fff', 
          border: 'none', 
          padding: '13px', 
          borderRadius: '12px', 
          cursor: 'pointer', 
          fontWeight: 'bold', 
          fontSize: '14px', 
          transition: 'background 0.2s',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
        }}>
          إضافة وطرح من المخزن ➕
        </button>
      </form>

      {/* البحث */}
      <input
        type="text"
        placeholder="🔍 ابحث عن عميل أو منتج..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ 
          background: '#111827', 
          border: '1px solid #334155', 
          padding: '14px 18px', 
          borderRadius: '14px', 
          color: '#fff', 
          fontSize: '14px', 
          width: '100%', 
          boxSizing: 'border-box', 
          ...inputStyle 
        }}
      />

      {/* قائمة المبيعات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '18px' }}>
        {filteredSales.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '30px', gridColumn: '1 / -1', fontSize: '14px' }}>
            لا توجد مبيعات مطابقة للبحث
          </p>
        ) : (
          filteredSales.map((s) => (
            <div key={s.id} style={{ 
              background: '#111827', 
              padding: '18px', 
              borderRadius: '16px', 
              border: '1px solid #1f2937', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              boxShadow: '0 6px 12px -2px rgba(0,0,0,0.2)' 
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid #1f2937', 
                paddingBottom: '10px' 
              }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>📅 {s.date}</span>
                <span style={{ fontSize: '14px', color: '#34d399', fontWeight: 'bold' }}>💰 ${s.total}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px' }}>
                <p style={{ margin: '0' }}>👤 <strong style={{ color: '#fff' }}>العميل:</strong> {s.customerName}</p>
                <p style={{ margin: '0' }}>📦 <strong style={{ color: '#fff' }}>المنتج:</strong> {s.product}</p>
                <p style={{ margin: '0' }}>🔢 <strong style={{ color: '#fff' }}>الكمية:</strong> {s.quantity} | 💵 <strong style={{ color: '#fff' }}>السعر:</strong> ${s.price}</p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button 
                  type="button" 
                  onClick={() => openEditModal(s)}
                  style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold' }}
                >
                  تعديل ✏️
                </button>
                <button 
                  type="button" 
                  onClick={() => deleteSale(s.id)}
                  style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold' }}
                >
                  حذف 🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* المؤشرات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px' }}>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '20px', borderRadius: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12.5px', display: 'block', marginBottom: '6px' }}>إجمالي المبيعات العامة</span>
          <span style={{ color: '#34d399', fontSize: '22px', fontWeight: 'bold' }}>${totalSales}</span>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '20px', borderRadius: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12.5px', display: 'block', marginBottom: '6px' }}>إجمالي عدد العمليات</span>
          <span style={{ color: '#38bdf8', fontSize: '22px', fontWeight: 'bold' }}>{sales.length}</span>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '20px', borderRadius: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12.5px', display: 'block', marginBottom: '6px' }}>متوسط قيمة البيع</span>
          <span style={{ color: '#facc15', fontSize: '22px', fontWeight: 'bold' }}>${avgSale}</span>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div style={{ background: '#111827', padding: '22px', borderRadius: '18px', border: '1px solid #1f2937' }}>
          <h4 style={{ margin: '0 0 18px 0', color: '#38bdf8', fontSize: '16px' }}>📈 تطور المبيعات اليومية</h4>
          <Line data={salesData} />
        </div>

        <div style={{ background: '#111827', padding: '22px', borderRadius: '18px', border: '1px solid #1f2937' }}>
          <h4 style={{ margin: '0 0 18px 0', color: '#f97316', fontSize: '16px' }}>📦 مقارنة المبيعات بين المنتجات</h4>
          <Bar data={productData} />
        </div>
      </div>

      {/* أزرار التصدير */}
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', paddingTop: '5px' }}>
        <button
          type="button"
          onClick={exportCSV}
          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13.5px' }}
        >
          📤 تصدير إلى ملف CSV
        </button>

        <button
          type="button"
          onClick={exportPDF}
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13.5px' }}
        >
          📄 طباعة وتصدير PDF
        </button>
      </div>

      {/* Modal التعديل */}
      {editingSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid #334155', borderRadius: '22px', width: '100%', maxWidth: '460px', padding: '32px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
            
            <button 
              type="button"
              onClick={() => setEditingSale(null)}
              style={{ position: 'absolute', top: '20px', left: '20px', background: '#1f2937', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 12px 0', color: '#22c55e', fontSize: '18px' }}>✏️ تعديل عملية البيع</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '12.5px', color: '#94a3b8' }}>اسم العميل</label>
              <input type="text" value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px', borderRadius: '10px', color: '#fff', ...inputStyle }} />

              <label style={{ fontSize: '12.5px', color: '#94a3b8' }}>اسم المنتج</label>
              <input type="text" value={editProduct} onChange={(e) => setEditProduct(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px', borderRadius: '10px', color: '#fff', ...inputStyle }} />

              <label style={{ fontSize: '12.5px', color: '#94a3b8' }}>الكمية</label>
              <input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px', borderRadius: '10px', color: '#fff', ...inputStyle }} />

              <label style={{ fontSize: '12.5px', color: '#94a3b8' }}>السعر</label>
              <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px', borderRadius: '10px', color: '#fff', ...inputStyle }} />
            </div>

            <button 
              type="button"
              onClick={handleSaveEdit}
              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}
            >
              حفظ التعديلات ✅
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default SalesLog;