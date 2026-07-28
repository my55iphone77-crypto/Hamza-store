import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = "HamzaStoreDB";
const COUPONS_STORE = "coupons_data";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB غير مدعوم في هذا المتصفح");
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(COUPONS_STORE)) {
        db.createObjectStore(COUPONS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

function canManageCoupons(role) {
  return ["admin", "manager"].includes(role);
}

function Coupons({ 
  currentUser = { role: "guest" },
  mails = [], 
  setMails = () => {}, 
  inputStyle = {},
  employees = [],
  contacts = []
}) {
  // 🔗 جلب البيانات وتحديثاتها مباشرة من AppContext لضمان المزامنة المركزية الشاملة
  const { 
    coupons = [], 
    setCoupons,
    employees: contextEmployees = [],
    contacts: contextContacts = []
  } = useApp();

  const [internalCoupons, setInternalCoupons] = useState([]);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');
  const [audience, setAudience] = useState('customers');
  const [expiry, setExpiry] = useState('');
  const [maxUsage, setMaxUsage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  // دمج البيانات الممررة من السياق أو الحالة الداخلية أو التخزين المحلي
  const rawCoupons = coupons.length > 0 ? coupons : internalCoupons;
  const safeCoupons = rawCoupons.length > 0 ? rawCoupons : JSON.parse(localStorage.getItem("coupons_data") || '[]');

  const updateCoupons = (newList) => {
    setInternalCoupons(newList);
    if (setCoupons && typeof setCoupons === "function") {
      setCoupons(newList);
    }
  };

  // استخدام الموظفين وجهات الاتصال القادمة من السياق إن وجدت، وإلا اعتماد الممررة عبر الـ Props
  const finalEmployees = contextEmployees.length > 0 ? contextEmployees : employees;
  const finalContacts = contextContacts.length > 0 ? contextContacts : contacts;

  // 1️⃣ استرجاع الكوبونات من قاعدة البيانات عند تحميل المكون
  useEffect(() => {
    const loadData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(COUPONS_STORE, "readonly");
        const store = tx.objectStore(COUPONS_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            updateCoupons(req.result);
          } else {
            const localData = localStorage.getItem("coupons_data");
            if (localData) {
              updateCoupons(JSON.parse(localData));
            } else if (coupons.length > 0) {
              updateCoupons(coupons);
            }
          }
        };
      } catch (err) {
        console.warn("استخدام LocalStorage بدلاً من IndexedDB:", err);
        const localData = localStorage.getItem("coupons_data");
        if (localData) updateCoupons(JSON.parse(localData));
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, coupons]);

  // 2️⃣ حفظ البيانات تلقائياً في IndexedDB والتخزين المحلي فور حدوث أي تغيير
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(COUPONS_STORE, "readwrite");
        const store = tx.objectStore(COUPONS_STORE);
        store.clear();
        safeCoupons.forEach((c) => store.put(c));

        localStorage.setItem("coupons_data", JSON.stringify(safeCoupons));
      } catch (err) {
        localStorage.setItem("coupons_data", JSON.stringify(safeCoupons));
      }
    };

    saveData();
  }, [safeCoupons, isLoaded]);

  // 📨 إرسال بريد داخلي حقيقي ومربوط بالنظام العام
  const sendInternalMail = (to, subject, body) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: "Coupons System",
      recipient: to,
      subject,
      body,
      read: false
    };
    if (setMails && typeof setMails === 'function') {
      setMails(prev => [...(prev || []), mail]);
    }
  };

  // 🌍 إرسال بريد خارجي حقيقي
  const sendExternalMail = async (to, subject, body) => {
    try {
      await axios.post("/api/sendExternalMail", { to, subject, body });
    } catch (err) {
      console.error("Error sending external mail", err);
    }
  };

  // ➕ إضافة كوبون جديد وربطه بالبيانات الحقيقية مع التحقق من الصلاحيات
  const handleAddCoupon = (e) => {
    e.preventDefault();
    if (!canManageCoupons(currentUser?.role)) {
      alert("❌ لا تملك صلاحية إضافة أو إدارة الكوبونات.");
      return;
    }
    if (!code || !discount || !expiry || !maxUsage) return;

    const newCoupon = {
      id: Date.now(),
      code,
      discount: parseFloat(discount) || 0,
      audience,
      expiry: new Date(expiry).toISOString(),
      date: new Date().toLocaleString("ar-JO"),
      usageCount: 0,
      users: [],
      maxUsage: parseInt(maxUsage) || 1
    };

    const updatedList = [...safeCoupons, newCoupon];
    updateCoupons(updatedList);

    const message = `كود: ${code} — خصم ${discount}% — صالح حتى ${expiry} — الحد الأقصى: ${maxUsage} استخدام`;

    sendInternalMail(`all-${audience}`, "🎟️ كوبون جديد", message);

    if (audience === "customers" && finalContacts.length > 0) {
      finalContacts.forEach(c => {
        if (c.email) sendExternalMail(c.email, "🎟️ كوبون خصم جديد للعملاء", message);
      });
    } else if (audience === "employees" && finalEmployees.length > 0) {
      finalEmployees.forEach(emp => {
        if (emp.email) sendExternalMail(emp.email, "🎟️ كوبون خصم خاص للموظفين", message);
      });
    } else {
      sendExternalMail("manager@company.com", "🎟️ كوبون عام جديد", message);
    }

    setCode('');
    setDiscount('');
    setExpiry('');
    setMaxUsage('');
  };

  // 🗑️ حذف كوبون (للمدراء فقط)
  const handleDeleteCoupon = (id, couponCode) => {
    if (!canManageCoupons(currentUser?.role)) {
      alert("❌ لا تملك صلاحية حذف الكوبونات.");
      return;
    }
    const updatedList = safeCoupons.filter(c => c.id !== id);
    updateCoupons(updatedList);
    sendInternalMail("manager@company.com", "🗑️ حذف كوبون", `تم حذف الكوبون ${couponCode} بنجاح.`);
  };

  // 🕒 التحقق من صلاحية الكوبون بشكل آمن
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date() > new Date(expiryDate);
  };

  // 📅 دالة آمنة لعرض التاريخ
  const formatExpiryDate = (expiryDate) => {
    if (!expiryDate) return "غير محدد";
    const dateObj = new Date(expiryDate);
    return isNaN(dateObj.getTime()) ? expiryDate : dateObj.toLocaleDateString("ar-JO");
  };

  // 🎟️ استخدام الكوبون
  const handleUseCoupon = (coupon, userName) => {
    if (isExpired(coupon.expiry)) return;
    if ((coupon.usageCount || 0) >= (coupon.maxUsage || 1)) return;

    const updatedCoupons = safeCoupons.map(c =>
      c.id === coupon.id
        ? { ...c, usageCount: (c.usageCount || 0) + 1, users: [...(c.users || []), userName] }
        : c
    );
    updateCoupons(updatedCoupons);
  };

  // 🔍 فلترة الكوبونات بشكل آمن
  const filteredCoupons = safeCoupons.filter(c =>
    (c && c.code && c.code.toLowerCase().includes((searchTerm || '').toLowerCase()))
  );

  return (
    <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', color: '#fff' }} dir="rtl">
      <h3 style={{ marginBottom: '15px', color: '#facc15' }}>🎟️ إدارة الكوبونات (المربوطة مركزياً - AppContext & IndexedDB)</h3>

      {/* البحث */}
      <input
        type="text"
        placeholder="🔍 ابحث عن كوبون حقيقي..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ ...inputStyle, marginBottom: '15px', width: '100%', boxSizing: 'border-box' }}
      />

      {/* إضافة كوبون جديد (متاح للمدراء فقط) */}
      {canManageCoupons(currentUser?.role) ? (
        <form onSubmit={handleAddCoupon} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="كود الكوبون..." value={code} onChange={(e) => setCode(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px' }} />
          <input type="number" placeholder="نسبة الخصم %" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '100px' }} />
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '130px' }} />
          <input type="number" placeholder="الحد الأقصى" value={maxUsage} onChange={(e) => setMaxUsage(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '100px' }} />
          <select value={audience} onChange={(e) => setAudience(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '130px' }}>
            <option value="employees">👥 الموظفين</option>
            <option value="customers">🧑‍💼 العملاء</option>
            <option value="managers">📊 المدراء</option>
            <option value="all">🌍 الجميع</option>
          </select>
          <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            إضافة ➕
          </button>
        </form>
      ) : (
        <div style={{ background: '#334155', padding: '10px', borderRadius: '6px', marginBottom: '20px', color: '#cbd5e1', fontSize: '14px' }}>
          ℹ️ حسابك الحالي ({currentUser?.role || 'زائر'}) يتيح لك عرض واستخدام الكوبونات المتاحة فقط.
        </div>
      )}

      {/* قائمة الكوبونات */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredCoupons.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '10px' }}>لا توجد كوبونات مطابقة</p>
        ) : (
          filteredCoupons.map((c) => (
            <div key={c.id || Math.random()} style={{ background: '#111827', padding: '15px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>📅 تاريخ الإنشاء: {c.date || "غير متوفر"}</span>  
                <div style={{ margin: '5px 0', fontSize: '16px' }}>🎟️ الكود: <strong style={{ color: '#38bdf8' }}>{c.code}</strong></div>  
                <div>💸 نسبة الخصم: <span style={{ color: '#10b981' }}>{c.discount}%</span></div>  
                <div>👥 الفئة المستهدفة: {c.audience}</div>  
                <div>🕒 صالح حتى: {formatExpiryDate(c.expiry)}</div>  
                <div>⚠️ الحالة: <span style={{ color: isExpired(c.expiry) ? '#ef4444' : ((c.usageCount || 0) >= (c.maxUsage || 1) ? '#f59e0b' : '#10b981') }}>
                  {isExpired(c.expiry) ? "❌ منتهي" : ((c.usageCount || 0) >= (c.maxUsage || 1) ? "⛔ وصل للحد الأقصى" : "✅ صالح")}
                </span></div>  
                <div>✅ الاستخدامات: {c.usageCount || 0} / {c.maxUsage}</div>  
                <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>👤 المستخدمين: {c.users && c.users.length > 0 ? c.users.join(', ') : "لا أحد استخدمه بعد"}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                {canManageCoupons(currentUser?.role) && (
                  <button 
                    onClick={() => handleDeleteCoupon(c.id, c.code)}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    حذف الكوبون 🗑️
                  </button>
                )}

                {!isExpired(c.expiry) && (c.usageCount || 0) < (c.maxUsage || 1) && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {finalEmployees.length > 0 ? (
                      finalEmployees.map(emp => (
                        <button 
                          key={emp.id} 
                          onClick={() => handleUseCoupon(c, emp.name)} 
                          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          استخدام كـ ({emp.name}) 🎟️
                        </button>
                      ))
                    ) : (
                      <button onClick={() => handleUseCoupon(c, currentUser?.name || "مسؤول النظام")} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        استخدام الكوبون 🎟️
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* تقرير كامل */}
      <div style={{ marginTop: '20px', background: '#0f172a', padding: '15px', borderRadius: '8px', overflowX: 'auto' }}>
        <h4 style={{ marginBottom: '10px', color: '#38bdf8' }}>📊 تقرير الكوبونات الحقيقي</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', minWidth: '600px' }}>
          <thead>
            <tr style={{ background: '#1e40af' }}>
              <th style={{ padding: '8px' }}>الكود</th>
              <th style={{ padding: '8px' }}>الخصم</th>
              <th style={{ padding: '8px' }}>الفئة</th>
              <th style={{ padding: '8px' }}>تاريخ الإنتهاء</th>
              <th style={{ padding: '8px' }}>الحالة</th>
              <th style={{ padding: '8px' }}>الاستخدامات</th>
              <th style={{ padding: '8px' }}>المستخدمين</th>
            </tr>
          </thead>
          <tbody>
            {safeCoupons.map((c) => (
              <tr key={c.id || Math.random()} style={{ background: '#1f2937', textAlign: 'center', borderBottom: '1px solid #374151' }}>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>{c.code}</td>
                <td style={{ padding: '8px' }}>{c.discount}%</td>
                <td style={{ padding: '8px' }}>{c.audience}</td>
                <td style={{ padding: '8px' }}>{formatExpiryDate(c.expiry)}</td>
                <td style={{ padding: '8px' }}>
                  {isExpired(c.expiry) ? "❌ منتهي" : ((c.usageCount || 0) >= (c.maxUsage || 1) ? "⛔ الحد الأقصى" : "✅ صالح")}
                </td>
                <td style={{ padding: '8px' }}>{c.usageCount || 0} / {c.maxUsage}</td>
                <td style={{ padding: '8px' }}>{c.users && c.users.length > 0 ? c.users.join(', ') : "لا أحد"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Coupons;