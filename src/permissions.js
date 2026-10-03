export const PERMISSION_CATALOG = [
  { key: 'view_dashboard', label: 'رؤية لوحة التحكم' },
  { key: 'manage_products', label: 'إدارة المنتجات والمخزون' },
  { key: 'manage_employees', label: 'إدارة الموظفين' },
  { key: 'manage_salaries', label: 'إدارة الرواتب والمكافآت' },
  { key: 'manage_attendance', label: 'إدارة الحضور والانصراف' },
  { key: 'manage_work_hours', label: 'إدارة ساعات العمل' },
  { key: 'manage_tasks', label: 'إدارة المهام' },
  { key: 'manage_performance', label: 'مراقبة الأداء' },
  { key: 'manage_achievements', label: 'إدارة الإنجازات' },
  { key: 'manage_commissions', label: 'إدارة العمولات' },
  { key: 'manage_accounting', label: 'إدارة المحاسبة' },
  { key: 'manage_orders', label: 'إدارة الطلبات والمبيعات' },
  { key: 'manage_customers', label: 'إدارة العملاء' },
  { key: 'manage_support', label: 'إدارة خدمة العملاء' },
  { key: 'manage_tickets', label: 'إدارة تذاكر الدعم' },
  { key: 'manage_documents', label: 'إدارة المستندات' },
  { key: 'send_email', label: 'إرسال البريد الإلكتروني' },
  { key: 'manage_announcements', label: 'إدارة الإعلانات' },
  { key: 'view_analytics', label: 'رؤية الإحصائيات' },
  { key: 'manage_coupons', label: 'إدارة الكوبونات' },
  { key: 'view_logs', label: 'رؤية سجل النشاطات' },
  { key: 'manage_settings', label: 'إدارة إعدادات المتجر' },
  { key: 'manage_permissions', label: 'إدارة الصلاحيات' },
];

export const ROLE_DEFAULT_PERMISSIONS = {
  owner: PERMISSION_CATALOG.map(({ key }) => key),
  admin: PERMISSION_CATALOG.map(({ key }) => key),
  manager: [
    'view_dashboard', 'manage_products', 'manage_employees', 'manage_salaries',
    'manage_attendance', 'manage_work_hours', 'manage_tasks', 'manage_performance',
    'manage_achievements', 'manage_commissions', 'manage_accounting', 'manage_orders',
    'manage_customers', 'manage_support', 'manage_tickets', 'manage_documents',
    'send_email', 'manage_announcements', 'view_analytics', 'manage_coupons', 'view_logs',
  ],
  stock: ['view_dashboard', 'manage_products', 'manage_work_hours', 'manage_tasks'],
  sales: ['view_dashboard', 'manage_products', 'manage_orders', 'manage_customers', 'manage_coupons', 'manage_commissions'],
  support: ['view_dashboard', 'manage_customers', 'manage_support', 'manage_tickets', 'manage_documents', 'send_email'],
  employee: ['view_dashboard', 'manage_tasks', 'manage_work_hours', 'manage_achievements'],
  staff: ['view_dashboard'],
  customer: [],
};

export const APP_PERMISSION_MAP = {
  AiBot: 'view_analytics', Products: 'manage_products', Employees: 'manage_employees',
  Salaries: 'manage_salaries', Contacts: 'manage_employees', EmailCenter: 'send_email',
  EmployeeChat: 'view_dashboard', Accounting: 'manage_accounting', SalesLog: 'manage_orders',
  ManagerMonitor: 'manage_employees', Coupons: 'manage_coupons', Tickets: 'manage_tickets',
  Announcements: 'manage_announcements', Tasks: 'manage_tasks', Logs: 'view_logs',
  Settings: 'manage_settings', Analytics: 'view_analytics', Performance: 'manage_performance',
  WorkHours: 'manage_work_hours', Achievements: 'manage_achievements', Customers: 'manage_customers',
  CustomerService: 'manage_support', Documents: 'manage_documents', Attendance: 'manage_attendance',
  Commissions: 'manage_commissions',
};

export function permissionsForUser(user) {
  if (!user || user.role === 'customer') return [];
  if (user.isOwner || user.role === 'owner') return ROLE_DEFAULT_PERMISSIONS.owner;
  if (Array.isArray(user.permissions)) return user.permissions;
  return ROLE_DEFAULT_PERMISSIONS[user.role] || [];
}

export function canAccessApp(user, appId) {
  if (!appId) return false;
  const required = APP_PERMISSION_MAP[appId];
  if (!required) return false;
  return permissionsForUser(user).includes(required);
}
