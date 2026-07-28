import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لقراءة البيانات الفائقة من IndexedDB
const DB_NAME = 'HamzaStoreDB';

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject('IndexedDB غير مدعوم في هذا المتصفح');
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
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

function Analytics({ 
  employees: propEmployees = [], 
  customers: propCustomers = [], 
  products: propProducts = [], 
  transactions: propTransactions = [],
  tickets: propTickets = [],
  workHours: propWorkHours = []
}) {
  const { 
    employees: contextEmployees = [],
    customers: contextCustomers = [],
    products: contextProducts = [],
    accountingTransactions: contextTransactions = [],
    tickets: contextTickets = [],
    workHours: contextWorkHours = []
  } = useApp();

  const [localData, setLocalData] = useState({
    employees: [],
    customers: [],
    products: [],
    transactions: [],
    tickets: [],
    workHours: []
  });

  // 1️⃣ مزامنة وقراءة أحدث البيانات تلقائياً من IndexedDB / Context / LocalStorage لتحديث التحليلات
  useEffect(() => {
    const loadAllAnalyticsData = async () => {
      const dbTransactions = await getStoreData('accounting_transactions');
      const dbProducts = await getStoreData('products_data');
      const dbEmployees = await getStoreData('employees_data');
      const dbCustomers = await getStoreData('customers_data');
      const dbTickets = await getStoreData('tickets_data');
      const dbWorkHours = await getStoreData('work_hours_data');
      
      setLocalData({
        employees: propEmployees.length ? propEmployees : (contextEmployees.length ? contextEmployees : (dbEmployees.length ? dbEmployees : JSON.parse(localStorage.getItem('employees_data') || '[]'))),
        customers: propCustomers.length ? propCustomers : (contextCustomers.length ? contextCustomers : (dbCustomers.length ? dbCustomers : JSON.parse(localStorage.getItem('customers_data') || '[]'))),
        products: propProducts.length ? propProducts : (contextProducts.length ? contextProducts : (dbProducts.length ? dbProducts : JSON.parse(localStorage.getItem('products_data') || '[]'))),
        transactions: propTransactions.length ? propTransactions : (contextTransactions.length ? contextTransactions : (dbTransactions.length ? dbTransactions : JSON.parse(localStorage.getItem('accounting_transactions') || '[]'))),
        tickets: propTickets.length ? propTickets : (contextTickets.length ? contextTickets : (dbTickets.length ? dbTickets : JSON.parse(localStorage.getItem('tickets_data') || '[]'))),
        workHours: propWorkHours.length ? propWorkHours : (contextWorkHours.length ? contextWorkHours : (dbWorkHours.length ? dbWorkHours : JSON.parse(localStorage.getItem('work_hours_data') || '[]')))
      });
    };

    loadAllAnalyticsData();
  }, [propEmployees, propCustomers, propProducts, propTransactions, propTickets, propWorkHours, contextEmployees, contextCustomers, contextProducts, contextTransactions, contextTickets, contextWorkHours]);

  // الاعتماد على البيانات الممررة، أو سياق التطبيق، أو المخزون الداخلي
  const employees = propEmployees.length ? propEmployees : (contextEmployees.length ? contextEmployees : localData.employees);
  const customers = propCustomers.length ? propCustomers : (contextCustomers.length ? contextCustomers : localData.customers);
  const products = propProducts.length ? propProducts : (contextProducts.length ? contextProducts : localData.products);
  const transactions = propTransactions.length ? propTransactions : (contextTransactions.length ? contextTransactions : localData.transactions);
  const tickets = propTickets.length ? propTickets : (contextTickets.length ? contextTickets : localData.tickets);
  const workHours = propWorkHours.length ? propWorkHours : (contextWorkHours.length ? contextWorkHours : localData.workHours);

  // حساب الإحصائيات الأساسية
  const totalEmployees = employees.length;
  const totalCustomers = customers.length;
  const totalProducts = products.length;
  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'مفتوحة' || t.status === 'open').length;
  const totalWorkHoursRecords = workHours.length;

  // الحسابات المالية (يدعم التعامل مع خصائص الأرقام بدقة)
  const totalIncome = transactions
    .filter(t => t.type === 'income' || Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const netProfit = totalIncome - totalExpense;

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#3b82f6', fontSize: '22px', fontWeight: 'bold' }}>
            📊 لوحة التحليلات والإحصائيات الشاملة (Analytics Dashboard) - مرتبطة تلقائياً
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>رؤية شاملة ومباشرة لأداء المتجر، المبيعات، الأرباح، شحن بطاقات الألعاب، وحالة فرق العمل.</p>
        </div>
        <div style={{ background: '#1e293b', color: '#34d399', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
          حالة النظام: متصل ونشط تلقائياً 🟢
        </div>
      </div>

      {/* شبكة الإحصائيات الشاملة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px' }}>
        
        {/* الموظفون */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>إجمالي طاقم العمل</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{totalEmployees} موظف</span>
            <span style={{ fontSize: '22px' }}>👥</span>
          </div>
        </div>

        {/* العملاء */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>إجمالي العملاء المسجلين</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{totalCustomers} عميل</span>
            <span style={{ fontSize: '22px' }}>🧑‍💼</span>
          </div>
        </div>

        {/* المنتجات (بطاقات الألعاب) */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>منتجات وبطاقات الألعاب المتاحة</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>{totalProducts} منتج</span>
            <span style={{ fontSize: '22px' }}>📦</span>
          </div>
        </div>

        {/* تذاكر الدعم الفني */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>تذاكر الدعم (مفتوحة / إجمالي)</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f97316' }}>{openTickets} مفتوحة ({totalTickets})</span>
            <span style={{ fontSize: '22px' }}>🎫</span>
          </div>
        </div>

        {/* ساعات العمل */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>سجلات الدوام وساعات العمل</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#facc15' }}>{totalWorkHoursRecords} سجل</span>
            <span style={{ fontSize: '22px' }}>⏰</span>
          </div>
        </div>

        {/* إجمالي الإيرادات */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>إجمالي الإيرادات المالية</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{totalIncome.toLocaleString()} دينار</span>
            <span style={{ fontSize: '22px' }}>💰</span>
          </div>
        </div>

        {/* إجمالي المصاريف */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>إجمالي المصاريف التشغيلية</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>{totalExpense.toLocaleString()} دينار</span>
            <span style={{ fontSize: '22px' }}>💸</span>
          </div>
        </div>

        {/* صافي الأرباح */}
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>صافي الأرباح والأداء المالي</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: netProfit >= 0 ? '#22c55e' : '#ef4444' }}>
              {netProfit.toLocaleString()} دينار
            </span>
            <span style={{ fontSize: '22px' }}>📈</span>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Analytics;