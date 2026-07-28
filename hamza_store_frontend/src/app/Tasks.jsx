import React, { useState } from 'react';

function Tasks({ 
  inputStyle = {}, 
  mails = [], 
  setMails = () => {},
  tasks = [
    { id: 1, title: 'مراجعة التقارير', description: 'مراجعة تقارير المبيعات الأسبوعية وبطاقات الألعاب', date: '2026-07-25', completed: false, department: 'المبيعات' },
    { id: 2, title: 'اجتماع الفريق', description: 'اجتماع مع فريق الدعم الفني لحل مشاكل الشحن الفوري', date: '2026-07-26', completed: true, department: 'الدعم الفني' },
    { id: 3, title: 'تحديث النظام', description: 'تحديث قواعد البيانات وتأمين البوابة', date: '2026-07-27', completed: false, department: 'التقنية' }
  ],
  setTasks = () => {},
  // مساحات التخزين الأولية
  storageSpaces = [
    { id: 1, name: 'خادم قواعد البيانات الأساسي', capacityGB: 500, usedGB: 380, department: 'التقنية' },
    { id: 2, name: 'مستودع النسخ الاحتياطي', capacityGB: 1000, usedGB: 650, department: 'الدعم الفني' },
    { id: 3, name: 'أرشيف بطاقات المبيعات', capacityGB: 250, usedGB: 120, department: 'المبيعات' }
  ],
  setStorageSpaces = () => {}
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [department, setDepartment] = useState('');

  const [filterDate, setFilterDate] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // حالات نافذة التعديل (Modal) للمهمة
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDept, setEditDept] = useState('');

  // حالات إضافة مساحة تخزين جديدة
  const [storageName, setStorageName] = useState('');
  const [storageCapacity, setStorageCapacity] = useState('');
  const [storageUsed, setStorageUsed] = useState('');
  const [storageDept, setStorageDept] = useState('');

  // ➕ إضافة مهمة جديدة مع توثيق السجل الحي
  const addTask = (e) => {
    e.preventDefault();
    if (!title || !description || !date || !department) {
      alert('⚠️ يرجى تعبئة كافة حقول المهمة المطلوبة.');
      return;
    }

    const newTask = {
      id: Date.now(),
      title,
      description,
      date,
      completed: false,
      department
    };

    setTasks([...tasks, newTask]);

    const logText = `📝 تم إضافة مهمة جديدة: (${title}) لقسم (${department}) موعدها (${date})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    setTitle('');
    setDescription('');
    setDate('');
    setDepartment('');
  };

  // 💽 إضافة مساحة تخزين جديدة وتوثيقها
  const addStorageSpace = (e) => {
    e.preventDefault();
    if (!storageName || !storageCapacity || !storageDept) {
      alert('⚠️ يرجى تعبئة حقول مساحة التخزين الأساسية.');
      return;
    }

    const newSpace = {
      id: Date.now(),
      name: storageName,
      capacityGB: Number(storageCapacity),
      usedGB: Number(storageUsed || 0),
      department: storageDept
    };

    setStorageSpaces([...storageSpaces, newSpace]);

    const logText = `💽 تم إضافة مساحة تخزين جديدة: (${storageName}) بسعة (${storageCapacity}GB) لقسم (${storageDept})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    setStorageName('');
    setStorageCapacity('');
    setStorageUsed('');
    setStorageDept('');
  };

  // 🗑️ حذف مساحة تخزين
  const deleteStorage = (id) => {
    const target = storageSpaces.find(s => s.id === id);
    setStorageSpaces(storageSpaces.filter(s => s.id !== id));

    const logText = `🗑️ تم حذف مساحة التخزين: (${target?.name || 'غير معروف'})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }
  };

  // ✅ تغيير حالة المهمة (إكمال / إلغاء الإكمال) مع التوثيق
  const toggleTask = (id) => {
    const target = tasks.find(t => t.id === id);
    const newStatus = !target?.completed;

    setTasks(tasks.map(t => t.id === id ? { ...t, completed: newStatus } : t));

    const logText = `${newStatus ? '✅ تم إكمال المهمة' : '⏳ تم إعادة فتح المهمة'}: (${target?.title || id})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }
  };

  // ❌ حذف مهمة مع التوثيق
  const deleteTask = (id) => {
    const target = tasks.find(t => t.id === id);
    setTasks(tasks.filter(t => t.id !== id));

    const logText = `🗑️ تم حذف المهمة: (${target?.title || 'غير معروف'})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    if (editingTask && editingTask.id === id) {
      setEditingTask(null);
    }
  };

  // ✏️ فتح نافذة التعديل
  const openEditModal = (t) => {
    setEditingTask(t);
    setEditTitle(t.title || '');
    setEditDesc(t.description || '');
    setEditDate(t.date || '');
    setEditDept(t.department || '');
  };

  // 💾 حفظ التعديل على المهمة
  const handleSaveEdit = () => {
    if (!editingTask) return;

    setTasks(tasks.map(t => {
      if (t.id === editingTask.id) {
        return {
          ...t,
          title: editTitle,
          description: editDesc,
          date: editDate,
          department: editDept
        };
      }
      return t;
    }));

    const logText = `✏️ تم تحديث بيانات المهمة: (${editTitle})`;
    if (setMails && Array.isArray(mails)) {
      setMails([...mails, logText]);
    }

    setEditingTask(null);
  };

  // 📊 إحصائيات دقيقة للمهام
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 🔍 فلترة وبحث متقدم
  const filteredTasks = tasks.filter(t => {
    const matchDate = filterDate ? t.date === filterDate : true;
    const matchDept = filterDept === 'all' ? true : t.department === filterDept;
    const matchSearch = ((t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return matchDate && matchDept && matchSearch;
  });

  // استخراج الأقسام الفريدة
  const departments = ['all', ...new Set(tasks.map(t => t.department))];

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: '22px', fontWeight: 'bold' }}>
            📝 إدارة المهام ومساحات التخزين (Tasks & Storage)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة وتوزيع المهام الإدارية والفنية ومتابعة مساحات السيرفرات والتخزين السحابي للأقسام.</p>
        </div>

        <div style={{ background: '#1e293b', color: '#38bdf8', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
          إنجاز المهام: {completionRate}%
        </div>
      </div>

      {/* قسم إدارة مساحات التخزين */}
      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '16px' }}>💽 إدارة ومراقبة مساحات التخزين والسيرفرات</h4>

        {/* نموذج إضافة مساحة تخزين */}
        <form onSubmit={addStorageSpace} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', background: '#0b0f19', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <input type="text" placeholder="اسم وحدة التخزين/السيرفر..." value={storageName} onChange={(e) => setStorageName(e.target.value)} style={{ background: '#111827', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '12px', ...inputStyle }} />
          <input type="number" placeholder="السعة الكلية (GB)..." value={storageCapacity} onChange={(e) => setStorageCapacity(e.target.value)} style={{ background: '#111827', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '12px', ...inputStyle }} />
          <input type="number" placeholder="المستخدم حالياً (GB)..." value={storageUsed} onChange={(e) => setStorageUsed(e.target.value)} style={{ background: '#111827', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '12px', ...inputStyle }} />
          <select value={storageDept} onChange={(e) => setStorageDept(e.target.value)} style={{ background: '#111827', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#fff', fontSize: '12px', ...inputStyle }}>
            <option value="">اختر القسم...</option>
            <option value="المبيعات">المبيعات</option>
            <option value="الدعم الفني">الدعم الفني</option>
            <option value="التقنية">التقنية</option>
            <option value="الإدارة">الإدارة</option>
          </select>
          <button type="submit" style={{ gridColumn: '1 / -1', background: '#0ea5e9', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            إضافة مساحة تخزين جديدة ➕
          </button>
        </form>

        {/* عرض مساحات التخزين */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
          {storageSpaces.map((storage) => {
            const usagePercent = Math.round((storage.usedGB / storage.capacityGB) * 100);
            return (
              <div key={storage.id} style={{ background: '#0b0f19', padding: '14px', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>{storage.name}</span>
                  <span style={{ fontSize: '11px', background: '#1e293b', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px' }}>{storage.department}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  المستخدم: {storage.usedGB} GB من {storage.capacityGB} GB ({usagePercent}%)
                </div>
                {/* شريط التقدم */}
                <div style={{ width: '100%', background: '#1e293b', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${usagePercent}%`, background: usagePercent > 85 ? '#ef4444' : '#10b981', height: '100%', transition: 'width 0.3s' }}></div>
                </div>
                <button type="button" onClick={() => deleteStorage(storage.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '4px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>
                  حذف المساحة 🗑️
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* نموذج إضافة مهمة جديدة */}
      <form onSubmit={addTask} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#38bdf8', fontSize: '15px' }}>➕ إضافة مهمة جديدة</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <input type="text" placeholder="عنوان المهمة..." value={title} onChange={(e) => setTitle(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          <input type="text" placeholder="وصف تفصيلي للمهمة..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="">اختر القسم المسؤول...</option>
            <option value="المبيعات">المبيعات</option>
            <option value="الدعم الفني">الدعم الفني</option>
            <option value="التقنية">التقنية</option>
            <option value="الإدارة">الإدارة</option>
          </select>
        </div>

        <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}>
          إضافة المهمة وتوثيقها في السجل ➕
        </button>
      </form>

      {/* شريط البحث والفلترة */}
      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #1f2937', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h4 style={{ margin: '0', color: '#facc15', fontSize: '14px' }}>🔍 بحث وفلترة متقدمة</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="ابحث في عنوان أو وصف المهام..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />
          <input 
            type="date" 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
          />
          <select 
            value={filterDept} 
            onChange={(e) => setFilterDept(e.target.value)} 
            style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}
          >
            {departments.map((d, i) => (
              <option key={i} value={d}>{d === 'all' ? 'كل الأقسام النشطة' : d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* قائمة المهام */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        {filteredTasks.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px', gridColumn: '1 / -1' }}>لا توجد مهام مطابقة لخيارات البحث والفلترة</p>
        ) : (
          filteredTasks.map(task => (
            <div key={task.id} style={{ background: '#111827', padding: '16px', borderRadius: '14px', border: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: task.completed ? '#34d399' : '#f97316', fontWeight: 'bold' }}>
                  {task.completed ? 'مكتملة ✅' : 'قيد التنفيذ ⏳'}
                </span>
                <span style={{ fontSize: '12px', background: '#1e293b', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px' }}>
                  {task.department}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ margin: '0', color: '#fff', fontSize: '15px' }}>{task.title}</h4>
                <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>{task.description}</p>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '12px' }}>📅 موعد الاستحقاق: {task.date}</p>
              </div>

              {/* أزرار التفاعل مع المهمة */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  onClick={() => toggleTask(task.id)} 
                  style={{ flex: 1, background: task.completed ? '#f59e0b' : '#10b981', color: '#fff', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {task.completed ? 'إلغاء الإكمال ↩️' : 'إكمال المهمة ✓'}
                </button>
                <button 
                  type="button"
                  onClick={() => openEditModal(task)}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  تعديل ✏️
                </button>
                <button 
                  type="button"
                  onClick={() => deleteTask(task.id)} 
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  حذف 🗑️
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* قسم الإحصائيات العامة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>إجمالي المهام المسجلة</span>
          <span style={{ color: '#38bdf8', fontSize: '20px', fontWeight: 'bold' }}>{totalTasks}</span>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>المهام المكتملة بنجاح</span>
          <span style={{ color: '#34d399', fontSize: '20px', fontWeight: 'bold' }}>{completedTasks}</span>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>المهام قيد الانتظار</span>
          <span style={{ color: '#facc15', fontSize: '20px', fontWeight: 'bold' }}>{pendingTasks}</span>
        </div>
      </div>

      {/* نافذة منبثقة لتعديل المهمة */}
      {editingTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid #334155', borderRadius: '20px', width: '100%', maxWidth: '450px', padding: '30px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '15px' }} onClick={(e) => e.stopPropagation()}>
            
            <button 
              type="button"
              onClick={() => setEditingTask(null)}
              style={{ position: 'absolute', top: '20px', left: '20px', background: '#1f2937', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '18px' }}>✏️ تعديل تفاصيل المهمة</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>عنوان المهمة</label>
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', ...inputStyle }} />

              <label style={{ fontSize: '12px', color: '#94a3b8' }}>وصف المهمة</label>
              <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', ...inputStyle }} />

              <label style={{ fontSize: '12px', color: '#94a3b8' }}>تاريخ الاستحقاق</label>
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', ...inputStyle }} />

              <label style={{ fontSize: '12px', color: '#94a3b8' }}>القسم المسؤول</label>
              <select value={editDept} onChange={(e) => setEditDept(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', ...inputStyle }}>
                <option value="المبيعات">المبيعات</option>
                <option value="الدعم الفني">الدعم الفني</option>
                <option value="التقنية">التقنية</option>
                <option value="الإدارة">الإدارة</option>
              </select>
            </div>

            <button 
              type="button"
              onClick={handleSaveEdit}
              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
            >
              حفظ التعديلات ✅
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Tasks;