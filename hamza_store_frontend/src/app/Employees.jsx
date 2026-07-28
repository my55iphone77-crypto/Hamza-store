import React, { useState } from "react";
import { useApp } from "./AppContext"; // استيراد سياق النظام المركزي للتزامن التلقائي فقط

function Employees({ 
  currentUser, 
  employees: externalEmployees = [], 
  setEmployees: externalSetEmployees, 
  salaries: externalSalaries = [], 
  setSalaries: externalSetSalaries, 
  mails: externalMails = [], 
  setMails: externalSetMails,
  systemData = {} 
}) {
  // 🔗 جلب البيانات والتحكم بها مباشرة من سياق النظام المركزي
  const { 
    employees: contextEmployees, 
    setEmployees: contextSetEmployees,
    salaries: contextSalaries,
    setSalaries: contextSetSalaries,
    mails: contextMails,
    setMails: contextSetMails
  } = useApp();

  // اعتماد البيانات المركزية كأولوية قصوى لضمان التزامن التلقائي 100%
  const employees = externalSetEmployees ? externalEmployees : contextEmployees;
  const setEmployees = externalSetEmployees ? externalSetEmployees : contextSetEmployees;

  const salaries = externalSetSalaries ? externalSetSalaries : contextSalaries;
  const setSalaries = externalSetSalaries ? externalSetSalaries : contextSetSalaries;

  const mails = externalSetMails ? externalMails : contextMails;
  const setMails = externalSetMails ? externalSetMails : contextSetMails;

  const [logs, setLogs] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // حالات البحث والتوظيف والتعديل
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // حقول إضافة موظف جديد
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newNationalId, setNewNationalId] = useState('');
  const [newIdCardImage, setNewIdCardImage] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newRole, setNewRole] = useState('stock');

  // حقول تعديل موظف حالي
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editIdCardImage, setEditIdCardImage] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editRole, setEditRole] = useState('');

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeSalaries = Array.isArray(salaries) ? salaries : [];
  const safeMails = Array.isArray(mails) ? mails : [];

  // ➕ إضافة موظف جديد
  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      alert('الرجاء إدخال اسم الموظف والبريد الإلكتروني على الأقل!');
      return;
    }

    const newEmpId = Date.now();
    const parsedSalary = newSalary ? parseFloat(newSalary) : 0;

    const employeeToAdd = {
      id: newEmpId,
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim() || 'غير متوفر',
      age: newAge.trim() || 'غير متوفر',
      nationalId: newNationalId.trim() || 'غير متوفر',
      idCardImage: newIdCardImage.trim() || '',
      bankAccount: newBankAccount.trim() || 'غير متوفر',
      image: newImage.trim() || '',
      salary: parsedSalary,
      role: newRole,
      hireDate: new Date().toISOString().split('T')[0],
      status: 'نشط'
    };

    const updatedEmployees = [...safeEmployees, employeeToAdd];
    setEmployees(updatedEmployees);

    if (typeof setSalaries === 'function') {
      const salaryRecord = {
        id: newEmpId,
        employeeId: newEmpId,
        name: newName.trim(),
        base: parsedSalary,
        salary: parsedSalary,
        monthlySalary: parsedSalary,
        bonus: 0,
        deduction: 0,
        netSalary: parsedSalary,
        paid: false,
        status: 'مستحق'
      };
      setSalaries([...safeSalaries, salaryRecord]);
    }

    const logMessage = `➕ [توظيف جديد]: تم إضافة الموظف ${newName.trim()} برتبة (${newRole}) وتخصيص راتب أساسي بقيمة $${parsedSalary}.`;
    if (typeof setMails === 'function') {
      setMails([...safeMails, logMessage]);
    }
    setLogs([...logs, logMessage]);

    // تفريغ الحقول وإغلاق النافذة
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewAge('');
    setNewNationalId('');
    setNewIdCardImage('');
    setNewBankAccount('');
    setNewImage('');
    setNewSalary('');
    setNewRole('stock');
    setIsAddModalOpen(false);
  };

  // ✏️ وضع التعديل
  const handleStartEdit = (emp) => {
    setSelectedEmployee(emp);
    setEditName(emp.name || '');
    setEditEmail(emp.email || '');
    setEditPhone(emp.phone === 'غير متوفر' ? '' : emp.phone);
    setEditAge(emp.age === 'غير متوفر' ? '' : emp.age);
    setEditNationalId(emp.nationalId === 'غير متوفر' ? '' : emp.nationalId);
    setEditIdCardImage(emp.idCardImage || '');
    setEditBankAccount(emp.bankAccount === 'غير متوفر' ? '' : emp.bankAccount);
    setEditImage(emp.image || '');
    setEditSalary(emp.salary !== undefined ? emp.salary : '');
    setEditRole(emp.role || 'stock');
    setIsEditing(true);
  };

  // 💾 حفظ التعديلات
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      alert('الاسم والبريد الإلكتروني مطلوبان!');
      return;
    }

    const parsedSalary = editSalary !== '' ? parseFloat(editSalary) : 0;

    const updatedEmployees = safeEmployees.map((emp) => {
      if (emp.id === selectedEmployee.id) {
        return {
          ...emp,
          name: editName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim() || 'غير متوفر',
          age: editAge.trim() || 'غير متوفر',
          nationalId: editNationalId.trim() || 'غير متوفر',
          idCardImage: editIdCardImage.trim() || '',
          bankAccount: editBankAccount.trim() || 'غير متوفر',
          image: editImage.trim() || '',
          salary: parsedSalary,
          role: editRole
        };
      }
      return emp;
    });

    setEmployees(updatedEmployees);

    if (typeof setSalaries === 'function') {
      const updatedSalaries = safeSalaries.map((sal) => {
        if (sal.id === selectedEmployee.id || sal.employeeId === selectedEmployee.id) {
          const currentBonus = sal.bonus || 0;
          const currentDeduction = sal.deduction || sal.deductions || 0;
          const finalNet = parsedSalary + currentBonus - currentDeduction;
          return {
            ...sal,
            name: editName.trim(),
            base: parsedSalary,
            salary: parsedSalary,
            monthlySalary: parsedSalary,
            netSalary: finalNet
          };
        }
        return sal;
      });
      setSalaries(updatedSalaries);
    }
    
    const updatedSelected = updatedEmployees.find(emp => emp.id === selectedEmployee.id);
    setSelectedEmployee(updatedSelected);
    setIsEditing(false);

    const logMessage = `✏️ [تعديل بيانات]: تم تحديث معلومات الموظف: ${editName.trim()}`;
    if (typeof setMails === 'function') {
      setMails([...safeMails, logMessage]);
    }
    setLogs([...logs, logMessage]);
  };

  // 🗑️ حذف موظف
  const handleDeleteEmployee = (id, name) => {
    if (!window.confirm(`هل أنت متأكد من حذف الموظف (${name || id}) بشكل نهائي من النظام؟`)) {
      return;
    }

    const updatedEmployees = safeEmployees.filter((e) => e.id !== id);
    setEmployees(updatedEmployees);

    if (typeof setSalaries === 'function') {
      const updatedSalaries = safeSalaries.filter((sal) => sal.id !== id && sal.employeeId !== id);
      setSalaries(updatedSalaries);
    }

    setSelectedEmployee(null);
    setIsEditing(false);

    const logMessage = `❌ [حذف موظف]: تم إزالة الموظف (${name || id}) وسجلاته المالية بنجاح.`;
    if (typeof setMails === 'function') {
      setMails([...safeMails, logMessage]);
    }
    setLogs([...logs, logMessage]);
  };

  const filteredEmployees = safeEmployees.filter((emp) => {
    if (!searchTerm) return true;
    return (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
           (emp.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
           (emp.role || "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة مع شريط البحث وعدد الموظفين */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#facc15', fontSize: '22px', fontWeight: 'bold' }}>
            👥 لوحة إدارة طاقم العمل والموظفين
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة شاملة للموظفين، الرواتب، والبيانات الحقيقية المرتبطة بالنظام.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 ابحث عن اسم الموظف أو البريد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: '#111827', border: '1px solid #334155', padding: '10px 14px', borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', width: '220px' }}
          />

          <div style={{ background: '#1e293b', color: '#facc15', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
            إجمالي الطاقم: {safeEmployees.length}
          </div>
        </div>
      </div>

      {/* شبكة البطاقات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* ➕ بطاقة توظيف موظف جديد */}
        <div
          onClick={() => { setIsAddModalOpen(true); setIsEditing(false); }}
          style={{
            background: '#111827',
            border: '2px dashed #10b981',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
            minHeight: '200px',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.borderColor = '#34d399';
            e.currentTarget.style.background = '#172033';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.background = '#111827';
          }}
        >
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: 'rgba(16, 185, 129, 0.1)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '36px', 
            border: '3px solid #10b981',
            color: '#10b981',
            fontWeight: 'bold'
          }}>
            +
          </div>

          <div>
            <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
              توظيف موظف جديد
            </h4>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold', display: 'inline-block', marginTop: '6px' }}>
              اضغط للإضافة 🚀
            </span>
          </div>
        </div>

        {/* 👤 بطاقات الموظفين الحاليين */}
        {filteredEmployees.map((emp) => (
          <div
            key={emp.id}
            onClick={() => { setSelectedEmployee(emp); setIsEditing(false); }}
            style={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.borderColor = '#38bdf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#1f2937';
            }}
          >
            {emp.image ? (
              <img src={emp.image} alt={emp.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #38bdf8' }} />
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: '3px solid #475569' }}>👤</div>
            )}

            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                {emp.name}
              </h4>
              <span style={{ fontSize: '12px', color: emp.role === 'admin' ? '#f59e0b' : emp.role === 'manager' ? '#38bdf8' : '#10b981', fontWeight: 'bold', background: '#0b0f19', padding: '4px 10px', borderRadius: '20px', border: '1px solid #334155', display: 'inline-block', marginTop: '6px' }}>
                {emp.role === 'admin' ? '👑 مدير عام' : emp.role === 'manager' ? '🛡️ مشرف متجر' : '📦 موظف مخزون'}
              </span>
            </div>

            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>انقر للعرض والتعديل 🔍</span>
          </div>
        ))}
      </div>

      {/* نافذة التوظيف الجديدة */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div style={{ background: '#111827', border: '1px solid #334155', borderRadius: '20px', padding: '30px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }} onClick={(e) => e.stopPropagation()}>
            
            <button onClick={() => setIsAddModalOpen(false)} style={{ position: 'absolute', top: '20px', left: '20px', background: '#1f2937', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            <h3 style={{ margin: '0 0 5px 0', color: '#10b981', fontSize: '18px', fontWeight: 'bold' }}>+ توظيف وإضافة موظف جديد</h3>
            <p style={{ margin: '0 0 15px 0', color: '#94a3b8', fontSize: '12px' }}>قم بتعبئة بيانات الموظف لتتم مزامنتها تلقائياً مع الرواتب وسجلات النظام.</p>

            <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="اسم الموظف... *" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="email" placeholder="البريد الإلكتروني... *" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="text" placeholder="رقم الهاتف..." value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="number" placeholder="العمر..." value={newAge} onChange={(e) => setNewAge(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="number" placeholder="الراتب الشهري $ (اختياري)..." value={newSalary} onChange={(e) => setNewSalary(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="text" placeholder="رقم الهوية الوطنية..." value={newNationalId} onChange={(e) => setNewNationalId(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="text" placeholder="رابط صورة الهوية (اختياري)..." value={newIdCardImage} onChange={(e) => setNewIdCardImage(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="text" placeholder="حساب البنك IBAN (اختياري)..." value={newBankAccount} onChange={(e) => setNewBankAccount(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              <input type="text" placeholder="رابط الصورة الشخصية (اختياري)..." value={newImage} onChange={(e) => setNewImage(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '12px', color: '#facc15' }}>الرتبة والوظيفة:</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #facc15', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }}>
                  <option value="admin">مدير عام (Admin)</option>
                  <option value="manager">مشرف متجر (Manager)</option>
                  <option value="stock">موظف مخزون (Stock)</option>
                </select>
              </div>

              <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}>
                حفظ وتوظيف الموظف 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل وتعديل الموظف */}
      {selectedEmployee && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div style={{ background: '#111827', border: '1px solid #334155', borderRadius: '20px', padding: '30px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }} onClick={(e) => e.stopPropagation()}>
            
            <button onClick={() => { setSelectedEmployee(null); setIsEditing(false); }} style={{ position: 'absolute', top: '20px', left: '20px', background: '#1f2937', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            {!isEditing ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #1f2937', paddingBottom: '15px' }}>
                  {selectedEmployee.image ? (
                    <img src={selectedEmployee.image} alt={selectedEmployee.name} style={{ width: '75px', height: '75px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #38bdf8' }} />
                  ) : (
                    <div style={{ width: '75px', height: '75px', borderRadius: '50%', background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>👤</div>
                  )}
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>{selectedEmployee.name}</h3>
                    <span style={{ fontSize: '12px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>📧 {selectedEmployee.email}</span>
                    <span style={{ fontSize: '11px', color: '#facc15', fontWeight: 'bold' }}>
                      {selectedEmployee.role === 'admin' ? '👑 مدير عام' : selectedEmployee.role === 'manager' ? '🛡️ مشرف متجر' : '📦 موظف مخزون'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#0b0f19', padding: '16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>رقم الهاتف:</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedEmployee.phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>العمر:</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedEmployee.age !== 'غير متوفر' ? `${selectedEmployee.age} سنة` : 'غير متوفر'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>الراتب الشهري:</span>
                    <span style={{ color: '#34d399', fontWeight: 'bold' }}>{selectedEmployee.salary !== undefined && selectedEmployee.salary !== '' ? `${selectedEmployee.salary} $` : 'غير متوفر'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>رقم الهوية الوطنية:</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedEmployee.nationalId}</span>
                  </div>

                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                    <span style={{ color: '#94a3b8', display: 'block', marginBottom: '6px' }}>صورة الهوية الرسمية:</span>
                    {selectedEmployee.idCardImage ? (
                      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155', maxHeight: '160px', background: '#000' }}>
                        <img src={selectedEmployee.idCardImage} alt="صورة الهوية" style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: '150px', display: 'block' }} />
                      </div>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>غير متوفرة</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                    <span>حساب البنك (IBAN):</span>
                    <span style={{ color: '#38bdf8', fontWeight: 'bold', fontFamily: 'monospace' }}>{selectedEmployee.bankAccount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>تاريخ التوظيف:</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedEmployee.hireDate}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleStartEdit(selectedEmployee)}
                    style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                  >
                    تعديل المعلومات ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteEmployee(selectedEmployee.id, selectedEmployee.name)}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                  >
                    حذف 🗑️
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '18px', fontWeight: 'bold' }}>تعديل معلومات الموظف</h3>
                
                <input type="text" placeholder="اسم الموظف..." value={editName} onChange={(e) => setEditName(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="email" placeholder="البريد الإلكتروني..." value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="text" placeholder="رقم الهاتف..." value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="number" placeholder="العمر..." value={editAge} onChange={(e) => setEditAge(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="number" placeholder="الراتب الشهري $ (اختياري)..." value={editSalary} onChange={(e) => setEditSalary(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="text" placeholder="رقم الهوية الوطنية..." value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="text" placeholder="رابط صورة الهوية..." value={editIdCardImage} onChange={(e) => setEditIdCardImage(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="text" placeholder="حساب البنك IBAN..." value={editBankAccount} onChange={(e) => setEditBankAccount(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                <input type="text" placeholder="رابط الصورة الشخصية..." value={editImage} onChange={(e) => setEditImage(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }} />
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12px', color: '#facc15' }}>الرتبة والوظيفة:</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #facc15', padding: '11px', borderRadius: '8px', color: '#fff', fontSize: '13px' }}>
                    <option value="admin">مدير عام (Admin)</option>
                    <option value="manager">مشرف متجر (Manager)</option>
                    <option value="stock">موظف مخزون (Stock)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    حفظ التعديلات ✅
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Employees;