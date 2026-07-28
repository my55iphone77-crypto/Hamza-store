import React, { useState, useEffect } from "react";
import { useApp } from "./AppContext";

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = "HamzaStoreDB";
const CONTACTS_STORE = "contacts_data";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB غير مدعوم في هذا المتصفح");
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CONTACTS_STORE)) {
        db.createObjectStore(CONTACTS_STORE, { keyPath: "id" });
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

function canManageContacts(role) {
  return ["admin", "manager"].includes(role);
}

function Contacts({ 
  currentUser = { role: "guest" }, 
  inputStyle = {},
  setMails = () => {}
}) {
  // 🔗 جلب البيانات وتحديثاتها مباشرة من AppContext لضمان المزامنة الفورية
  const { 
    contacts = [], 
    setContacts,
    setEmployees: setContextEmployees
  } = useApp();

  const [internalContacts, setInternalContacts] = useState([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newImage, setNewImage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // دمج جهات الاتصال من السياق أو الحالة الداخلية
  const rawContacts = contacts.length > 0 ? contacts : internalContacts;
  const safeContacts = rawContacts.length > 0 ? rawContacts : JSON.parse(localStorage.getItem("contacts_data") || '[]');

  const updateContacts = (newList) => {
    setInternalContacts(newList);
    if (setContacts && typeof setContacts === "function") {
      setContacts(newList);
    }
    if (setContextEmployees && typeof setContextEmployees === "function") {
      setContextEmployees(newList);
    }
  };

  // 1️⃣ استرجاع جهات الاتصال من قاعدة البيانات عند تحميل المكون
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbContacts = await getStoreData(CONTACTS_STORE);
        if (dbContacts && dbContacts.length > 0) {
          updateContacts(dbContacts);
        } else {
          const localData = localStorage.getItem("contacts_data");
          if (localData) {
            updateContacts(JSON.parse(localData));
          } else if (contacts.length > 0) {
            updateContacts(contacts);
          }
        }
      } catch (err) {
        console.warn("استخدام LocalStorage بدلاً من IndexedDB:", err);
        const localData = localStorage.getItem("contacts_data");
        if (localData) {
          updateContacts(JSON.parse(localData));
        }
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, contacts]);

  // 2️⃣ حفظ البيانات تلقائياً عند أي تغيير في قاعدة البيانات والتخزين المحلي
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(CONTACTS_STORE, "readwrite");
        const store = tx.objectStore(CONTACTS_STORE);
        store.clear();
        safeContacts.forEach((c) => store.put(c));

        localStorage.setItem("contacts_data", JSON.stringify(safeContacts));
        localStorage.setItem("employees_data", JSON.stringify(safeContacts));
      } catch (err) {
        localStorage.setItem("contacts_data", JSON.stringify(safeContacts));
        localStorage.setItem("employees_data", JSON.stringify(safeContacts));
      }
    };

    saveData();
  }, [safeContacts, isLoaded]);

  // 📨 إرسال إشعار داخلي حقيقي عند أي تغيير في بيانات الموظفين
  const sendInternalMail = (to, subject, body) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: "HR Contacts System",
      recipient: to,
      subject,
      body,
      read: false
    };
    if (setMails && typeof setMails === 'function') {
      setMails(prev => [...(prev || []), mail]);
    }
  };

  // ➕ إضافة موظف جديد وربطه تلقائياً ببيانات الحضور والرواتب وبقية التطبيقات
  const handleAddContact = (e) => {
    e.preventDefault();
    if (!canManageContacts(currentUser?.role)) {
      alert("❌ لا تملك صلاحية إضافة موظفين.");
      return;
    }
    if (!newName || !newEmail || !newPhone) return;

    const newContactId = Date.now();
    const newContactObj = {
      id: newContactId,
      name: newName,
      email: newEmail,
      phone: newPhone,
      image: newImage || null,
      status: "غير محدد"
    };

    const updatedList = [...safeContacts, newContactObj];
    updateContacts(updatedList);

    // إرسال إشعار بريدي داخلي للمدير
    sendInternalMail("manager@company.com", "👤 إضافة موظف جديد", `تم إضافة الموظف الحقيقي ${newName} بنجاح إلى النظام.`);

    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewImage("");
  };

  // 🗑️ حذف موظف وتحديث كافة التطبيقات المرتبطة
  const handleDeleteContact = (id, empName) => {
    if (!canManageContacts(currentUser?.role)) {
      alert("❌ لا تملك صلاحية حذف موظفين.");
      return;
    }
    const updatedList = safeContacts.filter((c) => c.id !== id);
    updateContacts(updatedList);

    sendInternalMail("manager@company.com", "🗑️ حذف موظف", `تم حذف الموظف ${empName || 'غير معروف'} من النظام.`);
  };

  // ✏️ تعديل بيانات الموظف وتحديثها في كل الأنظمة
  const handleUpdateContact = (id, field, value) => {
    if (!canManageContacts(currentUser?.role)) {
      alert("❌ لا تملك صلاحية تعديل بيانات الموظفين.");
      return;
    }
    const updatedList = safeContacts.map((c) => (c.id === id ? { ...c, [field]: value } : c));
    updateContacts(updatedList);
  };

  // 🔍 فلترة الموظفين
  const filteredContacts = safeContacts.filter((c) =>
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || "").includes(searchTerm)
  );

  return (
    <div style={{ background: "#1e293b", padding: "20px", borderRadius: "12px", color: "#fff" }} dir="rtl">
      <h3 style={{ marginBottom: "15px", color: "#ec4899" }}>📇 إيميلات وأرقام الموظفين (المربوطة مركزياً - AppContext & IndexedDB)</h3>

      {/* البحث */}
      <input
        type="text"
        placeholder="🔍 ابحث عن موظف حقيقي..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ ...inputStyle, marginBottom: "15px", width: "100%", boxSizing: "border-box" }}
      />

      {/* إضافة موظف جديد */}
      {canManageContacts(currentUser?.role) && (
        <form onSubmit={handleAddContact} style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="اسم الموظف..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '130px' }}
          />
          <input
            type="email"
            placeholder="الإيميل..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
          />
          <input
            type="text"
            placeholder="رقم الهاتف..."
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '120px' }}
          />
          <input
            type="text"
            placeholder="رابط صورة الموظف..."
            value={newImage}
            onChange={(e) => setNewImage(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
          />
          <button
            type="submit"
            style={{
              background: "#10b981",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            إضافة ➕
          </button>
        </form>
      )}

      {/* قائمة الموظفين */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredContacts.length === 0 ? (
          <p style={{ color: "#9ca3af", textAlign: "center", padding: "10px" }}>لا توجد بيانات موظفين حقيقية مطابقة</p>
        ) : (
          filteredContacts.map((c) => (
            <div key={c.id} style={{
              background: "#111827",
              padding: "12px",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              border: "1px solid #334155"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.name}
                    style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>👤</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ color: '#38bdf8' }}>👤</span>
                  <input
                    type="text"
                    defaultValue={c.name}
                    onBlur={(e) => handleUpdateContact(c.id, "name", e.target.value)}
                    style={{ ...inputStyle, width: "120px" }}
                  />
                  <span style={{ color: '#94a3b8' }}>📧</span>
                  <input
                    type="email"
                    defaultValue={c.email}
                    onBlur={(e) => handleUpdateContact(c.id, "email", e.target.value)}
                    style={{ ...inputStyle, width: "160px" }}
                  />
                  <span style={{ color: '#94a3b8' }}>📱</span>
                  <input
                    type="text"
                    defaultValue={c.phone}
                    onBlur={(e,) => handleUpdateContact(c.id, "phone", e.target.value)}
                    style={{ ...inputStyle, width: "120px" }}
                  />
                </div>
              </div>

              {canManageContacts(currentUser?.role) && (
                <button
                  type="button"
                  onClick={() => handleDeleteContact(c.id, c.name)}
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  حذف 🗑️
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Contacts;