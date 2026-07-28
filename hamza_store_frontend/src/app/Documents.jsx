import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from './AppContext';

// 🛠️ إدارة التخزين الفائق للمستندات (IndexedDB / LocalStorage Fallback)
const DB_NAME = "HamzaStoreDB";
const DOCS_STORE = "documents_data";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB غير مدعوم في هذا المتصفح");
      return;
    }
    const request = indexedDB.open(DB_NAME, 2); // إصدار قاعدة البيانات
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

function Documents({ 
  documents: externalDocuments, 
  setDocuments: externalSetDocuments = () => {}, 
  mails = [], 
  setMails = () => {}, 
  inputStyle = {},
  employees = [],
  currentUser = {}
}) {
  // 🔗 جلب البيانات وتحديثاتها مباشرة من AppContext للمزامنة المركزية الشاملة
  const { 
    documents: contextDocuments = [], 
    setDocuments: setContextDocuments,
    mails: contextMails = [],
    setMails: setContextMails,
    employees: contextEmployees = [],
    currentUser: contextCurrentUser
  } = useApp();

  const [internalDocuments, setInternalDocuments] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('pdf');
  const [searchTerm, setSearchTerm] = useState('');
  const [tags, setTags] = useState('');
  const [author, setAuthor] = useState('');
  const [file, setFile] = useState(null);
  
  // حالة التحكم في التعديل المباشر
  const [editingId, setEditingId] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  // دمج البيانات من السياق المركزي أو الخواص الممررة
  const safeCurrentUser = currentUser && Object.keys(currentUser).length > 0 ? currentUser : (contextCurrentUser || { name: "مسؤول النظام", role: "مدير" });
  const safeEmployees = employees.length > 0 ? employees : (contextEmployees.length > 0 ? contextEmployees : JSON.parse(localStorage.getItem("employees_data") || '[]'));
  
  const safeDocuments = externalDocuments !== undefined && externalDocuments.length > 0 
    ? externalDocuments 
    : (contextDocuments.length > 0 ? contextDocuments : internalDocuments);

  const updateDocuments = (newList) => {
    setInternalDocuments(newList);
    if (externalSetDocuments && typeof externalSetDocuments === "function") {
      externalSetDocuments(newList);
    }
    if (setContextDocuments && typeof setContextDocuments === "function") {
      setContextDocuments(newList);
    }
  };

  const updateGlobalMails = (updater) => {
    if (setMails && typeof setMails === "function") {
      setMails(updater);
    }
    if (setContextMails && typeof setContextMails === "function") {
      setContextMails(updater);
    }
  };

  // 1️⃣ استرجاع بيانات المستندات عند التحميل
  useEffect(() => {
    const loadData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(DOCS_STORE, "readonly");
        const store = tx.objectStore(DOCS_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            updateDocuments(req.result);
          } else if (contextDocuments.length > 0) {
            updateDocuments(contextDocuments);
          } else {
            const localData = localStorage.getItem("documents_data");
            if (localData) updateDocuments(JSON.parse(localData));
          }
        };
      } catch (err) {
        console.warn("استخدام LocalStorage بدلاً من IndexedDB للمستندات:", err);
        if (contextDocuments.length > 0) {
          updateDocuments(contextDocuments);
        } else {
          const localData = localStorage.getItem("documents_data");
          if (localData) updateDocuments(JSON.parse(localData));
        }
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, contextDocuments]);

  // 2️⃣ حفظ بيانات المستندات تلقائياً عند أي تغيير (IndexedDB & LocalStorage)
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(DOCS_STORE, "readwrite");
        const store = tx.objectStore(DOCS_STORE);
        store.clear();
        safeDocuments.forEach((d) => {
          if (d && d.id) store.put(d);
        });

        localStorage.setItem("documents_data", JSON.stringify(safeDocuments));
      } catch (err) {
        localStorage.setItem("documents_data", JSON.stringify(safeDocuments));
      }
    };

    saveData();
  }, [safeDocuments, isLoaded]);

  // 📨 إرسال بريد داخلي حقيقي ومربوط بالنظام العام (Mails App)
  const sendInternalMail = (to, subject, body) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: safeCurrentUser?.name || "نظام الأرشيف والمستندات",
      recipient: to,
      subject,
      body,
      date: new Date().toLocaleString("ar-JO"),
      read: false
    };
    updateGlobalMails(prev => [...(prev || []), mail]);
  };

  // 🌍 إرسال بريد خارجي حقيقي
  const sendExternalMail = async (to, subject, body) => {
    try {
      await axios.post("/api/sendExternalMail", { to, subject, body });
    } catch (err) {
      console.error("خطأ في إرسال البريد الخارجي:", err);
    }
  };

  // ➕ إضافة مستند جديد مع رفع ملف وتحويله لقراءة دائمة
  const handleAddDocument = (e) => {
    e.preventDefault();
    if (!title || !description) {
      alert("⚠️ يرجى إدخال عنوان المستند والوصف على الأقل.");
      return;
    }

    const processFileAndSave = (fileData = null) => {
      const newDocId = Date.now();
      const writerName = author || safeCurrentUser?.name || "مسؤول النظام";
      const newDoc = {
        id: newDocId,
        title,
        description,
        type,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
        author: writerName,
        date: new Date().toLocaleString("ar-JO"),
        deleted: false,
        version: 1,
        history: [],
        file: fileData
      };

      const updated = [...safeDocuments, newDoc];
      updateDocuments(updated);

      // إرسال إشعارات وبريد حقيقي للموظفين والإدارة
      const message = `تم رفع مستند جديد بعنوان: "${title}"\nالنوع: ${type}\nالكاتب: ${writerName}\nالوصف: ${description}`;
      
      sendInternalMail("all-employees", "📂 مستند جديد في النظام", message);

      if (Array.isArray(safeEmployees) && safeEmployees.length > 0) {
        safeEmployees.forEach(emp => {
          if (emp && emp.email) {
            sendExternalMail(emp.email, "📂 تم إضافة مستند جديد", message);
          }
        });
      }

      setTitle('');
      setDescription('');
      setType('pdf');
      setTags('');
      setAuthor('');
      setFile(null);
    };

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        processFileAndSave({ name: file.name, url: reader.result });
      };
      reader.readAsDataURL(file);
    } else {
      processFileAndSave(null);
    }
  };

  // 🗑️ حذف مستند (يبقى ظاهر مع حالة محذوف وإشعار حقيقي)
  const handleDeleteDocument = (docId, docTitle) => {
    const updatedDocs = safeDocuments.map(d =>
      d && d.id === docId ? { ...d, deleted: true } : d
    );
    updateDocuments(updatedDocs);

    sendInternalMail("management", "⚠️ حذف مستند", `تم حذف المستند "${docTitle || 'بدون عنوان'}" من الأرشيف بواسطة ${safeCurrentUser?.name || 'النظام'}.`);
  };

  // ✏️ حفظ تعديل وصف المستند (يزيد رقم النسخة ويؤرخ التغيير)
  const handleSaveEdit = (docId, docTitle) => {
    if (!editDesc.trim()) return;

    const updatedDocs = safeDocuments.map(d => {
      if (!d || d.id !== docId) return d;
      const currentHistory = Array.isArray(d.history) ? d.history : [];
      return {
        ...d,
        description: editDesc,
        version: (d.version || 1) + 1,
        history: [...currentHistory, { version: d.version || 1, description: d.description || '', date: new Date().toLocaleString("ar-JO") }]
      };
    });

    updateDocuments(updatedDocs);
    sendInternalMail("management", "📝 تحديث مستند", `تم تعديل وتحديث النسخة للمستند: "${docTitle || 'بدون عنوان'}" بواسطة ${safeCurrentUser?.name || 'النظام'}`);
    setEditingId(null);
    setEditDesc('');
  };

  // 🔍 فلترة المستندات بشكل آمن
  const filteredDocs = safeDocuments.filter(d => {
    if (!d) return false;
    const titleMatch = (d.title || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const descMatch = (d.description || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const tagsMatch = Array.isArray(d.tags) && d.tags.some(tag => (tag || '').toLowerCase().includes((searchTerm || '').toLowerCase()));
    return titleMatch || descMatch || tagsMatch;
  });

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* 🏷️ العنوان الرئيسي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '22px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📂 إدارة المستندات والأرشيف (المربوطة مركزياً)
          </h3>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة الأرشيف الإلكتروني، رفع المستندات، إصدارات النسخ، والتنبيهات التلقائية.</p>
        </div>
      </div>

      {/* 🔍 البحث */}
      <div style={{ marginBottom: '25px' }}>
        <input
          type="text"
          placeholder="🔍 ابحث بالاسم، الوصف، أو الوسوم..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', background: '#111827', border: '1px solid #334155', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '14px', boxSizing: 'border-box', ...inputStyle }}
        />
      </div>

      {/* ➕ إضافة مستند جديد */}
      <form onSubmit={handleAddDocument} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0', color: '#10b981', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ➕ إضافة مستند جديد للأرشيف
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="اسم المستند..." value={title} onChange={(e) => setTitle(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          <input type="text" placeholder="الوصف..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          
          {Array.isArray(safeEmployees) && safeEmployees.length > 0 ? (
            <select value={author} onChange={(e) => setAuthor(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
              <option value="">اختر الموظف الكاتب الحقيقي...</option>
              {safeEmployees.map(emp => (
                emp && <option key={emp.id} value={emp.name}>{emp.name} ({emp.role || 'موظف'})</option>
              ))}
            </select>
          ) : (
            <input type="text" placeholder="الكاتب..." value={author} onChange={(e) => setAuthor(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="وسوم (افصل بينهم بفاصلة: تقرير, مبيعات)..." value={tags} onChange={(e) => setTags(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="pdf">📄 PDF</option>
            <option value="word">📝 Word</option>
            <option value="excel">📊 Excel</option>
            <option value="image">🖼️ صورة</option>
          </select>

          <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '8px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
        </div>
        
        <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', alignSelf: 'flex-start' }}>
          حفظ وإضافة للأرشيف 🚀
        </button>
      </form>

      {/* قائمة المستندات */}
      <h3 style={{ color: '#38bdf8', fontSize: '16px', marginBottom: '15px' }}>📋 مستندات الأرشيف الحالية</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
        {filteredDocs.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '25px', background: '#111827', borderRadius: '12px' }}>
            لا توجد مستندات مطابقة للبحث
          </p>
        ) : (
          filteredDocs.map((d, index) => {
            if (!d) return null;
            const docTags = Array.isArray(d.tags) ? d.tags : [];
            const docHistory = Array.isArray(d.history) ? d.history : [];
            const isEditing = editingId === d.id;

            return (
              <div key={d.id || index} style={{ background: '#111827', padding: '18px', borderRadius: '16px', border: '1px solid #1f2937', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ margin: '0', color: '#f8fafc', fontSize: '16px' }}>📂 {d.title} <span style={{ color: '#38bdf8', fontSize: '13px' }}>({d.type})</span></h4>
                  <span style={{ background: d.deleted ? '#7f1d1d' : '#065f46', color: d.deleted ? '#fca5a5' : '#34d399', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                    {d.deleted ? "❌ محذوف" : "✅ نشط"} (v{d.version || 1})
                  </span>
                </div>

                <p style={{ margin: '0 0 6px 0', color: '#94a3b8', fontSize: '12px' }}>📅 التاريخ: {d.date || "تاريخ غير محدد"} | ✍️ الكاتب: {d.author || "غير محدد"}</p>
                <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '12px' }}>🏷️ الوسوم: {docTags.length > 0 ? docTags.map(t => `#${t}`).join(' ') : "لا يوجد"}</p>
                
                <p style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '12px' }}>
                  📎 الملف: {d.file ? (
                    <a href={d.file.url} download={d.file.name} style={{ color: '#60a5fa', textDecoration: 'underline' }}>
                      تنزيل ({d.file.name})
                    </a>
                  ) : "لا يوجد ملف مرفوع"}
                </p>

                <div style={{ marginTop: '10px', background: '#0b0f19', padding: '12px', borderRadius: '10px', border: '1px solid #1e293b' }}>
                  <strong style={{ color: '#cbd5e1', fontSize: '13px' }}>📝 الوصف: </strong>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <input 
                        type="text" 
                        value={editDesc} 
                        onChange={(e) => setEditDesc(e.target.value)} 
                        style={{ background: '#111827', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '13px', flex: '1 1 200px', ...inputStyle }} 
                      />
                      <button onClick={() => handleSaveEdit(d.id, d.title)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        حفظ النسخة 💾
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        إلغاء ✖
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#f1f5f9', fontSize: '13px' }}>{d.description}</span>
                  )}
                </div>

                {!d.deleted && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => handleDeleteDocument(d.id, d.title)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      حذف 🗑️
                    </button>
                    {!isEditing && (
                      <button onClick={() => { setEditingId(d.id); setEditDesc(d.description || ''); }} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        تعديل الوصف والنسخة ✏️
                      </button>
                    )}
                  </div>
                )}

                {docHistory.length > 0 && (
                  <div style={{ marginTop: '12px', background: '#0b0f19', padding: '10px', borderRadius: '8px', fontSize: '12px', border: '1px solid #1e293b' }}>
                    <strong style={{ color: '#93c5fd' }}>📜 سجل التغييرات والنسخ السابقة:</strong>
                    {docHistory.map((h, i) => (
                      <div key={i} style={{ color: '#9ca3af', marginTop: '4px' }}>
                        • v{h.version} — {h.description} — 📅 {h.date}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* تقرير كامل */}
      <div style={{ marginTop: '30px', background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #334155', overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#38bdf8', fontSize: '16px' }}>📊 تقرير الأرشيف والمستندات الشامل</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', minWidth: '650px', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'right' }}>
              <th style={{ padding: '10px', borderRadius: '8px 0 0 8px' }}>الاسم</th>
              <th style={{ padding: '10px' }}>الوصف</th>
              <th style={{ padding: '10px' }}>الكاتب</th>
              <th style={{ padding: '10px' }}>النوع</th>
              <th style={{ padding: '10px' }}>الوسوم</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>النسخة</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>الحالة</th>
              <th style={{ padding: '10px', textAlign: 'center', borderRadius: '0 8px 8px 0' }}>الملف</th>
            </tr>
          </thead>
          <tbody>
            {safeDocuments.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>لا توجد بيانات للتقرير</td>
              </tr>
            ) : (
              safeDocuments.map((d, index) => {
                if (!d) return null;
                const docTags = Array.isArray(d.tags) ? d.tags : [];
                return (
                  <tr key={d.id || index} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{d.title}</td>
                    <td style={{ padding: '10px', color: '#94a3b8' }}>{d.description}</td>
                    <td style={{ padding: '10px' }}>{d.author || "غير محدد"}</td>
                    <td style={{ padding: '10px', textTransform: 'uppercase' }}>{d.type}</td>
                    <td style={{ padding: '10px', color: '#38bdf8' }}>{docTags.length > 0 ? docTags.join(', ') : "لا يوجد"}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>v{d.version || 1}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: d.deleted ? '#fca5a5' : '#34d399' }}>{d.deleted ? "❌ محذوف" : "✅ نشط"}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {d.file ? <a href={d.file.url} download={d.file.name} style={{ color: '#60a5fa', textDecoration: 'underline' }}>تنزيل</a> : "لا يوجد"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Documents;