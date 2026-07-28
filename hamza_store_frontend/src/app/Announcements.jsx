import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = 'HamzaStoreDB';
const STORE_NAME = 'announcements_data';

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject('IndexedDB غير مدعوم في هذا المتصفح');
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const getStoreData = async (storeName) => {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
};

function Announcements({ 
  announcements: externalAnnouncements, 
  setAnnouncements: externalSetAnnouncements = () => {}, 
  mails = [], 
  setMails = () => {}, 
  inputStyle = {},
  employees: propEmployees = [],
  customers: propCustomers = []
}) {
  // 🔗 جلب البيانات المركزية والمحدثة من AppContext
  const { 
    employees: contextEmployees = [], 
    customers: contextCustomers = [],
    announcements: contextAnnouncements = [],
    setAnnouncements: setContextAnnouncements
  } = useApp();

  const [internalAnnouncements, setInternalAnnouncements] = useState([]);
  const [localEmployees, setLocalEmployees] = useState([]);
  const [localCustomers, setLocalCustomers] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [audience, setAudience] = useState('employees'); // الفئة المستهدفة
  const [searchTerm, setSearchTerm] = useState('');

  // اعتماد القوائم الممررة، أو سياق التطبيق، أو المخزون الداخلي
  const announcements = externalAnnouncements !== undefined ? externalAnnouncements : (contextAnnouncements.length ? contextAnnouncements : internalAnnouncements);
  const employees = propEmployees.length ? propEmployees : (contextEmployees.length ? contextEmployees : (localEmployees.length ? localEmployees : JSON.parse(localStorage.getItem('employees_data') || '[]')));
  const customers = propCustomers.length ? propCustomers : (contextCustomers.length ? contextCustomers : (localCustomers.length ? localCustomers : JSON.parse(localStorage.getItem('customers_data') || '[]')));

  const updateAnnouncements = (newList) => {
    setInternalAnnouncements(newList);
    if (externalSetAnnouncements && typeof externalSetAnnouncements === 'function') {
      externalSetAnnouncements(newList);
    }
    if (setContextAnnouncements && typeof setContextAnnouncements === 'function') {
      setContextAnnouncements(newList);
    }
  };

  // 1️⃣ قراءة الإعلانات والبيانات تلقائياً عند فتح الصفحة من IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbAnnouncements = await getStoreData(STORE_NAME);
        const dbEmployees = await getStoreData('employees_data');
        const dbCustomers = await getStoreData('customers_data');

        if (dbAnnouncements && dbAnnouncements.length > 0) {
          updateAnnouncements(dbAnnouncements);
        } else {
          const savedLocal = localStorage.getItem('announcements_data');
          if (savedLocal) {
            updateAnnouncements(JSON.parse(savedLocal));
          }
        }

        setLocalEmployees(dbEmployees);
        setLocalCustomers(dbCustomers);
        setIsLoaded(true);
      } catch (err) {
        console.warn('استخدام LocalStorage بدلاً من IndexedDB:', err);
        const savedLocal = localStorage.getItem('announcements_data');
        if (savedLocal) {
          updateAnnouncements(JSON.parse(savedLocal));
        }
        setIsLoaded(true);
      }
    };

    loadData();
  }, [propEmployees, propCustomers, contextEmployees, contextCustomers]);

  // 2️⃣ حفظ الإعلانات تلقائياً في قاعدة البيانات فور إضافتها
  useEffect(() => {
    if (!isLoaded) return;

    const saveAnnouncements = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        store.clear();
        (announcements || []).forEach(a => store.put(a));

        localStorage.setItem('announcements_data', JSON.stringify(announcements));
      } catch (err) {
        localStorage.setItem('announcements_data', JSON.stringify(announcements));
      }
    };

    saveAnnouncements();
  }, [announcements, isLoaded]);

  // 📨 إرسال بريد داخلي حقيقي وموجه لأسماء الموظفين أو العملاء الفعليين
  const sendInternalMail = (to, subject, body) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: "Announcements System",
      recipient: to,
      subject,
      body,
      read: false
    };
    setMails(prev => [...(prev || []), mail]);
  };

  // 🌍 إرسال بريد خارجي عبر API
  const sendExternalMail = async (to, subject, body) => {
    try {
      await axios.post("/api/sendExternalMail", { to, subject, body });
    } catch (err) {
      console.error("Error sending external mail", err);
    }
  };

  // ➕ إضافة إعلان جديد ببيانات حقيقية 100%
  const handleAddAnnouncement = (e) => {
    e.preventDefault();
    if (!newTitle || !newMessage) return;

    const currentAnnouncements = announcements || [];
    const newAnn = {
      id: Date.now(),
      title: newTitle,
      message: newMessage,
      date: new Date().toLocaleString(),
      audience
    };

    updateAnnouncements([...currentAnnouncements, newAnn]);

    // التوجيه الحقيقي بناءً على القوائم الفعلية للموظفين والعملاء
    if (audience === "employees") {
      employees.forEach(emp => {
        sendInternalMail(emp.name || "موظف", "📢 إعلان للموظفين", newMessage);
      });
    } else if (audience === "customers") {
      customers.forEach(cust => {
        sendInternalMail(cust.name || "عميل", "📢 إعلان للعملاء", newMessage);
      });
    } else if (audience === "managers") {
      employees.filter(e => e.role === 'manager').forEach(mgr => {
        sendInternalMail(mgr.name || "مدير", "📢 إعلان للمدراء", newMessage);
      });
    } else if (audience === "all") {
      employees.forEach(emp => sendInternalMail(emp.name, "📢 إعلان عام", newMessage));
      customers.forEach(cust => sendInternalMail(cust.name, "📢 إعلان عام", newMessage));
    }

    // إرسال خارجي فعلي للبريد الحقيقي المسجل للعملاء أو المدراء
    if (audience === "customers" && customers.length > 0) {
      customers.forEach(cust => {
        if (cust.email) sendExternalMail(cust.email, `📢 إعلان جديد: ${newTitle}`, newMessage);
      });
    } else if (audience === "managers") {
      employees.filter(e => e.role === 'manager').forEach(mgr => {
        if (mgr.email) sendExternalMail(mgr.email, `📢 إعلان إداري: ${newTitle}`, newMessage);
      });
    } else if (audience === "all") {
      customers.forEach(cust => {
        if (cust.email) sendExternalMail(cust.email, `📢 إعلان عام: ${newTitle}`, newMessage);
      });
    }

    setNewTitle('');
    setNewMessage('');
  };

  // 🔍 فلترة الإعلانات بشكل آمن
  const filteredAnnouncements = (announcements || []).filter(a => {
    if (!a) return false;
    const titleMatch = (a.title || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const messageMatch = (a.message || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    return titleMatch || messageMatch;
  });

  return (
    <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', color: '#fff' }} dir="rtl">
      <h3 style={{ marginBottom: '15px', color: '#3b82f6' }}>📢 إدارة الإعلانات والتنبيهات الشاملة (مرتبط تلقائياً)</h3>

      {/* البحث */}
      <input
        type="text"
        placeholder="🔍 ابحث عن إعلان..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ ...inputStyle, marginBottom: '15px', width: '100%', boxSizing: 'border-box' }}
      />

      {/* إضافة إعلان جديد */}
      <form onSubmit={handleAddAnnouncement} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="عنوان الإعلان..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '150px' }} />
        <input type="text" placeholder="محتوى الإعلان..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: '200px' }} />
        <select value={audience} onChange={(e) => setAudience(e.target.value)} style={{ ...inputStyle, minWidth: '140px' }}>
          <option value="employees">👥 الموظفين ({employees.length})</option>
          <option value="customers">🧑‍💼 العملاء ({customers.length})</option>
          <option value="managers">📊 المدراء</option>
          <option value="all">🌍 الجميع</option>
        </select>
        <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          نشر ➕
        </button>
      </form>

      {/* قائمة الإعلانات */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredAnnouncements.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '10px' }}>لا توجد إعلانات مطابقة</p>
        ) : (
          filteredAnnouncements.map((a, index) => (
            <div key={a.id || index} style={{ background: '#111827', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
              <div>
                <span style={{ color: '#38bdf8', fontSize: '12px' }}>📅 {a.date || "وقت غير محدد"}</span> — <strong style={{ color: '#f8fafc' }}>{a.title}</strong> <span style={{ color: '#facc15', fontSize: '12px' }}>({a.audience})</span>
                <p style={{ margin: '5px 0 0 0', color: '#cbd5e1', fontSize: '14px' }}>📝 {a.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Announcements;