import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = 'HamzaStoreDB';
const STORE_NAME = 'achievements_data';

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

function Achievements({ 
  currentUser = { role: 'manager', name: 'حمزة' }, 
  inputStyle = {} 
}) {
  const { 
    achievements = [], 
    setAchievements, 
    mails = [], 
    setMails 
  } = useApp();

  const defaultAchievements = [
    { id: 1, title: 'إطلاق متجر بطاقات الألعاب بنجاح', description: 'تم تفعيل واجهة البيع الفوري وشحن بطاقات الألعاب للعملاء.', date: '2026-07-26 10:00' },
    { id: 2, title: 'ربط الأنظمة المالية والمحاسبية', description: 'تم إتمام ربط معاملات المبيعات والإيرادات بنظام التحليلات بنسبة 100%.', date: '2026-07-26 15:30' }
  ];

  const currentAchievements = achievements.length > 0 ? achievements : defaultAchievements;

  const [isLoaded, setIsLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const updateAchievements = (newAchList) => {
    if (setAchievements && typeof setAchievements === 'function') {
      setAchievements(newAchList);
    }
  };

  // 1️⃣ قراءة الإنجازات عند فتح الصفحة من التخزين الدائم
  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          if (request.result && request.result.length > 0) {
            updateAchievements(request.result);
          } else {
            const savedLocal = localStorage.getItem('achievements_data');
            if (savedLocal) {
              updateAchievements(JSON.parse(savedLocal));
            } else {
              updateAchievements(defaultAchievements);
            }
          }
          setIsLoaded(true);
        };
      } catch (err) {
        console.warn('استخدام LocalStorage بدلاً من IndexedDB:', err);
        const savedLocal = localStorage.getItem('achievements_data');
        updateAchievements(savedLocal ? JSON.parse(savedLocal) : defaultAchievements);
        setIsLoaded(true);
      }
    };

    loadAchievements();
  }, []);

  // 2️⃣ حفظ الإنجازات تلقائياً عند أي إضافة أو تعديل أو حذف
  useEffect(() => {
    if (!isLoaded) return;

    const saveAchievements = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        store.clear();
        currentAchievements.forEach(a => store.put(a));

        localStorage.setItem('achievements_data', JSON.stringify(currentAchievements));
      } catch (err) {
        localStorage.setItem('achievements_data', JSON.stringify(currentAchievements));
      }
    };

    saveAchievements();
  }, [currentAchievements, isLoaded]);

  // 📨 إرسال بريد أو إشعار داخلي عند أي عملية إنجاز
  const sendMail = (to, subject, body, attachment = null) => {
    const mail = {
      id: Date.now(),
      sender: currentUser?.name || "نظام الإنجازات",
      recipient: to,
      subject,
      body,
      attachment,
      read: false,
      date: new Date().toLocaleString()
    };
    if (setMails && typeof setMails === 'function') {
      setMails(prev => Array.isArray(prev) ? [...prev, mail] : [mail]);
    }
  };

  // ➕ إضافة إنجاز جديد مع التوثيق الكامل وتحديث النظام
  const handleAddAchievement = (e) => {
    e.preventDefault();
    if (!newTitle || !newDescription) {
      alert('⚠️ يرجى إدخال عنوان الإنجاز ووصفه بالتفصيل.');
      return;
    }

    const newAch = {
      id: Date.now(),
      title: newTitle,
      description: newDescription,
      date: new Date().toLocaleString()
    };

    updateAchievements([newAch, ...currentAchievements]);

    // إرسال إشعار للمدير/النظام
    sendMail(
      "manager@company.com",
      "🏆 تسجيل إنجاز مؤسسي جديد",
      `تم تسجيل إنجاز جديد بعنوان: (${newTitle}).\nالتفاصيل: ${newDescription}\nبواسطة: ${currentUser?.name || 'مدير النظام'}`,
      "achievement_report.pdf"
    );

    setNewTitle('');
    setNewDescription('');
  };

  // 🗑️ حذف إنجاز مع توثيق السجل
  const handleDeleteAchievement = (id) => {
    const target = currentAchievements.find(a => a.id === id);
    updateAchievements(currentAchievements.filter(a => a.id !== id));

    const logText = `🗑️ تم حذف إنجاز بعنوان: (${target?.title || id})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }
  };

  // ✏️ بدء وضع التعديل
  const startEditing = (ach) => {
    setEditingId(ach.id);
    setEditTitle(ach.title);
    setEditDescription(ach.description);
  };

  // 💾 حفظ التعديل
  const saveEdit = (id) => {
    if (!editTitle || !editDescription) {
      alert('⚠️ لا يمكن ترك الحقول فارغة.');
      return;
    }

    updateAchievements(currentAchievements.map(a => a.id === id ? { ...a, title: editTitle, description: editDescription } : a));
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  // 🔍 فلترة الإنجازات بذكاء
  const filteredAchievements = currentAchievements.filter(a =>
    (a.title && a.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#facc15', fontSize: '22px', fontWeight: 'bold' }}>
            🏆 لوحة إدارة الإنجازات والتميز (Achievements) - مرتبطة تلقائياً
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>توثيق ومتابعة الإنجازات التشغيلية للمتجر، ربطها بتقارير الإدارة والبريد، والاحتفاظ بسجل دائم للأداء.</p>
        </div>
        <div style={{ background: '#1e293b', color: '#38bdf8', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
          إجمالي الإنجازات: {currentAchievements.length}
        </div>
      </div>

      {/* نموذج إضافة إنجاز جديد */}
      <form onSubmit={handleAddAchievement} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>➕ توثيق إنجاز مؤسسي جديد</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="عنوان الإنجاز الرئيسي..." 
            value={newTitle} 
            onChange={(e) => setNewTitle(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />
          <input 
            type="text" 
            placeholder="تفاصيل ووصف الإنجاز..." 
            value={newDescription} 
            onChange={(e) => setNewDescription(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />
        </div>

        <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          إضافة الإنجاز وتوثيقه بالنظام وإرسال الإشعار ➕
        </button>
      </form>

      {/* شريط البحث */}
      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#facc15', fontSize: '14px' }}>🔍 البحث في سجل الإنجازات</h4>
        <input
          type="text"
          placeholder="ابحث في عناوين ووصف الإنجازات..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}
        />
      </div>

      {/* قائمة الإنجازات */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredAchievements.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>لا توجد إنجازات مطابقة لنتائج البحث</p>
        ) : (
          filteredAchievements.map((a) => (
            <div key={a.id} style={{ background: '#111827', padding: '16px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              
              {editingId === a.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1' }}>
                  <input 
                    type="text" 
                    value={editTitle} 
                    onChange={(e) => setEditTitle(e.target.value)} 
                    style={{ background: '#0b0f19', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                  />
                  <input 
                    type="text" 
                    value={editDescription} 
                    onChange={(e) => setEditDescription(e.target.value)} 
                    style={{ background: '#0b0f19', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} 
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: '#94a3b8' }}>📅 {a.date || 'وقت سابق'}</span>
                    <strong style={{ color: '#facc15', fontSize: '15px' }}>{a.title}</strong>
                  </div>
                  <p style={{ margin: '4px 0 0 0', color: '#fff', fontSize: '14px' }}>📝 {a.description}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                {editingId === a.id ? (
                  <button 
                    onClick={() => saveEdit(a.id)} 
                    style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    حفظ ✔️
                  </button>
                ) : (
                  <button 
                    onClick={() => startEditing(a)} 
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    تعديل ✏️
                  </button>
                )}
                
                <button 
                  onClick={() => handleDeleteAchievement(a.id)} 
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  حذف 🗑️
                </button>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}

export default Achievements;