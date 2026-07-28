import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  Settings, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  Search,
  Bell
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(true);

  // جلب البيانات من الـ Backend
  useEffect(() => {
    axios.get('http://localhost:5000/')
      .then(res => {
        setServerData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error connecting to backend:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col dir-rtl" dir="rtl">
      
      {/* 1️⃣ Header العلوي */}
      <header className="bg-brandNavy text-white px-6 py-3 flex items-center justify-between shadow-lg border-b border-slate-700">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-lg shadow-sm flex items-center justify-center">
            {/* الشعار المرفوع من الباك إند أو مجلد المجلد العام */}
            <img 
              src="http://localhost:5000/logo.png" 
              alt="Hamza Store" 
              className="h-10 w-auto object-contain"
              onError={(e) => { e.target.src = '/logo.png'; }} 
            />
          </div>
          <div>
            <h1 className="font-extrabold text-lg leading-none tracking-wide">HAMZA STORE</h1>
            <span className="text-xs text-amber-400 font-medium">نظام الإدارة المتقدم</span>
          </div>
        </div>

        {/* شريط البحث وتنبيهات */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="بحث في النظام..." 
              className="bg-slate-800 text-sm text-white px-4 py-1.5 pr-9 rounded-full border border-slate-700 focus:outline-none focus:border-brandOrange w-64"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
          <button className="relative p-2 rounded-full hover:bg-slate-800 transition">
            <Bell className="w-5 h-5 text-slate-200" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brandOrange rounded-full"></span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* 2️⃣ القائمة الجانبية (Sidebar) */}
        <aside className="w-64 bg-slate-900 text-slate-300 p-4 flex flex-col gap-2 border-l border-slate-800">
          <div className="text-xs font-semibold text-slate-500 px-3 my-2">القائمة الرئيسية</div>
          
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium text-sm ${activeTab === 'dashboard' ? 'bg-brandOrange text-white shadow-md' : 'hover:bg-slate-800'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            لوحة التحكم
          </button>

          <button 
            onClick={() => setActiveTab('employees')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium text-sm ${activeTab === 'employees' ? 'bg-brandOrange text-white shadow-md' : 'hover:bg-slate-800'}`}
          >
            <Users className="w-5 h-5" />
            أداء الموظفين والضمير
          </button>

          <button 
            onClick={() => setActiveTab('inventory')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium text-sm ${activeTab === 'inventory' ? 'bg-brandOrange text-white shadow-md' : 'hover:bg-slate-800'}`}
          >
            <Package className="w-5 h-5" />
            المخزون والمنتجات
          </button>

          <button 
            onClick={() => setActiveTab('sales')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium text-sm ${activeTab === 'sales' ? 'bg-brandOrange text-white shadow-md' : 'hover:bg-slate-800'}`}
          >
            <ShoppingCart className="w-5 h-5" />
            الفواتير والمبيعات
          </button>

          <div className="mt-auto border-t border-slate-800 pt-4">
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium text-sm w-full ${activeTab === 'settings' ? 'bg-brandOrange text-white shadow-md' : 'hover:bg-slate-800'}`}
            >
              <Settings className="w-5 h-5" />
              إعدادات النظام
            </button>
          </div>
        </aside>

        {/* 3️⃣ منطقة المحتوى الرئيسية (Main Content) */}
        <main className="flex-1 p-8 overflow-y-auto">
          
          {/* حالة الاتصال بالـ Backend */}
          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${serverData?.success ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="font-semibold text-slate-700">حالة الربط مع Neon DB & Server:</span>
              <span className="text-sm font-medium text-slate-500">
                {loading ? 'جاري الاتصال...' : serverData?.success ? 'متصل بنجاح 🚀' : 'غير متصل (تأكد من تشغيل index.js)'}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              المتجر: <strong className="text-brandNavy">{serverData?.storeInfo?.storeName || 'Hamza Store'}</strong>
            </div>
          </div>

          {/* الإحصائيات السريعة */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">إجمالي المبيعات</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">12,450 JOD</h3>
              </div>
              <div className="bg-emerald-100 text-emerald-600 p-3 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">مؤشر ضمير الموظفين</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">98.5%</h3>
              </div>
              <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">المنتجات بالمخزن</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">1,240</h3>
              </div>
              <div className="bg-amber-100 text-amber-600 p-3 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">نمو الأرباح</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">+18.2%</h3>
              </div>
              <div className="bg-purple-100 text-purple-600 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* قسم جدولي تجريبي */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-brandNavy mb-4">أحدث العمليات في النظام</h3>
            <div className="text-slate-500 text-sm py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
              هنا سيتم عرض جدول الموظفين أو المنتجات التفاعلي والمربوط مباشرة مع قاعدة البيانات!
            </div>
          </div>

        </main>
      </div>

    </div>
  );
}