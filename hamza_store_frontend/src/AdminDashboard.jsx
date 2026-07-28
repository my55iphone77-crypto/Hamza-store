import React, { useState, useEffect } from 'react';

// استدعاء كل التطبيقات من مجلد app
import Accounting from './app/Accounting';
import Achievements from './app/Achievements';
import AIbot from './app/AIbot';
import Analytics from './app/Analytics';
import Announcements from './app/Announcements';
import Attendance from './app/Attendance';
import Commissions from './app/Commissions';
import Contacts from './app/Contacts';
import Coupons from './app/Coupons';
import Customers from './app/Customers';
import CustomerService from './app/CustomerService';
import Documents from './app/Documents';
import EmailCenter from './app/EmailCenter';
import EmployeeChat from './app/EmployeeChat';
import Employees from './app/Employees';
import Logs from './app/Logs';
import ManagerMonitor from './app/ManagerMonitor';
import Performance from './app/Performance';
import Products from './app/Products';
import Salaries from './app/Salaries';
import SalesLog from './app/SalesLog';
import Settings from './app/Settings';
import Tasks from './app/Tasks';
import Tickets from './app/Tickets';
import WorkHours from './app/WorkHours';
import StorageManagement from './app/StorageManagement'; // 👈 استدعاء إدارة مساحة التخزين
import Storefront from './Storefront';

function AdminDashboard() {
  const inputStyle = {
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    marginTop: '5px',
    marginBottom: '10px',
    width: '100%'
  };

  // 💾 إدارة البيانات العامة وربطها بـ LocalStorage لتجنب فقدانها
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('hamza_products');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'بطاقة جوجل بلاي 10$', price: 10, stock: 50, category: 'ألعاب', description: 'شحن فوري لرصيد متجر جوجل بلاي' },
      { id: 2, name: 'بطاقة بلايستيشن ستور 20$', price: 20, stock: 35, category: 'ألعاب', description: 'شحن فوري لمحفظة بلايستيشن' },
      { id: 3, name: 'بطاقة شدات ببجي 600 UC', price: 10, stock: 100, category: 'ألعاب', description: 'شحن مباشر لحسابك في لعبة ببجي موبايل' }
    ];
  });

  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('hamza_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [mails, setMails] = useState(() => {
    const saved = localStorage.getItem('hamza_mails');
    return saved ? JSON.parse(saved) : [];
  });

  const [requests, setRequests] = useState(() => {
    const saved = localStorage.getItem('hamza_requests');
    return saved ? JSON.parse(saved) : [];
  });

  // حفظ التحديثات تلقائياً في التخزين المحلي
  useEffect(() => {
    localStorage.setItem('hamza_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('hamza_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('hamza_mails', JSON.stringify(mails));
  }, [mails]);

  useEffect(() => {
    localStorage.setItem('hamza_requests', JSON.stringify(requests));
  }, [requests]);

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: '20px', color: '#fff' }} dir="rtl">
      <h1 style={{ textAlign: 'center', color: '#f97316', marginBottom: '30px' }}>
        👑 لوحة تحكم المدير الشاملة (Admin Dashboard)
      </h1>

      {/* 💾 قسم إدارة مساحة التخزين وحالة الـ LocalStorage */}
      <div style={{ marginBottom: '40px', background: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
        <StorageManagement />
      </div>

      {/* المتجر مع تمرير البيانات والحالات المربوطة بالتخزين */}
      <div style={{ marginBottom: '40px' }}>
        <Storefront 
          products={products}
          setProducts={setProducts}
          transactions={transactions}
          setTransactions={setTransactions}
          mails={mails}
          setMails={setMails}
          requests={requests}
          setRequests={setRequests}
          inputStyle={inputStyle} 
          isAdmin={true}
        />
      </div>

      {/* التطبيقات الإدارية */}
      <Settings inputStyle={inputStyle} />
      <Tasks inputStyle={inputStyle} />
      <Tickets inputStyle={inputStyle} role="manager" />
      <WorkHours inputStyle={inputStyle} role="manager" />

      {/* باقي التطبيقات */}
      <Accounting inputStyle={inputStyle} />
      <Achievements inputStyle={inputStyle} />
      <AIbot inputStyle={inputStyle} />
      <Analytics inputStyle={inputStyle} />
      <Announcements inputStyle={inputStyle} />
      <Attendance inputStyle={inputStyle} />
      <Commissions inputStyle={inputStyle} />
      <Contacts inputStyle={inputStyle} />
      <Coupons inputStyle={inputStyle} />
      <Customers inputStyle={inputStyle} />
      <CustomerService inputStyle={inputStyle} requests={requests} setRequests={setRequests} />
      <Documents inputStyle={inputStyle} />
      <EmailCenter inputStyle={inputStyle} mails={mails} setMails={setMails} />
      <EmployeeChat inputStyle={inputStyle} />
      <Employees inputStyle={inputStyle} />
      <Logs inputStyle={inputStyle} />
      <ManagerMonitor inputStyle={inputStyle} />
      <Performance inputStyle={inputStyle} />
      <Products inputStyle={inputStyle} products={products} setProducts={setProducts} />
      <Salaries inputStyle={inputStyle} />
      <SalesLog inputStyle={inputStyle} transactions={transactions} />
    </div>
  );
}

export default AdminDashboard;