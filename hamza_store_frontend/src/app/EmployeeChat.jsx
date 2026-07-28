import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useApp } from './AppContext';

// 🛠️ إدارة التخزين الفائق لدردشة الفريق المتصلة بنظام المتجر
const DB_NAME = "HamzaStoreIntegratedDB";
const CHATS_STORE = "team_chats_data";

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject("IndexedDB غير مدعوم في هذا المتصفح");
      return;
    }
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CHATS_STORE)) {
        db.createObjectStore(CHATS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

function EmployeeChat({ 
  systemData = {}, // كائن بيانات النظام الكامل الشامل
  employees: externalEmployees = [] // قائمة الموظفين الخارجية إن وجدت
}) {
  // 🔗 جلب البيانات وتحديثاتها مباشرة من AppContext للمزامنة المركزية الشاملة
  const { 
    chats: contextChats = [], 
    setChats: setContextChats,
    employees: contextEmployees = []
  } = useApp();

  const [internalChats, setInternalChats] = useState([]);
  const [currentUser, setCurrentUser] = useState('مسؤول النظام (Hamza)');
  const [message, setMessage] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const chatContainerRef = useRef(null);

  // دمج قائمة الموظفين من الخواص أو السياق المركزي أو نظام البيانات
  const safeEmployees = externalEmployees.length > 0 
    ? externalEmployees 
    : (contextEmployees.length > 0 
      ? contextEmployees 
      : (systemData.employees || []));

  // تحديد قائمة المحادثات النشطة
  const safeChats = externalEmployees !== undefined && contextChats.length > 0 
    ? contextChats 
    : (internalChats.length > 0 ? internalChats : (systemData.chats || []));

  const updateChats = (newList) => {
    setInternalChats(newList);
    if (setContextChats && typeof setContextChats === "function") {
      setContextChats(newList);
    }
  };

  // 1️⃣ استرجاع المحادثات عند التحميل
  useEffect(() => {
    const loadData = async () => {
      if (systemData && systemData.chats && systemData.chats.length > 0) {
        updateChats(systemData.chats);
        setIsLoaded(true);
        return;
      }

      try {
        const db = await openDB();
        const tx = db.transaction(CHATS_STORE, "readonly");
        const store = tx.objectStore(CHATS_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            updateChats(req.result);
          } else if (contextChats.length > 0) {
            updateChats(contextChats);
          } else {
            const saved = localStorage.getItem('hamza_store_chats');
            if (saved) updateChats(JSON.parse(saved));
          }
        };
      } catch (err) {
        console.warn("الاعتماد على التخزين المحلي:", err);
        if (contextChats.length > 0) {
          updateChats(contextChats);
        } else {
          const saved = localStorage.getItem('hamza_store_chats');
          if (saved) updateChats(JSON.parse(saved));
        }
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, systemData, contextChats]);

  // 2️⃣ حفظ وتحديث المحادثات تلقائياً في التخزين الفائق والسياق المركزي
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(CHATS_STORE, "readwrite");
        const store = tx.objectStore(CHATS_STORE);
        store.clear();
        safeChats.forEach((c) => {
          if (c && c.id) store.put(c);
        });

        localStorage.setItem('hamza_store_chats', JSON.stringify(safeChats));

        // مزامنة اختيارية مع الـ Backend الخاص بالنظام
        await axios.post("/api/system/chats", { chats: safeChats }).catch(() => {});
      } catch (err) {
        localStorage.setItem('hamza_store_chats', JSON.stringify(safeChats));
      }
    };

    saveData();
  }, [safeChats, isLoaded]);

  // 3️⃣ التمرير التلقائي لأسفل عند إضافة رسائل جديدة
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [safeChats]);

  // 📨 إرسال رسالة مرتبطة ببيانات النظام
  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newChat = {
      id: Date.now(),
      sender: currentUser,
      message: message.trim(),
      date: new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' }),
      deleted: false
    };

    updateChats([...safeChats, newChat]);
    setMessage('');
  };

  // 🗑️ حذف رسالة
  const deleteMessage = (id) => {
    const updated = safeChats.map(c => c && c.id === id ? { ...c, deleted: true } : c);
    updateChats(updated);
  };

  const activeChats = safeChats.filter(c => c && !c.deleted);

  return (
    <div style={{ background: '#0f172a', padding: '25px', borderRadius: '20px', color: '#fff', fontFamily: 'Tajawal, sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }} dir="rtl">
      
      {/* رأس لوحة الدردشة مع قائمة الموظفين المربوطة بالنظام */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>💬</span>
          <h3 style={{ margin: '0', color: '#f97316', fontSize: '20px', fontWeight: 'bold' }}>دردشة الفريق (مرتبطة بقاعدة بيانات النظام المركزية)</h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e293b', padding: '8px 14px', borderRadius: '12px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 'bold' }}>أنت تتحدث باسم:</span>
          <select 
            value={currentUser} 
            onChange={(e) => setCurrentUser(e.target.value)} 
            style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            <option value="مسؤول النظام (Hamza)">👑 مسؤول النظام (Hamza)</option>
            {safeEmployees.map(emp => emp && (
              <option key={emp.id || emp.name} value={emp.name || emp.title}>
                👤 {emp.name || emp.title} {emp.role ? `(${emp.role})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* شاشة عرض الرسائل */}
      <div 
        ref={chatContainerRef}
        style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', height: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}
      >
        {activeChats.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', margin: 'auto', fontSize: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '40px' }}>💬</span>
            <span>لا توجد رسائل حالياً. ابدأ المحادثة مع فريق العمل المعتمد في النظام! 🚀</span>
          </div>
        ) : (
          activeChats.map(c => {
            const isMe = c.sender === currentUser;
            return (
              <div 
                key={c.id} 
                style={{ 
                  background: isMe ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#1e293b', 
                  border: isMe ? '1px solid #38bdf8' : '1px solid #334155', 
                  padding: '14px 18px', 
                  borderRadius: '16px', 
                  maxWidth: '75%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#38bdf8', marginBottom: '8px', gap: '15px' }}>
                  <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>{isMe ? '👑' : '👤'}</span> {c.sender}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>{c.date}</span>
                </div>

                <div style={{ fontSize: '14px', color: '#f8fafc', background: '#0f172a', padding: '12px 14px', borderRadius: '10px', lineHeight: '1.5', marginBottom: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {c.message}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => deleteMessage(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: 0, fontWeight: 'bold', opacity: 0.8 }} title="حذف الرسالة">
                    حذف 🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* حقل الإرسال */}
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px' }}>
        <input 
          type="text" 
          placeholder="اكتب رسالة موجهة لفريق العمل في النظام..." 
          value={message} 
          onChange={(e) => setMessage(e.target.value)} 
          style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', padding: '14px 18px', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none' }} 
        />
        <button type="submit" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '0 28px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
          إرسال 🚀
        </button>
      </form>

    </div>
  );
}

export default EmployeeChat;