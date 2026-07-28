import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './app/AppContext';

// استيراد واجهة المتجر الرئيسي
import Storefront from './Storefront';

// استيراد التطبيقات الإدارية من مجلد app
import Accounting from './app/Accounting';
import Achievements from './app/Achievements';
import AiBot from './app/AiBot';
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

function MainContent() {
  const [activeApp, setActiveApp] = useState(null);
  const [showStorefront, setShowStorefront] = useState(true);

  // استدعاء البيانات المركزية المتزامنة تماماً من الـ AppContext
  const {
    employees, setEmployees,
    attendance, setAttendance,
    salaries, setSalaries,
    workHours, setWorkHours,
    performance, setPerformance,
    achievements, setAchievements,
    products, setProducts,
    coupons, setCoupons,
    salesLog, setSalesLog,
    accountingTransactions, setAccountingTransactions,
    analytics, setAnalytics,
    customers, setCustomers,
    customerService, setCustomerService,
    tickets, setTickets,
    mails, setMails,
    employeeChat, setEmployeeChat,
    announcements, setAnnouncements,
    tasks, setTasks,
    documents, setDocuments,
    logs, setLogs,
    commissions, setCommissions,
    contacts, setContacts,
    aiBot, setAiBot,
    managerMonitor, setManagerMonitor,
    settings, setSettings
  } = useApp();

  // 💾 استرجاع الحالة النشطة والواجهة الحالية
  useEffect(() => {
    const savedShowStorefront = localStorage.getItem("hamza_store_showStorefront");
    if (savedShowStorefront !== null) {
      try { setShowStorefront(JSON.parse(savedShowStorefront)); } catch (e) { console.error(e); }
    }
    const savedApp = localStorage.getItem("hamza_store_activeApp");
    if (savedApp) { setActiveApp(savedApp); }
  }, []);

  useEffect(() => {
    localStorage.setItem("hamza_store_showStorefront", JSON.stringify(showStorefront));
  }, [showStorefront]);

  useEffect(() => {
    if (activeApp) {
      localStorage.setItem("hamza_store_activeApp", activeApp);
    } else {
      localStorage.removeItem("hamza_store_activeApp");
    }
  }, [activeApp]);

  const currentUser = { name: 'حمزة', role: 'مدير عام', email: 'manager@company.com' };
  const secretKey = 'hamza-secure-key';
  const inputStyle = { background: '#0b0f19', color: '#fff', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px' };

  // حالات روبوت الذكاء الاصطناعي
  const [sessions, setSessions] = useState([{ id: '1', name: 'الجلسة العامة للتحليل والإدارة' }]);
  const [currentSessionId, setCurrentSessionId] = useState('1');
  const [chatHistories, setChatHistories] = useState({});
  const [aiInputText, setAiInputText] = useState('');

  const createNewPrivateSession = () => {
    const newId = String(Date.now());
    const newSession = { id: newId, name: `جلسة خاصة ${sessions.length + 1}` };
    setSessions([...sessions, newSession]);
    setCurrentSessionId(newId);
  };

  const [searchTerm, setSearchTerm] = useState('');

  // قائمة التطبيقات الإدارية مع تمرير الحالات المركزية الصحيحة
  const appsList = [
    { 
      id: 'AiBot', name: 'روبوت الذكاء والتقارير', icon: '🤖', borderColor: '#3b82f6', 
      component: <AiBot currentUser={currentUser} sessions={sessions} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId} createNewPrivateSession={createNewPrivateSession} chatHistories={chatHistories} setChatHistories={setChatHistories} aiInputText={aiInputText} setAiInputText={setAiInputText} inputStyle={inputStyle} secretKey={secretKey} transactions={accountingTransactions} products={products} employees={employees} /> 
    },
    { id: 'Products', name: 'إدارة المنتجات والمخزون', icon: '📦', borderColor: '#10b981', component: <Products products={products} setProducts={setProducts} inputStyle={inputStyle} currentUser={currentUser} /> },
    { id: 'Employees', name: 'إدارة الموظفين (HR)', icon: '👥', borderColor: '#8b5cf6', component: <Employees employees={employees} setEmployees={setEmployees} searchTerm={searchTerm} setSearchTerm={setSearchTerm} /> },
    { id: 'Salaries', name: 'الرواتب والمكافآت', icon: '💵', borderColor: '#f59e0b', component: <Salaries salaries={salaries} setSalaries={setSalaries} inputStyle={inputStyle} currentUser={currentUser} /> },
    { id: 'Contacts', name: 'إيميلات وأرقام الموظفين', icon: '📇', borderColor: '#06b6d4', component: <Contacts contacts={contacts} setContacts={setContacts} /> },
    { id: 'EmailCenter', name: 'مركز البريد (Gmail)', icon: '✉️', borderColor: '#3b82f6', component: <EmailCenter emails={mails} setEmails={setMails} messages={mails} inputStyle={inputStyle} /> },
    { id: 'EmployeeChat', name: 'دردشة الموظفين الداخلية', icon: '💬', borderColor: '#ec4899', component: <EmployeeChat messages={employeeChat} setMessages={setEmployeeChat} currentUser={currentUser} /> },
    { id: 'Accounting', name: 'المحاسبة والأرباح', icon: '💰', borderColor: '#10b981', component: <Accounting transactions={accountingTransactions} setTransactions={setAccountingTransactions} mails={mails} setMails={setMails} currentUser={currentUser} inputStyle={inputStyle} /> },
    { id: 'SalesLog', name: 'سجل المبيعات والطلبات', icon: '📊', borderColor: '#6366f1', component: <SalesLog transactions={salesLog} sales={salesLog} /> },
    { id: 'ManagerMonitor', name: 'قسم فصل الموظفين', icon: '⚠️', borderColor: '#ef4444', component: <ManagerMonitor employees={employees} setEmployees={setEmployees} /> },
    { id: 'Coupons', name: 'كوبونات الخصم', icon: '🎟️', borderColor: '#f43f5e', component: <Coupons coupons={coupons} setCoupons={setCoupons} inputStyle={inputStyle} /> },
    { id: 'Tickets', name: 'تذاكر الدعم الفني', icon: '🎫', borderColor: '#14b8a6', component: <Tickets tickets={tickets} setTickets={setTickets} /> },
    { id: 'Announcements', name: 'إعلانات المتجر', icon: '📢', borderColor: '#f97316', component: <Announcements announcements={announcements} setAnnouncements={setAnnouncements} /> },
    { id: 'Tasks', name: 'إدارة مهام الكوادر', icon: '📝', borderColor: '#84cc16', component: <Tasks tasks={tasks} setTasks={setTasks} /> },
    { id: 'Logs', name: 'سجل النشاطات والأمان', icon: '🛡️', borderColor: '#3b82f6', component: <Logs logs={logs} setLogs={setLogs} /> },
    { id: 'Settings', name: 'إعدادات المتجر العامة', icon: '⚙️', borderColor: '#64748b', component: <Settings /> },
    { id: 'Analytics', name: 'الإحصائيات المتقدمة', icon: '📈', borderColor: '#0ea5e9', component: <Analytics employees={employees} customers={customers} products={products} transactions={accountingTransactions} /> },
    { id: 'Performance', name: 'مراقبة الأداء والإنذارات', icon: '🔍', borderColor: '#eab308', component: <Performance performance={performance} setPerformance={setPerformance} /> },
    { id: 'WorkHours', name: 'تتبع ساعات العمل', icon: '⏱️', borderColor: '#a855f7', component: <WorkHours workHours={workHours} setWorkHours={setWorkHours} /> },
    { id: 'Achievements', name: 'قياس الإنجازات', icon: '🏆', borderColor: '#10b981', component: <Achievements achievements={achievements} setAchievements={setAchievements} mails={mails} setMails={setMails} currentUser={currentUser} inputStyle={inputStyle} /> },
    { id: 'Customers', name: 'إدارة العملاء', icon: '🤝', borderColor: '#3b82f6', component: <Customers customers={customers} setCustomers={setCustomers} /> },
    { id: 'CustomerService', name: 'خدمة العملاء', icon: '🎧', borderColor: '#f59e0b', component: <CustomerService tickets={customerService} setTickets={setCustomerService} /> },
    { id: 'Documents', name: 'المستندات والأوراق', icon: '📁', borderColor: '#6366f1', component: <Documents documents={documents} setDocuments={setDocuments} /> },
    { id: 'Attendance', name: 'الحضور والانصراف', icon: '📅', borderColor: '#10b981', component: <Attendance attendance={attendance} setAttendance={setAttendance} /> },
    { id: 'Commissions', name: 'العمولات والمبيعات', icon: '💎', borderColor: '#ec4899', component: <Commissions commissions={commissions} setCommissions={setCommissions} /> },
  ];

  const currentApp = appsList.find(app => app.id === activeApp);

  return (
    <div style={{ background: '#0b0f19', color: '#f8fafc', minHeight: '100vh', fontFamily: 'Tajawal, sans-serif', direction: 'rtl', paddingBottom: '40px' }}>
      <header style={{ background: '#111827', borderBottom: '1px solid #1f2937', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => { setShowStorefront(true); setActiveApp(null); }}
            style={{ background: showStorefront ? '#f97316' : '#1e293b', color: '#fff', border: showStorefront ? 'none' : '1px solid #334155', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            🛍️ واجهة المتجر الرئيسي
          </button>
          <button 
            onClick={() => { setShowStorefront(false); }}
            style={{ background: !showStorefront ? '#2563eb' : '#1e293b', color: '#fff', border: !showStorefront ? 'none' : '1px solid #334155', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            ⚙️ لوحة التحكم الإدارية
          </button>
          {!showStorefront && activeApp && (
            <button onClick={() => setActiveApp(null)} style={{ background: '#475569', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              ← القائمة الإدارية
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>المدير: <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{currentUser.name}</span></span>
          <div style={{ background: '#1e293b', border: '1px solid #3b82f6', padding: '6px 14px', borderRadius: '8px', color: '#fff', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            HAMZA STORE <span style={{ background: '#2563eb', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>ح</span>
          </div>
        </div>
      </header>

      <main style={{ padding: '30px 40px', maxWidth: '1450px', margin: '0 auto' }}>
        {showStorefront ? (
          <Storefront 
            products={products} setProducts={setProducts} 
            transactions={accountingTransactions} setTransactions={setAccountingTransactions} 
            mails={mails} setMails={setMails} 
            inputStyle={inputStyle} 
          />
        ) : (
          <div>
            {!activeApp ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '35px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '10px' }}>لوحة التحكم الإدارية والمالية</h2>
                  <p style={{ color: '#94a3b8', fontSize: '15px' }}>مرحباً بك يا حمزة، إدارة شؤون الموظفين، المحاسبة، والتقارير:</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '22px' }}>
                  {appsList.map((app, index) => (
                    <div 
                      key={app.id} 
                      onClick={() => setActiveApp(app.id)} 
                      style={{ background: '#131b2e', border: `1.5px solid ${app.borderColor || '#1f2937'}`, borderRadius: '14px', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)' }}
                    >
                      <div style={{ fontSize: '36px', marginBottom: '14px' }}>{app.icon}</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>{index + 1}. {app.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '16px', padding: '25px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)' }}>
                {currentApp ? currentApp.component : <div style={{ color: '#ef4444', textAlign: 'center' }}>التطبيق غير موجود</div>}
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ textAlign: 'center', marginTop: '50px', color: '#64748b', fontSize: '13px', borderTop: '1px solid #1f2937', paddingTop: '20px' }}>
        © 2026 Hamza Cards Store — جميع الحقوق محفوظة ومرتبطة آلياً بالمتجر الرئيسي والنظام المحاسبي
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}