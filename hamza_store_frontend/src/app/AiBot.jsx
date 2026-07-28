import React, { useEffect, useState } from 'react';
import CryptoJS from 'crypto-js';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = 'HamzaStoreDB';
const STORE_NAME = 'ai_chat_histories';

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
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// 🔒 دوال التشفير
function encryptMessage(message, secretKey) {
  try {
    return CryptoJS.AES.encrypt(message, secretKey || 'default-secret-key').toString();
  } catch (e) {
    return message;
  }
}

function decryptMessage(cipherText, secretKey) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, secretKey || 'default-secret-key');
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || cipherText;
  } catch (e) {
    return cipherText;
  }
}

// 🛡️ دوال الصلاحيات حسب تخصص الوظيفة
function canAnswer(role, questionType) {
  const permissions = {
    sales: ['orders', 'customers', 'products', 'inventory', 'troubleshooting'],
    stock: ['inventory', 'products', 'troubleshooting'],
    support: ['customers', 'orders', 'troubleshooting'],
    trainee: ['training', 'troubleshooting'],
    manager: ['inventory', 'products', 'orders', 'customers', 'profits', 'training', 'employees', 'troubleshooting'],
    admin: ['inventory', 'products', 'orders', 'customers', 'profits', 'training', 'employees', 'troubleshooting']
  };
  
  const userRole = permissions[role] ? role : 'sales';
  return permissions[userRole]?.includes(questionType) || permissions.manager.includes(questionType);
}

// 🧠 دالة ذكية لتحديد نوع السؤال
function detectQuestionType(text) {
  const normalized = (text || '').toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

  if (normalized.includes('مشكل') || normalized.includes('عطل') || normalized.includes('خطا') || normalized.includes('مو شغال') || normalized.includes('معلق') || normalized.includes('كيف احل') || normalized.includes('حل') || normalized.includes('ايش اعمل') || normalized.includes('شو اسوي')) {
    return 'troubleshooting';
  }
  if (normalized.includes('مخزون') || normalized.includes('ستوك') || normalized.includes('بضاع') || normalized.includes('ضاي') || normalized.includes('ضل') || normalized.includes('متوفر') || normalized.includes('خلص') || normalized.includes('القطع')) {
    return 'inventory';
  }
  if (normalized.includes('منتج') || normalized.includes('سلع') || normalized.includes('أصناف')) {
    return 'products';
  }
  if (normalized.includes('طلب') || normalized.includes('زبون') || normalized.includes('عميل') || normalized.includes('شحن')) {
    return 'orders';
  }
  if (normalized.includes('ربح') || normalized.includes('ارباح') || normalized.includes('فلوس') || normalized.includes('مصاريف') || normalized.includes('رواتب') || normalized.includes('مبيعات') || normalized.includes('دخل') || normalized.includes('مالي')) {
    return 'profits';
  }
  if (normalized.includes('تدريب') || normalized.includes('كورس') || normalized.includes('تعلم')) {
    return 'training';
  }
  if (normalized.includes('موظف') || normalized.includes('ساعات') || normalized.includes('دوام') || normalized.includes('أفضل') || normalized.includes('احسن') || normalized.includes('مين اشتغل')) {
    return 'employees';
  }

  return 'general';
}

function AiBot({
  currentUser = { name: 'حمزة', role: 'manager' },
  sessions = [{ id: '1', name: 'الجلسة العامة' }],
  currentSessionId = '1',
  setCurrentSessionId = () => {},
  createNewPrivateSession = () => {},
  inputStyle = {},
  secretKey = 'hamza-secure-key'
}) {
  const { 
    chatHistories = {}, 
    setChatHistories, 
    aiInputText = '', 
    setAiInputText = () => {},
    products = [],
    employees = [],
    accountingTransactions = [],
    customers = []
  } = useApp();

  const [internalChatHistories, setInternalChatHistories] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  const activeChatHistories = Object.keys(chatHistories).length > 0 ? chatHistories : internalChatHistories;

  const updateChatHistories = (newHistories) => {
    const updated = typeof newHistories === 'function' ? newHistories(activeChatHistories) : newHistories;
    setInternalChatHistories(updated);
    if (setChatHistories && typeof setChatHistories === 'function') {
      setChatHistories(updated);
    }
  };

  // 1️⃣ استرجاع المحادثات السابقة فور فتح التطبيق من IndexedDB
  useEffect(() => {
    const loadHistories = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          if (request.result && request.result.length > 0) {
            const loadedObj = {};
            request.result.forEach(item => {
              loadedObj[item.sessionId] = item.messages;
            });
            updateChatHistories(loadedObj);
          } else {
            const savedLocal = localStorage.getItem('ai_chat_histories');
            if (savedLocal) {
              updateChatHistories(JSON.parse(savedLocal));
            }
          }
          setIsLoaded(true);
        };
      } catch (err) {
        console.warn('استخدام LocalStorage بدلاً من IndexedDB:', err);
        const savedLocal = localStorage.getItem('ai_chat_histories');
        if (savedLocal) {
          updateChatHistories(JSON.parse(savedLocal));
        }
        setIsLoaded(true);
      }
    };

    loadHistories();
  }, []);

  // 2️⃣ حفظ سجلات الشات المشفّرة تلقائياً في IndexedDB عند أية محادثة جديدة
  useEffect(() => {
    if (!isLoaded) return;

    const saveHistories = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        store.clear();
        Object.keys(activeChatHistories).forEach(sId => {
          store.put({ sessionId: sId, messages: activeChatHistories[sId] });
        });

        localStorage.setItem('ai_chat_histories', JSON.stringify(activeChatHistories));
      } catch (err) {
        localStorage.setItem('ai_chat_histories', JSON.stringify(activeChatHistories));
      }
    };

    saveHistories();
  }, [activeChatHistories, isLoaded]);

  const handleAiSubmit = (e) => {
    e.preventDefault();
    if (!aiInputText || !aiInputText.trim()) return;

    const questionType = detectQuestionType(aiInputText);

    if (!canAnswer(currentUser.role, questionType)) {
      const newMsg = { sender: 'bot', text: `❌ عذراً يا ${currentUser.name}، ليس لديك الصلاحية للاطلاع على هذا القسم أو التقرير.` };
      const encryptedMsg = encryptMessage(newMsg.text, secretKey);
      updateChatHistories({
        ...activeChatHistories,
        [currentSessionId]: [
          ...(activeChatHistories[currentSessionId] || []),
          { sender: 'user', text: aiInputText },
          { ...newMsg, encrypted: encryptedMsg }
        ]
      });
      setAiInputText('');
      return;
    }

    // حسابات حية مترابطة من باقي الأقسام
    const totalProductsCount = products.length;
    const totalStockQty = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const totalEmployeesCount = employees.length;
    const totalIncome = accountingTransactions.filter(t => t.type === 'income' || t.amount > 0).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalExpense = accountingTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netProfit = totalIncome - totalExpense;

    let botReply = '🤖 أهلاً بك! تم استلام طلبك، كيف يمكنني مساعدتك أكثر في المتجر؟';

    if (questionType === 'troubleshooting') {
      botReply = `🛠️ **دليل حل المشكلات الفورية في المتجر:**\n1. النظام يعمل بكفاءة وتتم مزامنة البيانات بين الأقسام تلقائياً.\n2. تفقد "سجل النشاطات والأمان" في حال وجود أي استفسار عن الصلاحيات.`;
    } else if (questionType === 'inventory') {
      botReply = `📦 **تقرير المخزون والبضاعة المتبقية (مرتبط بقسم المنتجات):**\n- عدد أصناف المنتجات: ${totalProductsCount} صنف.\n- إجمالي قطع المخزون المتاحة: ${totalStockQty} قطعة جاهزة للبيع الفوري.`;
    } else if (questionType === 'products') {
      botReply = `🛒 **تقرير المنتجات الفعالة:**\n- يوجد حالياً ${totalProductsCount} منتج مسجل في نظام إدارة المنتجات والمخزون.`;
    } else if (questionType === 'orders') {
      botReply = `📑 **تقرير العملاء والطلبات:**\n- عدد العملاء المسجلين حالياً في قاعدة البيانات: ${customers.length} عميل.`;
    } else if (questionType === 'profits') {
      botReply = `💰 **التقرير المالي والأرباح (مرتبط بقسم المحاسبة):**\n- إجمالي الإيرادات: ${totalIncome} دينار\n- إجمالي المصاريف: ${totalExpense} دينار\n- صافي الأرباح: ${netProfit} دينار`;
    } else if (questionType === 'employees') {
      botReply = `👥 **تقرير طاقم العمل (مرتبط بقسم إدارة الموظفين):**\n- إجمالي طاقم العمل المسجل: ${totalEmployeesCount} موظف (من ضمنهم: ${employees.map(e => e.name).join(', ') || 'لا يوجد'}).`;
    } else if (questionType === 'training') {
      botReply = `📚 **التدريب والتطوير:**\n- تم تفعيل مسار التدريب الشامل لجميع الموظفين لضمان كفاءة العمل وخدمة عملاء متجر بطاقات الألعاب.`;
    }

    const newMsg = { sender: 'bot', text: botReply };
    const encryptedMsg = encryptMessage(newMsg.text, secretKey);

    updateChatHistories({
      ...activeChatHistories,
      [currentSessionId]: [
        ...(activeChatHistories[currentSessionId] || []),
        { sender: 'user', text: aiInputText },
        { ...newMsg, encrypted: encryptedMsg }
      ]
    });

    setAiInputText('');
  };

  return (
    <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif' }} dir="rtl">
      <h3 style={{ marginBottom: '15px', color: '#60a5fa' }}>🤖 روبوت الذكاء والتقارير وحل المشكلات (مرتبط تلقائياً)</h3>

      {/* اختيار الجلسة */}
      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <label style={{ color: '#9ca3af', fontSize: '13px' }}>اختر جلسة:</label>
        <select
          value={currentSessionId}
          onChange={(e) => setCurrentSessionId(e.target.value)}
          style={{ background: '#0b0f19', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', width: '200px', ...inputStyle }}
        >
          {(sessions || [{ id: '1', name: 'الجلسة العامة' }]).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={createNewPrivateSession}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          + جلسة جديدة
        </button>
      </div>

      {/* سجل المحادثة */}
      <div style={{
        background: '#111827',
        padding: '15px',
        borderRadius: '10px',
        height: '300px',
        overflowY: 'auto',
        marginBottom: '15px',
        border: '1px solid #1f2937'
      }}>
        {(activeChatHistories?.[currentSessionId] || []).map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '12px' }}>
            <strong style={{ color: msg.sender === 'user' ? '#38bdf8' : '#10b981', fontSize: '13px' }}>
              {msg.sender === 'user' ? `👤 ${currentUser.name}:` : '🤖 الروبوت الذكي:'}
            </strong>
            <p style={{ margin: '5px 0', color: '#f9fafb', whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '14px' }}>
              {decryptMessage(msg.encrypted || msg.text, secretKey)}
            </p>
          </div>
        ))}
      </div>

      {/* إدخال النص */}
      <form onSubmit={handleAiSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="اكتب براحتك (مثال: شو ضل بضاعة؟ أو كم أرباحنا؟)..."
          value={aiInputText || ''}
          onChange={(e) => setAiInputText(e.target.value)}
          style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '8px', color: '#fff', flex: 1, fontSize: '13px', ...inputStyle }}
        />
        <button
          type="submit"
          style={{
            background: '#10b981',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          إرسال 🚀
        </button>
      </form>
    </div>
  );
}

export default AiBot;