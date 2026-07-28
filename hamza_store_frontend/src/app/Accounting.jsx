import React, { useState } from 'react';
import { useApp } from './AppContext';

function Accounting({ 
  currentUser = { role: 'manager', name: 'حمزة' }, 
  inputStyle = {} 
}) {
  const { 
    accountingTransactions = [], 
    setAccountingTransactions, 
    mails = [], 
    setMails 
  } = useApp();

  const defaultTransactions = [
    { id: 1, type: 'income', amount: 500, description: 'شحن رصيد بطاقات بلايستيشن للعميل أحمد', date: '2026-07-26 14:30' },
    { id: 2, type: 'expense', amount: 150, description: 'مصاريف تشغيلية وصيانة السيرفر', date: '2026-07-26 16:00' }
  ];

  const transactions = accountingTransactions.length > 0 ? accountingTransactions : defaultTransactions;

  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const sendMail = (to, subject, body, attachment = null) => {
    const mail = {
      id: Date.now(),
      sender: currentUser?.name || "نظام المحاسبة",
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

  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!amount || !description) {
      alert('⚠️ يرجى إدخال المبلغ ووصف العملية المالية.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('⚠️ يرجى إدخال مبلغ مالي صحيح أكبر من الصفر.');
      return;
    }

    const newTransaction = {
      id: Date.now(),
      type,
      amount: numericAmount,
      description,
      date: new Date().toLocaleString()
    };

    const updatedTransactions = [newTransaction, ...transactions];
    setAccountingTransactions(updatedTransactions);

    const operationName = type === 'income' ? 'إيراد مالي (مبيعات بطاقات ألعاب)' : 'مصروفات تشغيلية';
    sendMail(
      "manager@company.com",
      `💰 عملية ${operationName} جديدة`,
      `تم تسجيل ${operationName} بقيمة ${numericAmount} دينار.\nالوصف: ${description}\nالمسؤول: ${currentUser?.name || 'مدير النظام'}`,
      "transaction_report.pdf"
    );

    setAmount('');
    setDescription('');
  };

  const deleteTransaction = (id) => {
    const target = transactions.find(t => t.id === id);
    const updatedTransactions = transactions.filter(t => t.id !== id);
    setAccountingTransactions(updatedTransactions);

    // 🛠️ إصلاح المشكلة: إرسال الإشعار ككائن متكامل وليس كنص مجرد لتجنب انهيار نظام البريد
    const transTypeArabic = target?.type === 'income' ? 'إيراد' : 'مصروف';
    sendMail(
      "manager@company.com",
      `🗑️ حذف عملية مالية (${transTypeArabic})`,
      `تم حذف عملية مالية (${transTypeArabic}): (${target?.description || id}) بقيمة (${target?.amount || 0} دينار).`
    );
  };

  const filteredTransactions = transactions.filter(t => {
    const matchType = filterType === 'all' ? true : t.type === filterType;
    const matchSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchType && matchSearch;
  });

  // 🛠️ إصلاح المشكلة: الاعتماد على t.type === 'income' فقط لتجنب احتساب المصاريف ضمن الإيرادات
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const netProfit = totalIncome - totalExpense;

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f59e0b', fontSize: '22px', fontWeight: 'bold' }}>
            💼 النظام المحاسبي والمالي الموحد (مرتبط تلقائياً)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة الإيرادات والمصروفات، متابعة الأرباح الصافية، والربط التلقائي مع باقي التطبيقات.</p>
        </div>
        <div style={{ background: '#1e293b', color: '#38bdf8', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
          إجمالي العمليات: {transactions.length}
        </div>
      </div>

      <form onSubmit={handleAddTransaction} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>➕ تسجيل معاملة مالية جديدة</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="income">💰 إيراد مالي (مبيعات/شحن)</option>
            <option value="expense">💸 مصاريف تشغيلية</option>
          </select>

          <input 
            type="number" 
            placeholder="المبلغ (دينار)..." 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />

          <input 
            type="text" 
            placeholder="وصف العملية المالية بالتفصيل..." 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />
        </div>

        <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          إتمام العملية وتوثيقها بالنظام وإرسال الإشعار ➕
        </button>
      </form>

      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#facc15', fontSize: '14px' }}>🔍 بحث وفلترة المعاملات المالية</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <input
            type="text"
            placeholder="ابحث في وصف العمليات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}
          />

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="all">كل الأنواع</option>
            <option value="income">الإيرادات فقط 💰</option>
            <option value="expense">المصاريف فقط 💸</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
        {filteredTransactions.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>لا توجد معاملات مالية مطابقة لنتائج البحث</p>
        ) : (
          filteredTransactions.map((t) => (
            <div key={t.id} style={{ background: '#111827', padding: '16px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>📅 {t.date || 'وقت سابق'}</span>
                  <span style={{ background: '#1e293b', color: t.type === 'income' ? '#34d399' : '#ef4444', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    {t.type === 'income' ? '💰 إيراد' : '💸 مصروف'}
                  </span>
                  <span style={{ color: '#facc15', fontWeight: 'bold', fontSize: '15px' }}>{t.amount} دينار</span>
                </div>
                <p style={{ margin: '4px 0 0 0', color: '#fff', fontSize: '14px' }}>📝 {t.description}</p>
              </div>

              <button 
                type="button"
                onClick={() => deleteTransaction(t.id)} 
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                حذف 🗑️
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        <div style={{ background: '#0b0f19', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>إجمالي الإيرادات</span>
          <span style={{ color: '#10b981', fontSize: '18px', fontWeight: 'bold' }}>{totalIncome.toLocaleString()} دينار</span>
        </div>
        <div style={{ background: '#0b0f19', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>إجمالي المصاريف</span>
          <span style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>{totalExpense.toLocaleString()} دينار</span>
        </div>
        <div style={{ background: '#0b0f19', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>صافي الأرباح</span>
          <span style={{ color: netProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>{netProfit.toLocaleString()} دينار</span>
        </div>
      </div>

    </div>
  );
}

export default Accounting;