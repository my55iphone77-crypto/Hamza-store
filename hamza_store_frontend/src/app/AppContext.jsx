import React, { createContext, useContext } from 'react';
import { useSyncedState } from './useSyncedState.jsx';

const AppContext = createContext();

export function AppProvider({ children }) {
  // 1. قسم الموظفين، الحضور، الرواتب، وسجلات الأداء (مع بيانات أولية لملء الفراغ)
  const [employees, setEmployees] = useSyncedState('app_employees', [
    { id: 1, name: 'أحمد محمد', role: 'مدير مبيعات', phone: '0791111111', email: 'ahmad@company.com', salary: 600, status: 'مفعل' },
    { id: 2, name: 'سارة خالد', role: 'خدمة عملاء', phone: '0782222222', email: 'sara@company.com', salary: 500, status: 'مفعل' }
  ]);
  const [attendance, setAttendance] = useSyncedState('app_attendance', [
    { id: 1, employeeName: 'أحمد محمد', date: '2026-07-28', status: 'حاضر' }
  ]);
  const [salaries, setSalaries] = useSyncedState('app_salaries', [
    { id: 1, employeeName: 'أحمد محمد', basicSalary: 600, bonuses: 50, deductions: 0, net: 650, status: 'تم الصرف' }
  ]);
  const [workHours, setWorkHours] = useSyncedState('app_work_hours', [
    { id: 1, employeeName: 'أحمد محمد', hours: 8, date: '2026-07-28' }
  ]);
  const [performance, setPerformance] = useSyncedState('app_performance', [
    { id: 1, employeeName: 'أحمد محمد', rating: 'ممتاز', notes: 'أداء متميز في المبيعات' }
  ]);
  const [achievements, setAchievements] = useSyncedState('app_achievements', [
    { id: 1, title: 'تحقيق هدف المبيعات الشهري', employee: 'أحمد محمد', date: '2026-07-28' }
  ]);

  // 2. قسم المنتجات، المخزون، الكوبونات، والمبيعات
  const [products, setProducts] = useSyncedState('app_products', [
    { id: 1, name: 'بطاقات ألعاب شدات ببجي', price: 10, stock: 150, category: 'بطاقات رقمية' },
    { id: 2, name: 'بطاقات ريزر جولد', price: 25, stock: 80, category: 'بطاقات رقمية' }
  ]);
  const [coupons, setCoupons] = useSyncedState('app_coupons', [
    { id: 1, code: 'HAMZA2026', discount: 15, active: true }
  ]);
  const [salesLog, setSalesLog] = useSyncedState('app_sales_log', [
    { id: 1, productName: 'بطاقات ألعاب شدات ببجي', quantity: 2, total: 20, date: '2026-07-28' }
  ]);
  const [accountingTransactions, setAccountingTransactions] = useSyncedState('accounting_transactions', [
    { id: 1, type: 'إيراد مبيعات', amount: 20, description: 'بيع بطاقات ببجي', date: '2026-07-28' }
  ]);
  const [analytics, setAnalytics] = useSyncedState('app_analytics', { totalSales: 20, totalOrders: 1 });

  // 3. قسم العملاء، خدمة العملاء، والتذاكر
  const [customers, setCustomers] = useSyncedState('app_customers', [
    { id: 1, name: 'محمد علي', phone: '0773333333', email: 'mohammad@gmail.com' }
  ]);
  const [customerService, setCustomerService] = useSyncedState('app_customer_service', [
    { id: 1, customerName: 'محمد علي', issue: 'تأخر استلام الكود', status: 'مفتوحة' }
  ]);
  const [tickets, setTickets] = useSyncedState('app_tickets', [
    { id: 1, title: 'مشكلة في الشحن', priority: 'عالية', status: 'قيد المراجعة' }
  ]);

  // 4. قسم البريد، الشات الداخلي، والإعلانات
  const [mails, setMails] = useSyncedState('app_mails', [
    { id: 1, sender: 'ahmad@company.com', subject: 'تقرير المبيعات اليومي', body: 'تم إنجاز المبيعات بنجاح.', date: '2026-07-28' }
  ]);
  const [employeeChat, setEmployeeChat] = useSyncedState('app_employee_chat', [
    { id: 1, sender: 'أحمد', text: 'صباح الخير جميعاً', time: '09:00 AM' }
  ]);
  const [announcements, setAnnouncements] = useSyncedState('app_announcements', [
    { id: 1, title: 'خصومات الصيف الكبرى', content: 'خصم 20% على جميع البطاقات.', date: '2026-07-28' }
  ]);

  // 5. قسم المهام، المستندات، السجلات، الإعدادات وباقي الأدوات
  const [tasks, setTasks] = useSyncedState('app_tasks', [
    { id: 1, title: 'تحديث أسعار المخزون', assignedTo: 'أحمد محمد', status: 'قيد التنفيذ' }
  ]);
  const [documents, setDocuments] = useSyncedState('app_documents', [
    { id: 1, title: 'عقد العمل الجماعي', type: 'PDF', date: '2026-01-01' }
  ]);
  const [logs, setLogs] = useSyncedState('app_logs', [
    { id: 1, action: 'تسجيل دخول المدير', user: 'حمزة', time: '2026-07-28 10:00 AM' }
  ]);
  const [commissions, setCommissions] = useSyncedState('app_commissions', [
    { id: 1, employeeName: 'أحمد محمد', amount: 30, date: '2026-07-28' }
  ]);
  const [contacts, setContacts] = useSyncedState('app_contacts', [
    { id: 1, name: 'أحمد محمد', phone: '0791111111', email: 'ahmad@company.com' }
  ]);
  const [aiBot, setAiBot] = useSyncedState('app_ai_bot', []);
  const [managerMonitor, setManagerMonitor] = useSyncedState('app_manager_monitor', {});
  const [settings, setSettings] = useSyncedState('app_settings', { storeName: 'Hamza Cards Store', currency: '$' });

  // 🪄 دالة سحرية ذكية: لأي تطبيق جديد تضيفه مستقبلاً دون الحاجة لتعديل هذا الملف أبداً!
  const useDynamicState = (key, initialValue) => {
    return useSyncedState(`app_dynamic_${key}`, initialValue);
  };

  return (
    <AppContext.Provider value={{ 
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
      settings, setSettings,
      useDynamicState // 👈 تتيح لأي تطبيق جديد إنشاء حالته المرتبطة والمتزامنة فوراً
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}