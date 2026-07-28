import React, { useState, useEffect } from 'react';

function WorkHours({ 
  inputStyle = {}, 
  role = 'manager', 
  currentUser = { role: 'manager', name: 'حمد' },
  mails = [], 
  setMails = () => {}
}) {
  // 💾 استرجاع سجلات ساعات العمل المخزنة محلياً أو استخدام القيم الافتراضية
  const [hours, setHours] = useState(() => {
    const savedHours = localStorage.getItem('gaming_store_work_hours');
    if (savedHours) {
      try {
        return JSON.parse(savedHours);
      } catch (e) {
        console.error('Failed to parse saved work hours', e);
      }
    }
    return [
      { id: 1, name: 'أحمد', department: 'المبيعات', date: '2026-07-25', start: '09:00', end: '17:00' },
      { id: 2, name: 'سارة', department: 'الدعم الفني', date: '2026-07-26', start: '10:00', end: '18:00' }
    ];
  });

  // 💾 حفظ السجلات في localStorage كلما حدث تغيير عليها
  useEffect(() => {
    localStorage.setItem('gaming_store_work_hours', JSON.stringify(hours));
  }, [hours]);

  const [name, setName] = useState(currentUser?.name || '');
  const [department, setDepartment] = useState('المبيعات');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');

  const [filterDept, setFilterDept] = useState('all');
  const [filterName, setFilterName] = useState('');

  // ➕ إضافة سجل ساعات عمل جديد مع التوثيق في السجل الحي
  const addRecord = (e) => {
    e.preventDefault();
    if (!name || !department || !date || !start || !end) {
      alert('⚠️ يرجى تعبئة كافة حقول ساعات العمل المطلوبة.');
      return;
    }

    const newRecord = {
      id: Date.now(),
      name,
      department,
      date,
      start,
      end
    };

    setHours([...hours, newRecord]);

    const logText = `⏰ تم تسجيل ساعات عمل للموظف: (${name}) في قسم (${department}) ليوم (${date})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    setName('');
    setDepartment('المبيعات');
  };

  // ❌ حذف سجل مع التوثيق
  const deleteRecord = (id) => {
    const target = hours.find(h => h.id === id);
    setHours(hours.filter(h => h.id !== id));

    const logText = `🗑️ تم حذف سجل ساعات عمل للموظف: (${target?.name || 'غير معروف'})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }
  };

  // حساب عدد الساعات لكل سجل
  const calculateDuration = (startTime, endTime) => {
    try {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const hoursCount = (totalMinutes / 60).toFixed(1);
      return hoursCount > 0 ? hoursCount : 0;
    } catch {
      return 8;
    }
  };

  // تصفية السجلات
  const filteredHours = hours.filter(h => {
    const matchDept = filterDept === 'all' ? true : h.department === filterDept;
    const matchName = filterName ? (h.name || '').toLowerCase().includes(filterName.toLowerCase()) : true;
    return matchDept && matchName;
  });

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: '22px', fontWeight: 'bold' }}>
            ⏰ نظام ساعات العمل والدوام (Work Hours)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>تسجيل ومتابعة ساعات حضور والانصراف لفرق العمل ومراقبة أوقات العمل الفعلية.</p>
        </div>
        <div style={{ background: '#1e293b', color: '#38bdf8', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
          إجمالي السجلات المسجلة: {hours.length}
        </div>
      </div>

      {/* لوحة المدير لإضافة السجلات */}
      {(role === 'manager' || currentUser?.role === 'manager') && (
        <form onSubmit={addRecord} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>👑 لوحة المدير - تسجيل ساعات عمل جديدة</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="اسم الموظف..." 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
            />

            <select 
              value={department} 
              onChange={(e) => setDepartment(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}
            >
              <option value="المبيعات">💰 المبيعات</option>
              <option value="الدعم الفني">🔧 الدعم الفني</option>
              <option value="التقنية">💻 التقنية</option>
              <option value="الإدارة">👑 الإدارة</option>
            </select>

            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>من الساعة:</span>
              <input 
                type="time" 
                value={start} 
                onChange={(e) => setStart(e.target.value)} 
                style={{ background: '#0b0f19', border: '1px solid #334155', padding: '8px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>إلى الساعة:</span>
              <input 
                type="time" 
                value={end} 
                onChange={(e) => setEnd(e.target.value)} 
                style={{ background: '#0b0f19', border: '1px solid #334155', padding: '8px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
              />
            </div>
          </div>

          <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            إضافة سجل الدوام وتوثيقه بالنظام ➕
          </button>
        </form>
      )}

      {/* شريط البحث والفلترة */}
      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#facc15', fontSize: '14px' }}>🔍 تصفية وبحث في سجلات الدوام</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="ابحث باسم الموظف..." 
            value={filterName} 
            onChange={(e) => setFilterName(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />

          <select 
            value={filterDept} 
            onChange={(e) => setFilterDept(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}
          >
            <option value="all">كل الأقسام</option>
            <option value="المبيعات">المبيعات</option>
            <option value="الدعم الفني">الدعم الفني</option>
            <option value="التقنية">التقنية</option>
            <option value="الإدارة">الإدارة</option>
          </select>
        </div>
      </div>

      {/* عرض السجلات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
        {filteredHours.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px', gridColumn: '1 / -1' }}>لا توجد سجلات دوام مطابقة لخيارات البحث</p>
        ) : (
          filteredHours.map(record => {
            const duration = calculateDuration(record.start, record.end);
            return (
              <div key={record.id} style={{ background: '#111827', padding: '16px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
                  <h4 style={{ margin: '0', color: '#f97316', fontSize: '16px' }}>👤 {record.name}</h4>
                  <span style={{ fontSize: '12px', background: '#1e293b', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px' }}>
                    {record.department}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#94a3b8' }}>
                  <p style={{ margin: '0' }}>📅 التاريخ: <span style={{ color: '#fff' }}>{record.date}</span></p>
                  <p style={{ margin: '0' }}>🕘 وقت الدوام: <span style={{ color: '#34d399' }}>{record.start}</span> ➔ <span style={{ color: '#ef4444' }}>{record.end}</span></p>
                  <p style={{ margin: '0' }}>⏱️ إجمالي الساعات: <span style={{ color: '#facc15', fontWeight: 'bold' }}>{duration} ساعات</span></p>
                </div>

                {(role === 'manager' || currentUser?.role === 'manager') && (
                  <button 
                    type="button"
                    onClick={() => deleteRecord(record.id)} 
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginTop: '6px' }}
                  >
                    حذف السجل 🗑️
                  </button>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

export default WorkHours;