import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = "HamzaStoreDB";
const CUSTOMERS_STORE = "customers_data";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB غير مدعوم في هذا المتصفح");
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CUSTOMERS_STORE)) {
        db.createObjectStore(CUSTOMERS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

function canManageCustomers(role) {
  if (!role) return false;
  return ['admin', 'manager', 'sales'].includes(role);
}

function Customers({ 
  currentUser = {}, 
  customers: externalCustomers, 
  setCustomers: externalSetCustomers = () => {}, 
  mails = [], 
  setMails = () => {}, 
  inputStyle = {},
  setContacts = () => {}
}) {
  // 🔗 ربط المكون مباشرة بـ AppContext للمزامنة الفورية والمركزية
  const { 
    customers: contextCustomers = [], 
    setCustomers: setContextCustomers,
    contacts: contextContacts = [],
    setContacts: setContextContacts
  } = useApp();

  const [internalCustomers, setInternalCustomers] = useState([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newImage, setNewImage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const safeCurrentUser = currentUser || {};
  
  // دمج البيانات من السياق المركزي أو الخواص أو التخزين المحلي
  const rawCustomers = externalCustomers !== undefined && externalCustomers.length > 0 
    ? externalCustomers 
    : (contextCustomers.length > 0 ? contextCustomers : internalCustomers);
  
  const safeCustomers = rawCustomers.length > 0 ? rawCustomers : JSON.parse(localStorage.getItem("customers_data") || '[]');

  const updateCustomers = (newList) => {
    setInternalCustomers(newList);
    if (externalSetCustomers && typeof externalSetCustomers === "function") {
      externalSetCustomers(newList);
    }
    if (setContextCustomers && typeof setContextCustomers === "function") {
      setContextCustomers(newList);
    }
  };

  const updateGlobalContacts = (updater) => {
    if (setContacts && typeof setContacts === "function") {
      setContacts(updater);
    }
    if (setContextContacts && typeof setContextContacts === "function") {
      setContextContacts(updater);
    }
  };

  // 1️⃣ استرجاع بيانات العملاء عند تحميل المكون
  useEffect(() => {
    const loadData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(CUSTOMERS_STORE, "readonly");
        const store = tx.objectStore(CUSTOMERS_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            updateCustomers(req.result);
          } else {
            const localData = localStorage.getItem("customers_data");
            if (localData) {
              updateCustomers(JSON.parse(localData));
            } else if (contextCustomers.length > 0) {
              updateCustomers(contextCustomers);
            }
          }
        };
      } catch (err) {
        console.warn("استخدام LocalStorage بدلاً من IndexedDB:", err);
        const localData = localStorage.getItem("customers_data");
        if (localData) updateCustomers(JSON.parse(localData));
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, contextCustomers]);

  // 2️⃣ حفظ البيانات تلقائياً في IndexedDB والتخزين المحلي عند أي تحديث
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(CUSTOMERS_STORE, "readwrite");
        const store = tx.objectStore(CUSTOMERS_STORE);
        store.clear();
        safeCustomers.forEach((c) => store.put(c));

        localStorage.setItem("customers_data", JSON.stringify(safeCustomers));
      } catch (err) {
        localStorage.setItem("customers_data", JSON.stringify(safeCustomers));
      }
    };

    saveData();
  }, [safeCustomers, isLoaded]);

  // 📨 إرسال بريد داخلي حقيقي ومربوط بالنظام العام
  const sendMail = (to, subject, body, attachment = null) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: "CRM System",
      recipient: to,
      subject,
      body,
      attachment,
      read: false
    };
    if (setMails && typeof setMails === 'function') {
      setMails(prev => [...(prev || []), mail]);
    }
  };

  // ➕ إضافة عميل جديد وربطه تلقائياً بكل التطبيقات مع التحقق من الصلاحيات
  const handleAddCustomer = (e) => {
    e.preventDefault();
    if (!canManageCustomers(safeCurrentUser.role)) {
      alert('❌ لا تملك صلاحية إضافة عملاء.');
      return;
    }
    if (!newName || !newEmail || !newPhone) return;

    const newCustId = Date.now();
    const newCust = {
      id: newCustId,
      name: newName,
      email: newEmail,
      phone: newPhone,
      image: newImage || null
    };

    const updatedList = [...safeCustomers, newCust];
    updateCustomers(updatedList);

    // ربط العملاء الجدد بقائمة جهات الاتصال العامة في النظام
    updateGlobalContacts(prev => [...(prev || []), newCust]);

    // رسالة ترحيب حقيقية للعميل
    sendMail(
      newCust.email,
      "🎉 أهلاً بك في متجرنا",
      `مرحباً ${newCust.name}, شكراً لتسجيلك معنا! مرفق كوبون خصم ترحيبي.`,
      "welcome_coupon.pdf"
    );

    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewImage('');
  };

  // 🗑️ حذف عميل وتحديث كافة التطبيقات المرتبطة
  const handleDeleteCustomer = (id, custName) => {
    if (!canManageCustomers(safeCurrentUser.role)) {
      alert('❌ لا تملك صلاحية حذف العملاء.');
      return;
    }
    const updated = safeCustomers.filter(c => c && c.id !== id);
    updateCustomers(updated);

    // إزالة العميل من جهات الاتصال العامة
    updateGlobalContacts(prev => (prev || []).filter(c => c.id !== id));

    sendMail("manager@company.com", "🗑️ حذف عميل", `تم حذف العميل الحقيقي ${custName || 'غير معروف'} من النظام.`);
  };

  // ✏️ تعديل بيانات العميل وتحديثها لحظياً في كل التطبيقات
  const handleUpdateCustomer = (id, field, value) => {
    if (!canManageCustomers(safeCurrentUser.role)) {
      alert('❌ لا تملك صلاحية تعديل بيانات العملاء.');
      return;
    }
    const updated = safeCustomers.map(c => c && c.id === id ? { ...c, [field]: value } : c);
    updateCustomers(updated);

    // تحديث البيانات في سجلات الاتصال العامة
    updateGlobalContacts(prev => (prev || []).map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // 🔍 فلترة العملاء بشكل آمن
  const filteredCustomers = safeCustomers.filter(c => {
    if (!c) return false;
    const nameMatch = (c.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const emailMatch = (c.email || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    return nameMatch || emailMatch;
  });

  return (
    <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', color: '#fff' }} dir="rtl">
      <h3 style={{ marginBottom: '15px', color: '#22c55e' }}>👥 إدارة العملاء (المربوطة مركزياً - AppContext & IndexedDB)</h3>

      {/* البحث */}
      <input
        type="text"
        placeholder="🔍 ابحث عن عميل حقيقي..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ ...inputStyle, marginBottom: '15px', width: '100%', boxSizing: 'border-box' }}
      />

      {/* إضافة عميل جديد (للمدراء والمبيعات فقط) */}
      {canManageCustomers(safeCurrentUser.role) ? (
        <form onSubmit={handleAddCustomer} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="اسم العميل..." value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '130px' }} />
          <input type="email" placeholder="الإيميل..." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }} />
          <input type="text" placeholder="رقم الهاتف..." value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px' }} />
          <input type="text" placeholder="رابط صورة العميل..." value={newImage} onChange={(e) => setNewImage(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }} />
          <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            إضافة ➕
          </button>
        </form>
      ) : (
        <div style={{ background: '#334155', padding: '10px', borderRadius: '6px', marginBottom: '20px', color: '#cbd5e1', fontSize: '14px' }}>
          ℹ️ حسابك الحالي ({safeCurrentUser?.role || 'زائر'}) يتيح لك عرض وتصفح بيانات العملاء.
        </div>
      )}

      {/* قائمة العملاء */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredCustomers.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '10px' }}>لا توجد بيانات حقيقية للعملاء</p>
        ) : (
          filteredCustomers.map((c, index) => {
            if (!c) return null;
            return (
              <div key={c.id || index} style={{ background: '#111827', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {c.image ? (
                    <img src={c.image} alt={c.name || 'Customer'} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>👤</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#22c55e' }}>👤</span>
                    <input type="text" defaultValue={c.name || ''} onBlur={(e) => handleUpdateCustomer(c.id, 'name', e.target.value)} style={{ ...inputStyle, width: '120px' }} />
                    <span style={{ color: '#94a3b8' }}>📧</span>
                    <input type="email" defaultValue={c.email || ''} onBlur={(e) => handleUpdateCustomer(c.id, 'email', e.target.value)} style={{ ...inputStyle, width: '160px' }} />
                    <span style={{ color: '#94a3b8' }}>📱</span>
                    <input type="text" defaultValue={c.phone || ''} onBlur={(e) => handleUpdateCustomer(c.id, 'phone', e.target.value)} style={{ ...inputStyle, width: '120px' }} />
                  </div>
                </div>

                {canManageCustomers(safeCurrentUser.role) && (
                  <button onClick={() => handleDeleteCustomer(c.id, c.name)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    حذف 🗑️
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Customers;