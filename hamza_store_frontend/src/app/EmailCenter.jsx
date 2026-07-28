import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from './AppContext';

// 🛠️ إدارة التخزين الفائق لمركز البريد (IndexedDB / LocalStorage Fallback)
const DB_NAME = "HamzaStoreDB";
const MAILS_STORE = "emails_data";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB غير مدعوم في هذا المتصفح");
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(MAILS_STORE)) {
        db.createObjectStore(MAILS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

function EmailCenter({ 
  mails: externalMails, 
  setEmails: externalSetEmails = () => {}, 
  documents = [], 
  inputStyle = {} 
}) {
  // 🔗 جلب البيانات وتحديثاتها مباشرة من AppContext للمزامنة المركزية الشاملة
  const { 
    mails: contextMails = [], 
    setMails: setContextMails,
    documents: contextDocuments = []
  } = useApp();

  const [internalMails, setInternalMails] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [currentFolder, setCurrentFolder] = useState('inbox'); // inbox, sent, spam, archive
  const [filterBySender, setFilterBySender] = useState('');
  const [filterByRecipient, setFilterByRecipient] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 📝 حالات إدارة التعديل الشامل والنافذة المنبثقة
  const [editingMailId, setEditingMailId] = useState(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editRecipient, setEditRecipient] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // دمج المستندات من الخواص أو السياق المركزي
  const safeDocuments = documents.length > 0 ? documents : (contextDocuments.length > 0 ? contextDocuments : []);
  const safeMails = externalMails !== undefined && externalMails.length > 0 
    ? externalMails 
    : (contextMails.length > 0 ? contextMails : internalMails);

  const updateEmails = (newList) => {
    setInternalMails(newList);
    if (externalSetEmails && typeof externalSetEmails === "function") {
      externalSetEmails(newList);
    }
    if (setContextMails && typeof setContextMails === "function") {
      setContextMails(newList);
    }
  };

  // 1️⃣ استرجاع البريد الإلكتروني عند التحميل
  useEffect(() => {
    const loadData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(MAILS_STORE, "readonly");
        const store = tx.objectStore(MAILS_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            updateEmails(req.result);
          } else if (contextMails.length > 0) {
            updateEmails(contextMails);
          } else {
            const localData = localStorage.getItem("emails_data");
            if (localData) updateEmails(JSON.parse(localData));
          }
        };
      } catch (err) {
        console.warn("استخدام LocalStorage بدلاً من IndexedDB للبريد:", err);
        if (contextMails.length > 0) {
          updateEmails(contextMails);
        } else {
          const localData = localStorage.getItem("emails_data");
          if (localData) updateEmails(JSON.parse(localData));
        }
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, contextMails]);

  // 2️⃣ حفظ البريد تلقائياً عند أي تغيير (IndexedDB & LocalStorage)
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(MAILS_STORE, "readwrite");
        const store = tx.objectStore(MAILS_STORE);
        store.clear();
        safeMails.forEach((m) => {
          if (m && m.id) store.put(m);
        });

        localStorage.setItem("emails_data", JSON.stringify(safeMails));
      } catch (err) {
        localStorage.setItem("emails_data", JSON.stringify(safeMails));
      }
    };

    saveData();
  }, [safeMails, isLoaded]);

  // ✉️ التحقق من صحة البريد
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  // 📨 إرسال البريد الإلكتروني المحلي والخارجي
  const sendEmailOnly = async () => {
    if (!recipient.trim()) {
      alert("الرجاء إدخال البريد الإلكتروني للمستلم بشكل إجباري!");
      return;
    }

    if (!validateEmail(recipient)) {
      alert("البريد الإلكتروني المدخل غير صحيح! الرجاء التأكد من كتابة البريد بشكل سليم (يجب أن يحتوي على @ ونطاق صحيح).");
      return;
    }

    if (!subject.trim()) {
      alert("الرجاء إدخال موضوع البريد!");
      return;
    }

    setIsSending(true);

    // البحث عن المستند المرفق إن وجد
    const attachedDoc = Array.isArray(safeDocuments) ? safeDocuments.find(d => d && String(d.id) === String(selectedDocId)) : null;

    const newMail = {
      id: Date.now(),
      sender: "مسؤول النظام (Hamza)",
      recipient,
      subject,
      body,
      read: false,
      type: "email",
      date: new Date().toLocaleString("ar-JO"),
      deleted: false,
      archived: false,
      folder: "sent",
      attachment: attachedDoc ? { id: attachedDoc.id, title: attachedDoc.title } : null
    };

    try {
      // المحاولة لإرسال البريد عبر السيرفر الخارجي
      await axios.post("/api/sendExternalMail", {
        to: recipient,
        subject,
        body,
        attachment: attachedDoc
      });
    } catch (err) {
      console.warn("تعذر إرسال البريد الخارجي عبر السيرفر، تم التخزين محلياً داخل النظام:", err);
    }

    updateEmails([...safeMails, newMail]);
    clearForm();
    setIsSending(false);
    setIsComposeOpen(false);
  };

  // ✏️ بدء تعديل رسالة
  const startEditingMail = (m) => {
    setEditingMailId(m.id);
    setEditSubject(m.subject || '');
    setEditBody(m.body || '');
    setEditRecipient(m.recipient || '');
  };

  // 💾 حفظ التعديل على الرسالة
  const saveEditedMail = (id) => {
    if (!editSubject.trim()) {
      alert("موضوع الرسالة لا يمكن أن يكون فارغاً!");
      return;
    }
    const updated = safeMails.map(m => m && m.id === id ? { 
      ...m, 
      subject: editSubject, 
      body: editBody,
      recipient: editRecipient || m.recipient
    } : m);
    updateEmails(updated);
    setEditingMailId(null);
  };

  // 🗑️ حذف بريد (نقل للسبام)
  const deleteMail = (id) => {
    const updated = safeMails.map(m => m && m.id === id ? { ...m, deleted: true, folder: "spam" } : m);
    updateEmails(updated);
  };

  // 📖 قراءة بريد
  const markAsRead = (id) => {
    const updated = safeMails.map(m => m && m.id === id ? { ...m, read: true } : m);
    updateEmails(updated);
  };

  // 📦 أرشفة بريد
  const archiveMail = (id) => {
    const updated = safeMails.map(m => m && m.id === id ? { ...m, archived: true, folder: "archive" } : m);
    updateEmails(updated);
  };

  // 🧹 تنظيف النموذج
  const clearForm = () => {
    setRecipient('');
    setSubject('');
    setBody('');
    setSelectedDocId('');
  };

  // 🔍 فلترة البريد
  const filteredMails = safeMails.filter(m => {
    if (!m) return false;
    const matchesSearch = (m.subject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.body || "").toLowerCase().includes(searchTerm.toLowerCase());
    const notDeleted = !m.deleted || currentFolder === 'spam';
    const inFolder = m.folder === currentFolder;
    const matchesSender = filterBySender ? (m.sender || "").toLowerCase().includes(filterBySender.toLowerCase()) : true;
    const matchesRecipient = filterByRecipient ? (m.recipient || "").toLowerCase().includes(filterByRecipient.toLowerCase()) : true;

    return matchesSearch && notDeleted && inFolder && matchesSender && matchesRecipient;
  });

  // 📊 إحصائيات البريد
  const totalInbox = safeMails.filter(m => m && m.folder === "inbox" && !m.deleted).length;
  const totalSent = safeMails.filter(m => m && m.folder === "sent" && !m.deleted).length;
  const totalSpam = safeMails.filter(m => m && (m.folder === "spam" || m.deleted)).length;
  const totalArchive = safeMails.filter(m => m && m.folder === "archive" && !m.deleted).length;

  return (
    <div style={{ background: 'linear-gradient(135deg, #090d16 0%, #111827 100%)', padding: '30px', borderRadius: '20px', color: '#fff', fontFamily: 'Tajawal, sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} dir="rtl">
      
      {/* عنوان القسم مع زر إضافة رسالة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', width: '45px', height: '45px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)' }}>
            📧
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: '800' }}>مركز البريد الإلكتروني المتطور (المربوط مركزياً)</h3>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>إدارة ومتابعة المراسلات والرسائل باحترافية تامة</span>
          </div>
        </div>

        <button 
          onClick={() => setIsComposeOpen(!isComposeOpen)}
          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', color: '#0f172a', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>✍️</span> {isComposeOpen ? "إخفاء نموذج الإنشاء" : "إنشاء رسالة جديدة"}
        </button>
      </div>

      {/* البحث والفلترة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <input
          type="text"
          placeholder="🔍 ابحث في رسائل البريد..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', fontSize: '14px', ...inputStyle }}
        />
        <input
          type="text"
          placeholder="👤 فلترة حسب المرسل..."
          value={filterBySender}
          onChange={(e) => setFilterBySender(e.target.value)}
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', fontSize: '14px', ...inputStyle }}
        />
        <input
          type="text"
          placeholder="📍 فلترة حسب المستلم..."
          value={filterByRecipient}
          onChange={(e) => setFilterByRecipient(e.target.value)}
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', fontSize: '14px', ...inputStyle }}
        />
      </div>

      {/* نموذج إرسال بريد إلكتروني جديد (يظهر ويختفي حسب الزر) */}
      {isComposeOpen && (
        <form onSubmit={(e) => e.preventDefault()} style={{ background: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(10px)', padding: '25px', borderRadius: '18px', border: '1px solid rgba(51, 65, 85, 0.6)', marginBottom: '30px', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>
          <h4 style={{ margin: '0 0 18px 0', color: '#38bdf8', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✉️</span> إنشاء وإرسال رسالة جديدة
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#38bdf8', marginBottom: '6px', fontWeight: 'bold' }}>البريد الإلكتروني للمستلم (إجباري وصحيح) *</label>
              <input 
                type="email" 
                placeholder="name@example.com" 
                value={recipient} 
                onChange={(e) => setRecipient(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', fontSize: '14px', ...inputStyle }} 
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#38bdf8', marginBottom: '6px', fontWeight: 'bold' }}>موضوع البريد (إجباري) *</label>
              <input 
                type="text" 
                placeholder="اكتب موضوع الرسالة هنا..." 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', fontSize: '14px', ...inputStyle }} 
                required 
              />
            </div>
          </div>

          {/* إرفاق مستند خياري */}
          {Array.isArray(safeDocuments) && safeDocuments.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>📎 إرفاق مستند من الأرشيف (اختياري)</label>
              <select 
                value={selectedDocId} 
                onChange={(e) => setSelectedDocId(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '12px 16px', borderRadius: '12px', outline: 'none', fontSize: '14px', ...inputStyle }}
              >
                <option value="">-- بدون مستند مرفق --</option>
                {safeDocuments.map(d => d && <option key={d.id} value={d.id}>{d.title} ({d.type})</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>محتوى البريد الإلكتروني</label>
            <textarea 
              placeholder="اكتب تفاصيل ومحتوى الرسالة هنا..." 
              value={body} 
              onChange={(e) => setBody(e.target.value)} 
              style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '14px 16px', borderRadius: '12px', minHeight: '100px', outline: 'none', fontSize: '14px', resize: 'vertical', ...inputStyle }} 
            />
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              onClick={sendEmailOnly} 
              disabled={isSending}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', opacity: isSending ? 0.7 : 1 }}
            >
              {isSending ? "جاري الإرسال..." : "إرسال البريد الإلكتروني 🚀"}
            </button>
            <button 
              type="button" 
              onClick={() => setIsComposeOpen(false)} 
              style={{ background: '#334155', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* شريط التنقل بين المجلدات */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button onClick={() => setCurrentFolder('inbox')} style={{ background: currentFolder === 'inbox' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#1e293b', color: currentFolder === 'inbox' ? '#000' : '#fff', border: '1px solid #334155', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          📥 الوارد ({totalInbox})
        </button>
        <button onClick={() => setCurrentFolder('sent')} style={{ background: currentFolder === 'sent' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#1e293b', color: '#fff', border: '1px solid #334155', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          📤 المرسلة ({totalSent})
        </button>
        <button onClick={() => setCurrentFolder('spam')} style={{ background: currentFolder === 'spam' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#1e293b', color: '#fff', border: '1px solid #334155', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          🚫 السبام ({totalSpam})
        </button>
        <button onClick={() => setCurrentFolder('archive')} style={{ background: currentFolder === 'archive' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#1e293b', color: '#fff', border: '1px solid #334155', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          📦 الأرشيف ({totalArchive})
        </button>
      </div>

      {/* قائمة البريد على شكل بطاقات (Cards Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '22px', marginBottom: '35px' }}>
        {filteredMails.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', background: '#1e293b', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '1px dashed #334155' }}>
            <span style={{ fontSize: '40px' }}>📭</span>
            <p style={{ color: '#9ca3af', marginTop: '10px', fontSize: '15px' }}>لا توجد رسائل بريد في هذا المجلد حالياً.</p>
          </div>
        ) : (
          filteredMails.map((m) => (
            <div key={m.id} style={{ background: 'linear-gradient(145deg, #1e293b 0%, #111827 100%)', border: '1px solid rgba(51, 65, 85, 0.8)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
              
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '18px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '2px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                    ✉️
                  </div>
                  <div style={{ overflow: 'hidden', width: '100%' }}>
                    {editingMailId === m.id ? (
                      <input 
                        type="text" 
                        value={editSubject} 
                        onChange={(e) => setEditSubject(e.target.value)}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '14px', ...inputStyle }}
                      />
                    ) : (
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.subject}</h4>
                    )}
                    <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '3px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: '600' }}>
                      {m.read ? "✅ مقروء" : "📩 غير مقروء"}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>👤 من:</span> <b style={{ color: '#f1f5f9' }}>{m.sender}</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📍 إلى:</span> 
                    {editingMailId === m.id ? (
                      <input 
                        type="text" 
                        value={editRecipient} 
                        onChange={(e) => setEditRecipient(e.target.value)}
                        style={{ background: '#0f172a', border: '1px solid #38bdf8', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', ...inputStyle }}
                      />
                    ) : (
                      <b style={{ color: '#f1f5f9' }}>{m.recipient}</b>
                    )}
                  </div>
                  {m.attachment && (
                    <div style={{ fontSize: '12px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
                      📎 مرفق: {m.attachment.title}
                    </div>
                  )}

                  {editingMailId === m.id ? (
                    <textarea 
                      value={editBody} 
                      onChange={(e) => setEditBody(e.target.value)}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#fff', padding: '10px', borderRadius: '8px', fontSize: '14px', minHeight: '80px', marginTop: '6px', ...inputStyle }}
                    />
                  ) : (
                    <div style={{ background: '#090d16', padding: '12px 14px', borderRadius: '12px', color: '#f8fafc', marginTop: '6px', fontSize: '14px', border: '1px solid #1e293b', lineHeight: '1.5' }}>
                      {m.body || "بدون محتوى"}
                    </div>
                  )}

                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>📅</span> {m.date}
                  </span>
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.6)', paddingTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {editingMailId === m.id ? (
                  <>
                    <button onClick={() => saveEditedMail(m.id)} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      حفظ التعديل ✓
                    </button>
                    <button onClick={() => setEditingMailId(null)} style={{ background: '#475569', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    {!m.read && (
                      <button onClick={() => markAsRead(m.id)} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '9px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        قراءة ✓
                      </button>
                    )}
                    {m.folder !== "archive" && (
                      <button onClick={() => archiveMail(m.id)} style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: '9px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        أرشفة 📦
                      </button>
                    )}
                    <button onClick={() => startEditingMail(m)} style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '9px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="تعديل الرسالة">
                      ✏️ تعديل
                    </button>
                    <button onClick={() => deleteMail(m.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="نقل للسبام والمحذوفات">
                      🚫 حذف
                    </button>
                  </>
                )}
              </div>

            </div>
          ))
        )}
      </div>

      {/* تقرير البريد الشامل */}
      <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(51, 65, 85, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h4 style={{ margin: 0, color: '#f97316', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊</span> تقرير البريد الإلكتروني الشامل
        </h4>
        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', fontSize: '14px', color: '#94a3b8' }}>
          <span>📥 الوارد: <b style={{ color: '#fff' }}>{totalInbox}</b></span>
          <span>📤 المرسلة: <b style={{ color: '#fff' }}>{totalSent}</b></span>
          <span>🚫 السبام: <b style={{ color: '#fff' }}>{totalSpam}</b></span>
          <span>📦 الأرشيف: <b style={{ color: '#fff' }}>{totalArchive}</b></span>
        </div>
      </div>

    </div>
  );
}

export default EmailCenter;