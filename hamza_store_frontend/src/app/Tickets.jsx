import React, { useState, useEffect } from 'react';

function Tickets({ 
  inputStyle = {}, 
  role = 'manager', 
  currentUser = { role: 'manager', name: 'حمد' },
  mails = [], 
  setMails = () => {}
}) {
  // 💾 استرجاع التذاكر المخزنة محلياً أو استخدام القيم الافتراضية
  const [tickets, setTickets] = useState(() => {
    const savedTickets = localStorage.getItem('gaming_store_tickets');
    if (savedTickets) {
      try {
        return JSON.parse(savedTickets);
      } catch (e) {
        console.error('Failed to parse saved tickets', e);
      }
    }
    return [
      { id: 1, title: 'مشكلة في الشحن الفوري لبطاقات الألعاب', description: 'العميل لم يصله كود الشحن بعد إتمام عملية الدفع', status: 'مفتوحة', priority: 'عالية', department: 'الدعم الفني', date: '2026-07-25', assignedTo: 'أحمد' },
      { id: 2, title: 'طلب فاتورة ضريبية', description: 'العميل يريد نسخة رسمية من فاتورة شراء بطاقة بلايستيشن', status: 'مغلقة', priority: 'منخفضة', department: 'المبيعات', date: '2026-07-26', assignedTo: 'سارة' }
    ];
  });

  // 💾 حفظ التذاكر في localStorage كلما حدث تغيير عليها
  useEffect(() => {
    localStorage.setItem('gaming_store_tickets', JSON.stringify(tickets));
  }, [tickets]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('متوسطة');
  const [department, setDepartment] = useState('الدعم الفني');
  const [assignedTo, setAssignedTo] = useState('أحمد');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // ➕ إضافة تذكرة جديدة مع توثيق السجل الحي
  const addTicket = (e) => {
    e.preventDefault();
    if (!title || !description || !department || !assignedTo || !date) {
      alert('⚠️ يرجى تعبئة كافة حقول التذكرة المطلوبة.');
      return;
    }

    const newTicket = {
      id: Date.now(),
      title,
      description,
      status: 'مفتوحة',
      priority,
      department,
      date,
      assignedTo
    };

    setTickets([...tickets, newTicket]);

    const logText = `🎫 تم إنشاء تذكرة دعم جديدة: (${title}) مسندة إلى (${assignedTo}) بقسم (${department})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    setTitle('');
    setDescription('');
    setPriority('متوسطة');
    setDepartment('');
    setAssignedTo('');
  };

  // 🔄 تغيير حالة التذكرة (فتح / إغلاق) مع التوثيق
  const toggleStatus = (id) => {
    const target = tickets.find(t => t.id === id);
    const newStatus = target?.status === 'مفتوحة' ? 'مغلقة' : 'مفتوحة';

    setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t));

    const logText = `${newStatus === 'مغلقة' ? '🔒 تم إغلاق التذكرة' : '🔓 تم إعادة فتح التذكرة'}: (${target?.title || id})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }
  };

  // ❌ حذف تذكرة مع التوثيق
  const deleteTicket = (id) => {
    const target = tickets.find(t => t.id === id);
    setTickets(tickets.filter(t => t.id !== id));

    const logText = `🗑️ تم حذف تذكرة الدعم: (${target?.title || 'غير معروف'})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }
  };

  // 📊 إحصائيات عامة
  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'مفتوحة').length;
  const closedTickets = tickets.filter(t => t.status === 'مغلقة').length;

  // 🔍 فلترة وبحث متقدم للتذاكر
  const filteredTickets = tickets.filter(t => {
    const matchStatus = filterStatus === 'all' ? true : t.status === filterStatus;
    const matchDept = filterDept === 'all' ? true : t.department === filterDept;
    const matchPriority = filterPriority === 'all' ? true : t.priority === filterPriority;
    const matchSearch = ((t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (t.assignedTo || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return matchStatus && matchDept && matchPriority && matchSearch;
  });

  // 🖼️ الشعارات حسب القسم والأولوية
  const deptIcons = {
    'المبيعات': '💰',
    'الدعم الفني': '🔧',
    'التقنية': '💻',
    'الإدارة': '👑'
  };

  const priorityIcons = {
    'منخفضة': '🟢',
    'متوسطة': '🟡',
    'عالية': '🔴'
  };

  // 📊 بيانات لوحة تحكم المدير
  const departments = ['المبيعات', 'الدعم الفني', 'التقنية'];
  const priorities = ['منخفضة', 'متوسطة', 'عالية'];

  const ticketsByDept = departments.map(d => ({
    dept: d,
    count: tickets.filter(t => t.department === d).length
  }));

  const ticketsByPriority = priorities.map(p => ({
    priority: p,
    count: tickets.filter(t => t.priority === p).length
  }));

  const ticketsByEmployee = [...new Set(tickets.map(t => t.assignedTo))].map(emp => ({
    employee: emp,
    count: tickets.filter(t => t.assignedTo === emp).length
  }));

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: '22px', fontWeight: 'bold' }}>
            🎫 نظام التذاكر والدعم الفني (Tickets Management)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة استفسارات العملاء، مشاكل شحن بطاقات الألعاب، وتوزيع المهام على فرق العمل.</p>
        </div>
        <div style={{ background: '#1e293b', color: '#38bdf8', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
          التذاكر المفتوحة: {openTickets} ⏳
        </div>
      </div>

      {/* نموذج إضافة تذكرة جديدة */}
      <form onSubmit={addTicket} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>➕ فتح تذكرة دعم جديدة</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="عنوان التذكرة والمشكلة..." value={title} onChange={(e) => setTitle(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          <input type="text" placeholder="وصف تفصيلي للمشكلة..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="">اختر القسم المختص...</option>
            <option value="المبيعات">💰 المبيعات</option>
            <option value="الدعم الفني">🔧 الدعم الفني</option>
            <option value="التقنية">💻 التقنية</option>
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="منخفضة">🟢 أولوية منخفضة</option>
            <option value="متوسطة">🟡 أولوية متوسطة</option>
            <option value="عالية">🔴 أولوية عاجلة (عالية)</option>
          </select>

          <input type="text" placeholder="اسم الموظف المسؤول (مثل: أحمد، سارة)..." value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
        </div>

        <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          إضافة التذكرة وتوثيقها بالنظام ➕
        </button>
      </form>

      {/* شريط البحث والفلترة المتقدمة */}
      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#facc15', fontSize: '14px' }}>🔍 بحث وفلترة التذاكر</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="ابحث بالعنوان، الوصف، أو اسم المسؤول..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="all">كل الحالات</option>
            <option value="مفتوحة">مفتوحة ⏳</option>
            <option value="مغلقة">مغلقة ✅</option>
          </select>

          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="all">كل الأقسام</option>
            <option value="المبيعات">المبيعات</option>
            <option value="الدعم الفني">الدعم الفني</option>
            <option value="التقنية">التقنية</option>
          </select>

          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="all">كل الأولويات</option>
            <option value="منخفضة">منخفضة</option>
            <option value="متوسطة">متوسطة</option>
            <option value="عالية">عالية</option>
          </select>
        </div>
      </div>

      {/* قائمة التذاكر */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        {filteredTickets.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px', gridColumn: '1 / -1' }}>لا توجد تذاكر مطابقة لخيارات البحث الحالية</p>
        ) : (
          filteredTickets.map(ticket => (
            <div key={ticket.id} style={{ background: '#111827', padding: '16px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: ticket.status === 'مفتوحة' ? '#f97316' : '#34d399', fontWeight: 'bold' }}>
                  {deptIcons[ticket.department] || '📁'} {ticket.department}
                </span>
                <span style={{ fontSize: '12px', background: '#1e293b', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px' }}>
                  {priorityIcons[ticket.priority]} {ticket.priority}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ margin: '0', color: '#fff', fontSize: '15px' }}>{ticket.title}</h4>
                <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>{ticket.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                  <span>👤 المسؤول: {ticket.assignedTo}</span>
                  <span>📅 {ticket.date}</span>
                </div>
              </div>

              {/* أزرار التفاعل */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                  type="button"
                  onClick={() => toggleStatus(ticket.id)} 
                  style={{ flex: 1, background: ticket.status === 'مفتوحة' ? '#10b981' : '#f59e0b', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {ticket.status === 'مفتوحة' ? 'إغلاق التذكرة 🔒' : 'إعادة فتح 🔓'}
                </button>
                <button 
                  type="button"
                  onClick={() => deleteTicket(ticket.id)} 
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  حذف 🗑️
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* قسم الإحصائيات العامة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>إجمالي التذاكر المسجلة</span>
          <span style={{ color: '#38bdf8', fontSize: '20px', fontWeight: 'bold' }}>{totalTickets}</span>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>التذاكر المفتوحة قيد المعالجة</span>
          <span style={{ color: '#f97316', fontSize: '20px', fontWeight: 'bold' }}>{openTickets}</span>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>التذاكر المغلقة والمحلولة</span>
          <span style={{ color: '#34d399', fontSize: '20px', fontWeight: 'bold' }}>{closedTickets}</span>
        </div>
      </div>

      {/* لوحة تحكم المدير */}
      {(role === 'manager' || currentUser?.role === 'manager') && (
        <div style={{ background: '#111827', padding: '25px', borderRadius: '16px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: '0', color: '#f97316', fontSize: '16px' }}>👑 لوحة تحكم المدير وتحليلات التذاكر</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            
            {/* حسب الأقسام */}
            <div style={{ background: '#0b0f19', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h5 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '14px' }}>📂 التذاكر حسب الأقسام:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                {ticketsByDept.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{deptIcons[d.dept]} {d.dept}</span>
                    <span style={{ color: '#34d399', fontWeight: 'bold' }}>{d.count} تذكرة</span>
                  </div>
                ))}
              </div>
            </div>

            {/* حسب الأولوية */}
            <div style={{ background: '#0b0f19', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h5 style={{ margin: '0 0 10px 0', color: '#facc15', fontSize: '14px' }}>⚡ التذاكر حسب الأولوية:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                {ticketsByPriority.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{priorityIcons[p.priority]} {p.priority}</span>
                    <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{p.count} تذكرة</span>
                  </div>
                ))}
              </div>
            </div>

            {/* حسب الموظفين */}
            <div style={{ background: '#0b0f19', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
              <h5 style={{ margin: '0 0 10px 0', color: '#f97316', fontSize: '14px' }}>👥 التذاكر حسب الموظفين:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                {ticketsByEmployee.map((emp, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>👤 {emp.employee}</span>
                    <span style={{ color: '#facc15', fontWeight: 'bold' }}>{emp.count} تذكرة</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default Tickets;