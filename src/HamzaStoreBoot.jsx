import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useApp } from './app/AppContext';
import { getActivePaymentMethods } from './paymentMethods';

// ═══════════════════════════════════════════════════════════════
// 📋 معلومات المتجر الرسمية — المصدر الوحيد الذي يعتمد عليه البوت
// املأ القيم الحقيقية فقط. أي حقل يبقى فاضي ('') البوت ما راح يخترع له
// جواب، وراح يوجّه الزبون للدعم الفني.
// ═══════════════════════════════════════════════════════════════
const STORE_INFO = {
  website: 'https://hamza-store-3z5d.onrender.com',
  phone: '0770416771',   // الرقم الأول
  phone2: '0779580253',  // الرقم الثاني
  email: 'my55iphone77@gmail.com',
  workingHours: 'من 10 الصباح حتى 12 المساء',
  returnPolicy: 'ما في سياسة استرجاع بالمتجر',
  currency: 'دينار',  // العملة الظاهرة بالأسعار
};

// 🏪 وصف المتجر ومعلومات مؤكدة من سلوك الموقع نفسه (مأخوذة من كود الواجهة)
const STORE_PROFILE = `طبيعة المتجر: متجر رقمي لبيع بطاقات الألعاب، والشحن الفوري، والاشتراكات.
حقائق مؤكدة عن آلية الموقع (يمكنك الاعتماد عليها):
- لإتمام الشراء لازم الزبون يكون مسجّل دخول؛ إذا ما كان مسجّل بيطلع له نافذة تسجيل الدخول.
- السلة بتنحفظ على جهاز الزبون وما بتنمسح لما يسكّر الصفحة.
- المنتجات اللي نوعها شحن بالآيدي لازم الزبون يدخل آيدي اللاعب لكل منتج قبل إتمام الطلب، وما بيكمل الطلب بدونه.
- بعد نجاح الطلب بتظهر شاشة تأكيد فيها تفاصيل الطلب والإجمالي، والأكواد المسلّمة (للمنتجات اللي بتتسلم أكواد)، والآيدي اللي انشحن عليه، وبنرسل نسخة من التفاصيل على إيميل الزبون.
- إذا الحساب غير مفعّل بتظهر رسالة تطلب تفعيله من الإيميل، وفي خيار لإعادة إرسال رسالة التفعيل.
- في تتبّع للطلب برقم الطلب، وفي قسم دعم فني لإرسال مشكلة أو الاستعلام عنها بالإيميل.
- المنتجات من نوع كود أو اشتراك بتتسلّم فوراً بعد تأكيد الطلب، والتسليم رقمي بالكامل عبر البريد الإلكتروني المسجّل.
- المنتج اللي مخزونه صفر بيظهر "نفد المخزون" وما بينضاف للسلة.`;

const SUPPORT_FALLBACK = 'ما عندي هالمعلومة مؤكدة حالياً، وما بدي أعطيك معلومة غلط 🙏 تواصل مع الدعم الفني من قسم الدعم بالموقع وبساعدوك فوراً.';

function digitsOnly(v) {
  return String(v || '').replace(/\D/g, '');
}

// يرد على أسئلة التواصل والمعلومات الرسمية حرفياً من STORE_INFO فقط
function answerFromStoreInfo(message) {
  const msg = String(message || '').toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

  const topics = [
    { re: /(ايميل|بريد|email|e-mail|mail)/, label: 'البريد الإلكتروني', key: 'email' },
    { re: /(رقم|هاتف|تلفون|اتصال|اتصل|تواصل|جوال|phone|call)/, label: 'أرقام التواصل', keys: ['phone', 'phone2'] },
    { re: /(ساعات|دوام|مواعيد|وقت العمل|متى تفتحون|بتفتحوا|working hours|open)/, label: 'ساعات العمل', key: 'workingHours' },
    { re: /(استرجاع|ارجاع|استرداد|استبدال|refund|return)/, label: 'سياسة الاسترجاع', key: 'returnPolicy' },
    { re: /(رابط الموقع|رابط المتجر|website)/, label: 'رابط الموقع', key: 'website' },
  ];

  const hit = topics.filter(t => t.re.test(msg));
  if (hit.length === 0) return null;

  const lines = hit.map(t => {
    const val = (t.keys || [t.key]).map(k => String(STORE_INFO[k] || '').trim()).filter(Boolean).join(' / ');
    return val ? `• ${t.label}: ${val}` : `• ${t.label}: غير متوفر عندي حالياً، تواصل مع الدعم الفني.`;
  });
  return `هاي المعلومات الرسمية للمتجر:\n${lines.join('\n')}`;
}

// 💳 طرق الدفع الحالية: تُجلب مباشرة من النظام وقت السؤال (لا يتم تخزينها يدوياً)
const PAYMENT_QUESTION_RE = /(طرق الدفع|طريقه الدفع|وسائل الدفع|طرق دفع|كيف ادفع|كيف بدفع|بتقبلوا|تقبلون|payment method|how (do i|to) pay)/;

function extractPaymentMethods(data) {
  const names = [];
  const isOff = (o) => o && (o.enabled === false || o.active === false || o.isActive === false || o.disabled === true);
  const addItem = (it, fallbackName) => {
    if (typeof it === 'string') {
      it.split(/[،,]/).map(x => x.trim()).filter(Boolean).forEach(x => names.push(x));
    } else if (it && typeof it === 'object') {
      if (isOff(it)) return;
      const n = it.nameAr || it.name || it.title || it.label || fallbackName;
      if (typeof n === 'string' && n.trim()) names.push(n.trim());
    } else if (it === true && fallbackName) {
      names.push(fallbackName);
    }
  };
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(x => addItem(x));
    else if (typeof v === 'string') addItem(v);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, val]) => addItem(val, k));
  };

  if (Array.isArray(data)) { walk(data); }
  else if (data && typeof data === 'object') {
    // نستخرج الأسماء فقط، ولا نعرض أبداً أي مفاتيح أو بيانات حساسة
    const direct = data.methods || data.paymentMethods || data.payment_methods || data.payments;
    if (direct !== undefined) walk(direct);
    else {
      const root = data.settings && typeof data.settings === 'object' ? data.settings : data;
      const key = Object.keys(root).find(k => /payment|دفع/i.test(k) && root[k] !== undefined && root[k] !== null);
      if (key) walk(root[key]);
    }
  }
  return [...new Set(names)];
}

async function fetchPaymentMethods(apiUrl, headers) {
  for (const path of ['/payment-methods', '/settings']) {
    try {
      const res = await fetch(`${apiUrl}${path}`, { headers });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const list = extractPaymentMethods(data);
      if (list.length > 0) return list;
    } catch (e) {}
  }
  return null;
}

// مرشّح أمان: يمنع أي إيميل أو رقم هاتف غير موجود بـ STORE_INFO من الظهور برد الذكاء الاصطناعي
function sanitizeAiReply(reply) {
  if (!reply || typeof reply !== 'string') return reply;

  const allowedEmails = [STORE_INFO.email].filter(Boolean).map(e => e.toLowerCase());
  const allowedPhones = [STORE_INFO.phone, STORE_INFO.phone2].filter(Boolean).map(v => digitsOnly(v).slice(-9));

  const emails = reply.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];
  if (emails.some(e => !allowedEmails.includes(e.toLowerCase()))) return SUPPORT_FALLBACK;

  const phones = reply.match(/\+?\d[\d\s\-()]{7,}\d/g) || [];
  if (phones.some(ph => {
    const d = digitsOnly(ph);
    return d.length >= 8 && !allowedPhones.includes(d.slice(-9));
  })) return SUPPORT_FALLBACK;

  return reply;
}

function humanTypingDelay() {
  return new Promise(resolve => setTimeout(resolve, 300));
}

export function HamzaStoreBoot({
  sessions = [{ id: '1', name: 'محادثتي' }],
  currentSessionId = '1',
  setCurrentSessionId = () => {},
  createNewPrivateSession = () => {},
  inputStyle = {}
}) {
  const contextData = useApp() || {};
  const apiUrl = contextData.apiUrl || '/api';
  const getAuthHeaders = typeof contextData.getAuthHeaders === 'function' ? contextData.getAuthHeaders : () => ({ 'Content-Type': 'application/json' });

  // 🔌 اشتقاق رابط الـ Socket.IO للمتجر العام
  const SOCKET_URL = /^https?:\/\//.test(apiUrl)
    ? apiUrl.replace(/\/api\/?$/, '')
    : window.location.origin;

  const ENDPOINTS = {
    customerAiChat: `${apiUrl}/customerAiChat`,
    products: `${apiUrl}/products`,
    context: `${apiUrl}/customerAiContext`,
  };

  const fetchPublicProductsOnly = useCallback(async () => {
    let freshProducts = Array.isArray(contextData.products) ? contextData.products : [];

    try {
      // 🔒 محصور فقط في مسار المنتجات العامة (Public Products Catalog)
      const prodRes = await fetch(ENDPOINTS.products, { headers: getAuthHeaders() });

      if (prodRes.ok) {
        const pData = await prodRes.json();
        if (Array.isArray(pData)) freshProducts = pData;
        else if (pData && Array.isArray(pData.products)) freshProducts = pData.products;
      }
    } catch (e) {}

    return { freshProducts };
  }, [contextData.products, apiUrl]);

  const externalAiInput = contextData.aiInputText || '';
  const setExternalAiInput = typeof contextData.setAiInputText === 'function' ? contextData.setAiInputText : () => {};

  const [chatHistories, setChatHistories] = useState({});
  const [localInputText, setLocalInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const chatContainerRef = useRef(null);

  // 🛡️ مخزن لا يحتوي إلا على الكتالوج العام للمنتجات
  const liveDataRef = useRef({ freshProducts: [] });
  const [liveMode, setLiveMode] = useState('polling');

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    const refreshPublicData = async () => {
      const latest = await fetchPublicProductsOnly();
      liveDataRef.current = latest;
    };

    socket.on('connect', () => {
      setLiveMode('socket');
      refreshPublicData();
    });
    socket.on('disconnect', () => setLiveMode('polling'));
    socket.on('connect_error', () => setLiveMode('polling'));

    socket.on('UPDATE_DATA', (data) => {
      // الاستماع فقط لتحديثات المنتجات العامة
      if (data && (data.type === 'PRODUCTS' || data.type === 'REFRESH_ALL')) {
        refreshPublicData();
      }
    });

    const fallbackInterval = setInterval(() => {
      if (!socket.connected) {
        refreshPublicData();
      }
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(fallbackInterval);
    };
  }, [SOCKET_URL, fetchPublicProductsOnly]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistories, currentSessionId, isThinking]);

  useEffect(() => {
    if (externalAiInput) setLocalInputText(externalAiInput);
  }, [externalAiInput]);

  useEffect(() => {
    if (!currentSessionId) return;
    try {
      const savedData = localStorage.getItem(`smart_assistant_bot_v14_${currentSessionId}`);
      if (savedData) {
        setChatHistories(prev => ({ ...prev, [currentSessionId]: JSON.parse(savedData) }));
      } else {
        const initialChat = [{ id: 'msg-init', sender: 'bot', text: `أهلاً بك يا غالي! أنا المساعد الشامل للمتجر. واجهتك أي مشكلة عامة، تقنية، بالدفع، أو بالتصفح؟ اطرحها وراح انحلها معك فوراً!` }];
        setChatHistories(prev => ({ ...prev, [currentSessionId]: initialChat }));
        localStorage.setItem(`smart_assistant_bot_v14_${currentSessionId}`, JSON.stringify(initialChat));
      }
    } catch (e) {
      setChatHistories(prev => ({ ...prev, [currentSessionId]: [] }));
    }
  }, [currentSessionId]);

  function pushBotReply(text, baseChat) {
    const cleanText = (text || '').replace(/\*\*/g, '');
    const newMessage = { id: 'msg-' + Date.now(), sender: 'bot', text: cleanText };
    const finalChat = [...baseChat, newMessage];
    setChatHistories(prev => ({ ...prev, [currentSessionId]: finalChat }));
    try {
      localStorage.setItem(`smart_assistant_bot_v14_${currentSessionId}`, JSON.stringify(finalChat));
    } catch (e) {}
    return finalChat;
  }

  // 🎯 إجابة مباشرة ودقيقة 100% من بيانات المتجر (بدون ذكاء اصطناعي) لأسئلة السعر والتوفر
  const normalizeAr = (str) => String(str || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

  function answerFromCatalog(message, products) {
    const msg = normalizeAr(message);
    const asksPrice = /(سعر|بكم|ثمن|price|how much)/.test(msg);
    const asksStock = /(متوفر|متاح|موجود|مخزون|توفر|نفد|available|stock)/.test(msg);
    if (!asksPrice && !asksStock) return null;

    const list = Array.isArray(products) ? products : [];
    let matches = list.filter(p => {
      const n = normalizeAr(p && p.name);
      return n.length >= 2 && msg.includes(n);
    });
    // لو اسم منتج جزء من اسم منتج أطول مذكور بالرسالة، نعتمد الأطول فقط
    matches = matches.filter(a => !matches.some(b => b !== a && normalizeAr(b.name).includes(normalizeAr(a.name))));
    if (matches.length === 0 || matches.length > 5) return null;

    const lines = matches.map(p => {
      const stock = typeof p.stock === 'number' ? p.stock : 0;
      const cur = String(STORE_INFO.currency || '').trim();
      const price = p.price !== undefined && p.price !== null
        ? (cur ? `${p.price} ${cur}` : `${p.price} (كما هو ظاهر على بطاقة المنتج)`)
        : 'غير محدد';
      const stockText = stock > 0 ? `متوفر (المخزون: ${stock})` : 'نفد المخزون حالياً';
      return `• ${p.name} — السعر: ${price} — ${stockText}`;
    });
    return `هاي المعلومات الحالية من المتجر:\n${lines.join('\n')}`;
  }

  async function generatePerfectArabicReply(textToSend, conversationSoFar) {
    const recentHistory = (conversationSoFar || [])
      .slice(-10)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: m.text }));

    const justFetched = await fetchPublicProductsOnly();
    liveDataRef.current = justFetched;
    const { freshProducts } = liveDataRef.current;
    let liveContext = null;
    try {
      const contextResponse = await fetch(ENDPOINTS.context, { headers: getAuthHeaders() });
      if (contextResponse.ok) liveContext = await contextResponse.json();
    } catch (e) {}

    const normalizedMessage = normalizeAr(textToSend);
    if (/(نقاط|نقط|ولاء|نجوم|رصيد النقاط)/.test(normalizedMessage)) {
      const account = liveContext?.account || (contextData.currentUser ? {
        loyaltyPoints: Number(contextData.currentUser.loyaltyPoints || 0),
        loyaltyThreshold: Number(contextData.currentUser.loyaltyThreshold || 100)
      } : null);
      const program = liveContext?.loyaltyProgram;
      const asksBalance = /(كم|رصيدي|نقاطي|عندي)/.test(normalizedMessage);
      if (asksBalance && account) {
        return `معك حالياً ${account.loyaltyPoints} نقطة ولاء ⭐\nوالحد الأساسي للمكافأة عندك ${account.loyaltyThreshold} نقطة. بتقدر تستخدم النقاط على المنتجات اللي عليها سعر نقاط داخل المتجر.`;
      }
      if (program?.active) {
        const earning = (program.earning || []).map((item) => `• ${item.name}: بتكسب ${item.pointsEarned} نقطة`).join('\n');
        const redemption = (program.redemption || []).map((item) => `• ${item.name}: سعره ${item.pointsPrice} نقطة`).join('\n');
        return `هاي معلومات نقاط الولاء الحالية من المتجر ⭐\n${earning ? `النقاط المكتسبة:\n${earning}\n` : ''}${redemption ? `الشراء بالنقاط:\n${redemption}\n` : ''}${program.note || ''}`;
      }
      return 'ما في منتجات أو تفاصيل نقاط ولاء مفعّلة حالياً حسب بيانات المتجر. إذا كنت تقصد نقاط حسابك، سجّل دخولك وبقدر أطلعلك رصيدك بدقة 🙏';
    }

    // رسالة المساعدة: ثابتة وصادقة
    if (/^\s*(مساعد|مساعده|help|شو بتقدر|شو تقدر|ايش تقدر)\s*[؟?!.]*\s*$/i.test(String(textToSend).replace(/[\u064B-\u0652]/g, ''))) {
      return 'أنا المساعد الشامل للمتجر 🤖 بقدر أساعدك بـ:\n• أسعار المنتجات وتوفرها\n• معلومات التواصل وساعات العمل (المعلومات الرسمية فقط)\n• مشاكل التصفح والسلة والدفع والدخول\n• شرح خطوات الشراء\nواللي ما بكون متأكد منه بقولك وبوجهك للدعم الفني.';
    }

    // 💳 طرق الدفع: تُجلب حيّة من النظام، وإذا ما توفرت لا نخترع شي
    if (PAYMENT_QUESTION_RE.test(normalizeAr(textToSend))) {
      // المصدر الأول: ملف paymentMethods.js (نفس القائمة اللي بتظهر بصفحة الطلب)
      const local = getActivePaymentMethods();
      if (local.length > 0) {
        return `طرق الدفع المتاحة حالياً بالمتجر:\n${local.map(m => `• ${m.name}${m.details ? ` — ${m.details}` : ''}`).join('\n')}`;
      }
      // المصدر الثاني: السيرفر
      const methods = await fetchPaymentMethods(apiUrl, getAuthHeaders());
      if (methods && methods.length > 0) {
        return `طرق الدفع المتاحة حالياً بالمتجر:\n${methods.map(m => `• ${m}`).join('\n')}`;
      }
      return 'ما في قائمة طرق دفع مسجلة عندي حالياً، وما بدي أعطيك معلومة غلط 🙏 تواصل مع الدعم الفني وبأكدوا لك.';
    }

    // معلومات المتجر الرسمية (تواصل، دوام، عنوان...) حرفياً من STORE_INFO
    const storeAnswer = answerFromStoreInfo(textToSend);
    if (storeAnswer) return storeAnswer;

    // إجابة مباشرة من البيانات الحقيقية لأسئلة السعر/التوفر (دقة 100%)
    const directAnswer = answerFromCatalog(textToSend, freshProducts);
    if (directAnswer) return directAnswer;

    // نرسل كامل الكتالوج (مش أول 30 بس) عشان البوت ما يخترع منتجات
    const catalogSample = freshProducts.slice(0, 200).map(p => ({
      name: p.name,
      price: p.price,
      stock: p.stock,
      loyaltyPoints: p.loyaltyPoints,
      loyaltyPrice: p.loyaltyPrice,
      description: String(p.description || '').slice(0, 150),
      category: p.category || '',
      deliveryType: p.deliveryType || ''
    }));

    try {
      const aiRes = await fetch(ENDPOINTS.customerAiChat, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: textToSend,
          conversationHistory: recentHistory,
          persona: {
            name: 'المساعد الشامل للمتجر',
            styleInstructions: `أنت "المساعد الشامل للمتجر"، خبير تقني ودعم فني متخصص بحل **أي مشكلة عامة** تواجه الزبائن أو تظهر في المتجر (مثل: مشاكل التصفح، الأخطاء التقنية، مشاكل الدفع، شحن الأكواد، أو خطوات استخدام الموقع).
قواعدك الأمنية والصارمة للغاية:
1. احكي باللهجة الأردنية الدارجة الطبيعية وبأسلوب لطيف ومرحب 100%.
2. حل أي مشكلة عامة أو تقنية تواجه المستخدم ديناميكياً من الجذر بخطوات عملية وسهلة.
3. ممنوع تماماً ومن الجذور الوصول لأي معلومات حساسة أو إدارية أو مالية (محظور كلياً معرفة أو ذكر: أعداد المبيعات، الأرباح، التقارير المالية، بيانات الأدمن، أو البيانات الخاصة جداً للعملاء).
4. استخدم معلومات المنتجات العامة فقط في حال تطلب الأمر مساعدة الزيارة أو اختيار البطاقات المناسبة.
5. ممنوع استخدام نجوم الماركداون (**).
6. الدقة أهم من أي شي: لا تذكر سعراً أو مخزوناً أو اسم منتج أو وصفاً إلا إذا كان موجوداً حرفياً في بيانات الكتالوج المرسلة لك (catalogSample). انسخ الأرقام كما هي بدون تقريب أو تخمين.
7. إذا المنتج غير موجود بالكتالوج قل بوضوح إنه مش موجود حالياً بالمتجر، ولا تخترع بديلاً.
8. إذا ما عندك معلومة مؤكدة (سياسة استرجاع، مدة توصيل، طريقة دفع، وقت محدد...) قل: ما عندي معلومة مؤكدة عن هذا الشي، تواصل مع الدعم الفني. ممنوع الاختلاق أو الوعود.
9. لا تعطي وعوداً بخصوص الاسترجاع أو التعويض أو الخصومات إلا لو كانت مذكورة بالبيانات.
12. أنت تمثّل متجراً لبيع بطاقات الألعاب والشحن الفوري والاشتراكات. تحدّث بثقة عن طبيعة المتجر وآلية الموقع الموجودة في storeProfile.
13. للمشاكل الشائعة (الكود ما اشتغل، الشحن تأخر، آيدي غلط، ما وصلني إيميل، ما قدرت أدخل، السلة، الدفع): قدّم خطوات عملية عامة وصحيحة (تأكد من كتابة الكود بدون مسافات، تأكد من المنطقة/المنصة المناسبة للبطاقة، تأكد من صحة الآيدي، افحص مجلد السبام، حدّث الصفحة، شوف شاشة تأكيد الطلب)، ثم وجّه الزبون للدعم الفني برقم الطلب إذا ما انحلت. لا تؤكد حدوث تأخير أو خطأ من طرف المتجر ولا تعد بتعويض أو استرجاع.
14. لا تدّعِ معرفة منصة أو بطاقة أو منتج غير موجود بالكتالوج، ولا تذكر أسعاراً أو عروضاً من عندك.
15. طرق الدفع: لا تذكرها أبداً من عندك. إذا سأل الزبون عنها قل له يسأل مرة ثانية بصيغة "شو طرق الدفع" أو يتواصل مع الدعم.
11. أرقام التواصل والإيميلات وساعات العمل والعناوين وسياسات المتجر: لا تذكرها إلا إذا كانت موجودة حرفياً داخل storeInfo، وإلا قل إنها غير متوفرة ووجّه الزبون للدعم الفني. ممنوع منعاً باتاً اختلاق أي رقم أو إيميل أو رابط.
10. لو الحل التقني غير مؤكد قل إنك مش متأكد واقترح التواصل مع الدعم بدل ما تخمّن.`,
          },
          taskInstruction: 'جاوب باللهجة الأردنية وبإيموجيز مناسبة، واعتمد فقط على معلومات مؤكدة من بيانات الكتالوج المرسلة. إذا المعلومة غير موجودة قل بصراحة إنك مش متأكد ووجّه الزبون للدعم الفني.',
          data: {
            // 🛡️ آمن تماماً: لا يرسل سوى بيانات المنتجات العامة
            catalogSample,
            loyaltyProgram: liveContext?.loyaltyProgram || null,
            account: liveContext?.account || null,
            storeProfile: STORE_PROFILE,
            storeInfo: Object.fromEntries(Object.entries(STORE_INFO).filter(([, v]) => String(v || '').trim()))
          },
        }),
      });
      const aiResJson = await aiRes.json().catch(() => ({}));
      return sanitizeAiReply(aiResJson?.reply) || null;
    } catch (e) {
      return null;
    }
  }

  const handleCustomSend = async (textToSend) => {
    if (!textToSend.trim()) return;

    const currentMessages = chatHistories[currentSessionId] || [];
    const userMsg = { id: 'msg-' + Date.now(), sender: 'user', text: textToSend };
    let updatedChat = [...currentMessages, userMsg];
    
    setChatHistories(prev => ({ ...prev, [currentSessionId]: updatedChat }));
    setLocalInputText('');
    setExternalAiInput('');
    setIsThinking(true);

    try {
      const [aiReply] = await Promise.all([
        generatePerfectArabicReply(textToSend, updatedChat),
        humanTypingDelay(),
      ]);

      setIsThinking(false);
      const finalReply = aiReply || "عذراً يا غالي صار خطأ بسيط بالاتصال، جرب ابعث رسالتك مرة ثانية.";
      pushBotReply(finalReply, updatedChat);

    } catch (error) {
      setIsThinking(false);
      pushBotReply("في خلل مؤقت بالاتصال، حدّث الصفحة وجرب كمان شوي.", updatedChat);
    }
  };

  return (
    <div className="hz-glass-card hz-bot-shell" style={{ '--glow': '#3b82f6', padding: '20px', cursor: 'default', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }} dir="rtl">
      <style>{`
        .hz-glass-card.hz-bot-shell:hover {
          transform: none;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .hz-glass-card.hz-bot-shell::before { display: none; }
        .hz-glass-card.hz-bot-shell::after { display: none; }

        .hz-bot-inner-panel {
          background: rgba(10, 15, 30, 0.6);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
        }

        .hz-bot-bubble-user {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(59, 130, 246, 0.15));
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(96, 165, 250, 0.3);
          box-shadow: 0 4px 15px rgba(37, 99, 235, 0.1);
        }

        .hz-bot-bubble-bot {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.08));
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(52, 211, 153, 0.25);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.08);
        }

        .hz-bot-input {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: all 0.25s ease;
        }
        .hz-bot-input:focus {
          outline: none;
          border-color: rgba(56, 189, 248, 0.6);
          box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15), inset 0 1px 1px rgba(255,255,255,0.1);
        }

        .hz-bot-send-btn {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
          transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .hz-bot-send-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
          filter: brightness(1.1);
        }
        .hz-bot-send-btn:active { transform: translateY(0) scale(0.96); }

        @keyframes hzTypingBlink {
          0%, 100% { opacity: 0.3; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .hz-typing-indicator {
          animation: hzTypingBlink 1.4s infinite ease-in-out;
        }

        @keyframes hzLivePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .hz-live-pulse { animation: hzLivePulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* رأس المحادثة الفاخر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
            <span style={{ fontSize: '18px' }}>🤖</span>
            <div
              className={liveMode === 'socket' ? 'hz-live-pulse' : ''}
              title={liveMode === 'socket' ? 'متصل لحظياً عبر Socket.IO' : 'وضع الاحتياط: تحديث دوري'}
              style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', border: '2px solid #0b0f19', boxShadow: '0 0 8px #22c55e' }}
            ></div>
          </div>
          <div>
            <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.3px' }}>المساعد الشامل للمتجر</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              جاهز لحل أي مشكلة عامة وتقنية ⚡
            </div>
          </div>
        </div>
        <div style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.08)' }}>
          آمن 100%
        </div>
      </div>

      {/* صندوق رسائل المحادثة */}
      <div ref={chatContainerRef} className="hz-bot-inner-panel" style={{ padding: '16px', height: '390px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px', scrollBehavior: 'smooth' }}>
        {(!chatHistories[currentSessionId] || chatHistories[currentSessionId].length === 0) ? (
          <div style={{ color: '#64748b', textAlign: 'center', margin: 'auto', fontSize: '13.5px', padding: '20px' }}>
            ✨ واجهتك أي مشكلة عامة أو تقنية بالمتجر؟ اطرحها وراح انحلها معك فوراً.
          </div>
        ) : (
          chatHistories[currentSessionId].map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-start' : 'flex-end', width: '100%', animation: 'fadeSlideIn 0.3s ease' }}>
                <div className={isUser ? 'hz-bot-bubble-user' : 'hz-bot-bubble-bot'} style={{
                  maxWidth: '85%',
                  color: '#f8fafc',
                  padding: '14px 18px',
                  borderRadius: isUser ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                  fontSize: '13.5px',
                  lineHeight: '1.75',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line'
                }}>
                  <div style={{ fontSize: '10.5px', color: isUser ? '#93c5fd' : '#34d399', marginBottom: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{isUser ? 'أنت 👤' : 'المساعد الشامل 🛡️'}</span>
                  </div>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}

        {isThinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'fadeSlideIn 0.2s ease' }}>
            <div className="hz-bot-bubble-bot hz-typing-indicator" style={{ padding: '10px 16px', borderRadius: '12px', color: '#34d399', fontSize: '12.5px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>المساعد الشامل يحل المشكلة العامة</span>
              <span style={{ display: 'flex', gap: '3px' }}>
                <span style={{ animation: 'hzTypingBlink 1s infinite 0s' }}>.</span>
                <span style={{ animation: 'hzTypingBlink 1s infinite 0.2s' }}>.</span>
                <span style={{ animation: 'hzTypingBlink 1s infinite 0.4s' }}>.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* صندوق الإدخال */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="اكتب مشكلتك العامة أو التقنية هنا..."
          value={localInputText}
          onChange={(e) => setLocalInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCustomSend(localInputText)}
          className="hz-bot-input"
          style={{ padding: '13px 18px', borderRadius: '14px', color: '#fff', flex: 1, fontSize: '13.5px', ...inputStyle }}
        />
        <button
          type="button"
          onClick={() => handleCustomSend(localInputText)}
          className="hz-bot-send-btn"
          style={{ color: '#fff', padding: '0 24px', height: '48px', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>حل المشكلة</span>
          <span>🚀</span>
        </button>
      </div>
    </div>
  );
}

export default HamzaStoreBoot;
