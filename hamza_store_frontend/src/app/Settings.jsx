import React, { useState } from 'react';

function Settings({ 
  currentUser = { role: 'manager' }, 
  inputStyle = {}, 
  mails = [], 
  setMails = () => {},
  branches = [
    { id: 1, name: 'الفرع الرئيسي', logo: null, sales: 1200, employees: 15, growth: 12 },
    { id: 2, name: 'فرع عمان', logo: null, sales: 800, employees: 10, growth: 8 },
    { id: 3, name: 'فرع إربد', logo: null, sales: 600, employees: 7, growth: 5 }
  ],
  setBranches = () => {}
}) {
  const [language, setLanguage] = useState('ar');
  const [theme, setTheme] = useState('dark');
  const [role, setRole] = useState(currentUser?.role || 'manager'); 
  const [notifications, setNotifications] = useState(true);
  const [exportFormat, setExportFormat] = useState('CSV');
  const [autoRefresh, setAutoRefresh] = useState(5);
  const [twoFactor, setTwoFactor] = useState(false);

  const [globalName, setGlobalName] = useState('');
  const [globalLogo, setGlobalLogo] = useState(null);

  // تحديث اسم الفرع المنفرد مع توثيق الحدث
  const handleBranchNameChange = (id, newName) => {
    setBranches(branches.map(b => b.id === id ? { ...b, name: newName } : b));
  };

  // رفع شعار لفرع محدد
  const handleBranchLogoChange = (id, file) => {
    if (file) {
      const logoURL = URL.createObjectURL(file);
      setBranches(branches.map(b => b.id === id ? { ...b, logo: logoURL } : b));
      
      const targetBranch = branches.find(b => b.id === id);
      const logText = `🖼️ تم تحديث شعار الفرع (${targetBranch?.name || id})`;
      if (setMails && Array.isArray(mails)) {
        setMails([...mails, logText]);
      }
    }
  };

  // تطبيق التعديل الجماعي على جميع الفروع
  const applyGlobalChanges = () => {
    if (!globalName && !globalLogo) {
      alert('⚠️ يرجى إدخال اسم أو شعار لتطبيقه على كافة الفروع.');
      return;
    }

    setBranches(branches.map(b => ({
      ...b,
      name: globalName || b.name,
      logo: globalLogo || b.logo
    })));

    const logText = `⚡ تم تطبيق التحديث الجماعي على كافة الفروع (الاسم الموحد: ${globalName || 'بدون تغيير'})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    alert('✅ تم تطبيق التعديلات الجماعية بنجاح على جميع الفروع.');
    setGlobalName('');
  };

  // حفظ الإعدادات بالكامل مع تسجيل الحدث في سجل النظام
  const saveSettings = () => {
    const logText = `⚙️ تم تحديث إعدادات النظام العامة (اللغة: ${language}, الثيم: ${theme}, الإشعارات: ${notifications ? 'مفعلة' : 'موقوفة'})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    alert(`
✅ تم حفظ إعدادات النظام بنجاح:
- اللغة: ${language === 'ar' ? 'العربية' : 'English'}
- الثيم: ${theme === 'dark' ? 'داكن' : 'فاتح'}
- الصلاحيات: ${role}
- الإشعارات: ${notifications ? "مفعلة" : "موقوفة"}
- صيغة التصدير المفضلة: ${exportFormat}
- التحديث التلقائي: كل ${autoRefresh} دقائق
- الأمان الثنائي (2FA): ${twoFactor ? "مفعل" : "غير مفعل"}
- عدد الفروع النشطة: ${branches.length} فرع
    `);
  };

  // إحصائيات عامة للفروع
  const totalSales = branches.reduce((sum, b) => sum + (b.sales || 0), 0);
  const totalEmployees = branches.reduce((sum, b) => sum + (b.employees || 0), 0);
  const avgGrowth = branches.length ? (branches.reduce((sum, b) => sum + (b.growth || 0), 0) / branches.length).toFixed(1) : 0;

  return (
    <div style={{ 
      background: '#0b0f19', 
      padding: '35px', 
      borderRadius: '24px', 
      color: '#f8fafc', 
      fontFamily: 'Tajawal, sans-serif', 
      border: '1px solid #1e293b', 
      boxShadow: '0 25px 30px -10px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px' 
    }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid #1e293b', 
        paddingBottom: '20px', 
        flexWrap: 'wrap', 
        gap: '15px' 
      }}>
        <div>
          <h2 style={{ margin: '0 0 6px 0', color: '#f97316', fontSize: '24px', fontWeight: 'bold' }}>
            ⚙️ إعدادات النظام والفروع (Settings)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13.5px' }}>
            تخصيص واجهة المستخدم، إدارة الفروع الشاملة، وضبط تفضيلات الأمان والإشعارات.
          </p>
        </div>
      </div>

      {/* قسم الإعدادات العامة والتفضيلات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        
        {/* اللغة */}
        <div style={{ background: '#111827', padding: '22px', borderRadius: '18px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>🌐 لغة النظام</h4>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', background: '#0b0f19', border: '1px solid #334155', padding: '12px 14px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }}>
            <option value="ar">العربية (Arabic)</option>
            <option value="en">English (الإنجليزية)</option>
          </select>
        </div>

        {/* الثيم */}
        <div style={{ background: '#111827', padding: '22px', borderRadius: '18px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>🎨 ثيم الألوان</h4>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: '100%', background: '#0b0f19', border: '1px solid #334155', padding: '12px 14px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }}>
            <option value="dark">داكن (Dark Mode)</option>
            <option value="light">فاتح (Light Mode)</option>
          </select>
        </div>

        {/* صيغة التصدير */}
        <div style={{ background: '#111827', padding: '22px', borderRadius: '18px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>📤 صيغة التصدير المفضلة</h4>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ width: '100%', background: '#0b0f19', border: '1px solid #334155', padding: '12px 14px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }}>
            <option value="CSV">CSV ملف جدول بيانات</option>
            <option value="PDF">PDF تقرير طباعة</option>
          </select>
        </div>

      </div>

      {/* إعدادات الأمان والإشعارات والتحديث التلقائي */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        <div style={{ background: '#111827', padding: '22px', borderRadius: '18px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: '0', color: '#34d399', fontSize: '15px' }}>🔔 إعدادات التنبيهات والأمان</h4>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13.5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={notifications}
              onChange={() => setNotifications(!notifications)}
              style={{ width: '18px', height: '18px', accentColor: '#22c55e', cursor: 'pointer' }}
            />
            تفعيل الإشعارات والتنبيهات الحية
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13.5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={twoFactor}
              onChange={() => setTwoFactor(!twoFactor)}
              style={{ width: '18px', height: '18px', accentColor: '#22c55e', cursor: 'pointer' }}
            />
            تفعيل المصادقة الثنائية للحساب (2FA)
          </label>
        </div>

        <div style={{ background: '#111827', padding: '22px', borderRadius: '18px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={{ margin: '0', color: '#facc15', fontSize: '15px' }}>⏱️ تحديث البيانات التلقائي</h4>
          <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>اختر فترة التحديث التلقائي للتقارير واللوحة:</span>
          <select value={autoRefresh} onChange={(e) => setAutoRefresh(Number(e.target.value))} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px 14px', borderRadius: '12px', color: '#fff', fontSize: '13.5px', ...inputStyle }}>
            <option value={1}>كل دقيقة واحدة</option>
            <option value={5}>كل 5 دقائق</option>
            <option value={15}>كل 15 دقيقة</option>
          </select>
        </div>

      </div>

      {/* قسم إدارة الفروع والتحكم الإداري الشامل (خاص بالمدير) */}
      {(role === 'manager' || currentUser?.role === 'manager') && (
        <div style={{ background: '#111827', padding: '25px', borderRadius: '20px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: '0', color: '#f97316', fontSize: '17px' }}>👑 لوحة إدارة الفروع والشركاء</h3>
            <span style={{ background: '#1e293b', color: '#38bdf8', padding: '8px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #334155' }}>
              إجمالي الفروع المسجلة: {branches.length}
            </span>
          </div>

          {/* شبكة الفروع */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {branches.map(branch => (
              <div key={branch.id} style={{ background: '#0b0f19', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', color: '#94a3b8' }}>🏬 اسم الفرع:</label>
                  <input 
                    type="text" 
                    value={branch.name} 
                    onChange={(e) => handleBranchNameChange(branch.id, e.target.value)} 
                    style={{ background: '#111827', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13.5px', ...inputStyle }} 
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', color: '#94a3b8' }}>🖼️ شعار الفرع:</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleBranchLogoChange(branch.id, e.target.files[0])} 
                    style={{ background: '#111827', border: '1px solid #334155', padding: '8px', borderRadius: '10px', color: '#fff', fontSize: '12px', ...inputStyle }} 
                  />
                </div>

                {branch.logo && (
                  <div style={{ textAlign: 'center', marginTop: '4px' }}>
                    <img src={branch.logo} alt="شعار الفرع" style={{ maxWidth: '90px', maxHeight: '55px', borderRadius: '8px', objectFit: 'contain' }} />
                  </div>
                )}

                <div style={{ background: '#111827', padding: '12px', borderRadius: '10px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #1f2937' }}>
                  <span style={{ color: '#34d399' }}>💰 المبيعات: ${branch.sales || 0}</span>
                  <span style={{ color: '#38bdf8' }}>👥 الموظفين: {branch.employees || 0} موظف</span>
                  <span style={{ color: '#facc15' }}>📈 نسبة النمو: {branch.growth || 0}%</span>
                </div>

              </div>
            ))}
          </div>

          {/* أداة التعديل الجماعي لكل الفروع */}
          <div style={{ background: '#0b0f19', padding: '22px', borderRadius: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h5 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>⚡ أداة التعديل الموحد لكافة الفروع</h5>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <input 
                type="text" 
                placeholder="اسم موحّد لكل الفروع..."
                value={globalName} 
                onChange={(e) => setGlobalName(e.target.value)} 
                style={{ background: '#111827', border: '1px solid #334155', padding: '12px 14px', borderRadius: '10px', color: '#fff', fontSize: '13.5px', ...inputStyle }} 
              />
              
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files[0]) {
                    setGlobalLogo(URL.createObjectURL(e.target.files[0]));
                  }
                }} 
                style={{ background: '#111827', border: '1px solid #334155', padding: '10px', borderRadius: '10px', color: '#fff', fontSize: '12.5px', ...inputStyle }} 
              />
            </div>

            {globalLogo && (
              <div style={{ marginTop: '5px' }}>
                <img src={globalLogo} alt="شعار موحّد" style={{ maxWidth: '110px', borderRadius: '10px' }} />
              </div>
            )}

            <button 
              type="button"
              onClick={applyGlobalChanges} 
              style={{ background: '#f97316', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13.5px', alignSelf: 'flex-start', boxShadow: '0 4px 10px rgba(249, 115, 22, 0.3)' }}
            >
              🔄 تطبيق التعديل الموحد على جميع الفروع
            </button>
          </div>

          {/* ملخص عام ومؤشرات الأداء لكافة الفروع */}
          <div style={{ background: '#0b0f19', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '12.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>إجمالي مبيعات الفروع</span>
              <span style={{ fontSize: '18px', color: '#34d399', fontWeight: 'bold' }}>${totalSales}</span>
            </div>
            <div>
              <span style={{ fontSize: '12.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>إجمالي الموظفين</span>
              <span style={{ fontSize: '18px', color: '#38bdf8', fontWeight: 'bold' }}>{totalEmployees} موظف</span>
            </div>
            <div>
              <span style={{ fontSize: '12.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>متوسط نسبة النمو</span>
              <span style={{ fontSize: '18px', color: '#facc15', fontWeight: 'bold' }}>{avgGrowth}%</span>
            </div>
          </div>

        </div>
      )}

      {/* زر الحفظ النهائي */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '5px' }}>
        <button 
          type="button"
          onClick={saveSettings} 
          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
        >
          💾 حفظ كافة الإعدادات والنظام
        </button>
      </div>

    </div>
  );
}

export default Settings;