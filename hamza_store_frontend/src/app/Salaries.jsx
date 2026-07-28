import React, { useState } from 'react';
import { useSyncedState } from './useSyncedState.jsx';

function Salaries({ mails, setMails }) {
  // 🔗 كل هاي الحالات متزامنة تلقائياً عبر useSyncedState
  const [employees, setEmployees] = useSyncedState('store_employees', []);
  const [salaries, setSalaries] = useSyncedState('store_salaries', []);
  const [trashSalaries, setTrashSalaries] = useSyncedState('store_salaries_trash', []);

  const [searchTerm, setSearchTerm] = useState('');

  // نافذة إضافة موظف جديد
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpSalary, setNewEmpSalary] = useState('');
  const [newEmpImage, setNewEmpImage] = useState('');

  // نافذة تعديل الراتب
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBase, setEditBase] = useState('');
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [deductionAmt, setDeductionAmt] = useState('');
  const [deductionRes, setDeductionRes] = useState('');
  const [bonusAmt, setBonusAmt] = useState('');
  const [bonusRes, setBonusRes] = useState('');

  // سلة المهملات
  const [showTrashModal, setShowTrashModal] = useState(false);

  const inputStyle = { outline: 'none' };

  // 📅 الشهر الحالي لمنع تكرار الصرف
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 📢 تسجيل حدث بالسجلات
  const logEvent = (text) => {
    if (typeof setMails === 'function') {
      const currentMails = Array.isArray(mails) ? mails : [];
      setMails([text, ...currentMails]);
    }
  };

  // ➕ إضافة موظف جديد
  const handleAddEmployeeSubmit = (e) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    const baseVal = parseFloat(newEmpSalary) || 500;
    const newId = Date.now() + Math.random();

    const newSalaryRecord = {
      id: newId,
      name: newEmpName.trim(),
      image: newEmpImage.trim(),
      base: baseVal,
      netSalary: baseVal,
      paid: false,
      status: 'مستحق',
      deduction: 0,
      deductionReason: '',
      bonus: 0,
      bonusReason: '',
      lastPaidMonth: ''
    };

    setSalaries(prev => [...prev, newSalaryRecord]);
    setEmployees(prev => [
      ...prev,
      { id: newId, name: newSalaryRecord.name, salary: baseVal, image: newSalaryRecord.image }
    ]);

    logEvent(`➕ تم إضافة الموظف الجديد (${newSalaryRecord.name}) براتب أساسي $${baseVal}.`);

    setNewEmpName('');
    setNewEmpSalary('');
    setNewEmpImage('');
    setShowAddModal(false);
  };

  // ✏️ تعديل بيانات وراتب موظف
  const handleEditEmployeeSubmit = (e) => {
    e.preventDefault();
    if (!selectedSalary) return;

    const baseVal = parseFloat(editBase) || 0;
    const dedVal = parseFloat(deductionAmt) || 0;
    const bonVal = parseFloat(bonusAmt) || 0;
    const netVal = baseVal + bonVal - dedVal;
    const currentEmpName = selectedSalary.name.trim();

    setSalaries(prev => prev.map(s => (
      s.id === selectedSalary.id
        ? {
            ...s,
            name: currentEmpName,
            base: baseVal,
            deduction: dedVal,
            deductionReason: deductionRes,
            bonus: bonVal,
            bonusReason: bonusRes,
            netSalary: netVal
          }
        : s
    )));

    setEmployees(prev => prev.map(emp => (
      emp.id === selectedSalary.id
        ? { ...emp, name: currentEmpName, salary: baseVal }
        : emp
    )));

    logEvent(`⚙️ تم تحديث تفاصيل راتب الموظف (${currentEmpName}): الأساسي $${baseVal}، الصافي $${netVal}`);

    setSelectedSalary(null);
    setShowEditModal(false);
  };

  // 🔄 تبديل حالة صرف الراتب
  const togglePaid = (id) => {
    const targetEmp = salaries.find(s => s.id === id);
    if (!targetEmp) return;

    const isCurrentlyPaid = targetEmp.paid || targetEmp.status === 'مدفوع';

    if (!isCurrentlyPaid && targetEmp.lastPaidMonth === currentMonthYear) {
      alert('⚠️ لقد تم تسديد راتب هذا الموظف مسبقاً خلال الشهر الحالي ولا يمكن التكرار إلا في الشهر القادم.');
      return;
    }

    const newPaidStatus = !isCurrentlyPaid;

    setSalaries(prev => prev.map(s => (
      s.id === id
        ? {
            ...s,
            paid: newPaidStatus,
            status: newPaidStatus ? 'مدفوع' : 'مستحق',
            lastPaidMonth: newPaidStatus ? currentMonthYear : s.lastPaidMonth
          }
        : s
    )));

    if (selectedSalary && selectedSalary.id === id) {
      setSelectedSalary(prev => ({
        ...prev,
        paid: newPaidStatus,
        status: newPaidStatus ? 'مدفوع' : 'مستحق',
        lastPaidMonth: newPaidStatus ? currentMonthYear : prev.lastPaidMonth
      }));
    }

    logEvent(
      newPaidStatus
        ? `💵 تم صرف راتب الموظف (${targetEmp.name}) بنجاح لشهر ${currentMonthYear}.`
        : `↩️ تم تغيير حالة صرف راتب الموظف (${targetEmp.name}) إلى مستحق.`
    );
  };

  // 🗑️ نقل سجل إلى سلة المهملات
  const moveToTrash = (id, e) => {
    if (e) e.stopPropagation();
    const itemToDelete = salaries.find(s => s.id === id);
    if (!itemToDelete) return;

    if (!window.confirm(`هل أنت متأكد من نقل سجل الموظف (${itemToDelete.name}) إلى سلة المهملات؟`)) {
      return;
    }

    setSalaries(prev => prev.filter(s => s.id !== id));
    setTrashSalaries(prev => [...prev, itemToDelete]);

    if (selectedSalary && selectedSalary.id === id) {
      setSelectedSalary(null);
      setShowEditModal(false);
    }

    logEvent(`🗑️ تم نقل سجل الموظف (${itemToDelete.name}) إلى سلة المهملات.`);
  };

  // ♻️ استعادة من سلة المهملات
  const restoreFromTrash = (id) => {
    const itemToRestore = trashSalaries.find(s => s.id === id);
    if (!itemToRestore) return;

    setTrashSalaries(prev => prev.filter(s => s.id !== id));
    setSalaries(prev => [...prev, itemToRestore]);

    logEvent(`♻️ تم استعادة سجل الموظف (${itemToRestore.name}) من سلة المهملات.`);
  };

  // 🔍 فتح نافذة التعديل
  const handleCardClick = (s) => {
    setSelectedSalary(s);
    setEditBase(s.base ?? s.salary ?? 500);
    setIsEditingBase(false);
    setDeductionAmt(s.deduction ?? '');
    setDeductionRes(s.deductionReason || '');
    setBonusAmt(s.bonus ?? '');
    setBonusRes(s.bonusReason || '');
    setShowEditModal(true);
  };

  const filteredSalaries = salaries.filter(s =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalNet = salaries.reduce((acc, s) => {
    const b = s.base ?? s.salary ?? 0;
    const n = s.netSalary ?? b;
    return acc + n;
  }, 0);

  const paidCount = salaries.filter(s => s.paid || s.status === 'مدفوع').length;

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">

      {/* رأس الصفحة والشريط العلوي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#22c55e', fontSize: '22px', fontWeight: 'bold' }}>
            💵 إدارة الرواتب والمدفوعات (مرتبط تلقائياً بالنظام)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة شاملة للموظفين، الرواتب، تتبع الصرف الشهري، الخصومات والمكافآت.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 ابحث عن موظف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: '#111827', border: '1px solid #334155', padding: '10px 14px', borderRadius: '12px', color: '#fff', fontSize: '13px', width: '190px', ...inputStyle }}
          />

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{ background: '#22c55e', border: 'none', color: '#0b0f19', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.3)' }}
          >
            ➕ إضافة موظف جديد
          </button>

          <div style={{ background: '#1e293b', color: '#22c55e', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', border: '1px solid #334155', fontWeight: 'bold' }}>
            إجمالي السجلات: {salaries.length}
          </div>

          <button
            type="button"
            onClick={() => setShowTrashModal(true)}
            style={{ background: '#1f2937', border: '1px solid #374151', color: '#f87171', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🗑️ سلة المهملات ({trashSalaries.length})
          </button>
        </div>
      </div>

      {/* لوحة المؤشرات السريعة */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', background: '#111827', border: '1px solid #1f2937', padding: '15px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>إجمالي صافي الرواتب المطلوب</span>
          <span style={{ color: '#38bdf8', fontSize: '18px', fontWeight: 'bold' }}>{totalNet} $</span>
        </div>
        <div style={{ flex: 1, minWidth: '200px', background: '#111827', border: '1px solid #1f2937', padding: '15px', borderRadius: '14px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>تم تسديد رواتبهم هذا الشهر</span>
          <span style={{ color: '#34d399', fontSize: '18px', fontWeight: 'bold' }}>{paidCount} من {salaries.length}</span>
        </div>
      </div>

      {/* عرض البطاقات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
        {filteredSalaries.map((s) => {
          const baseVal = s.base ?? 500;
          const netVal = s.netSalary ?? baseVal;
          const isPaid = s.paid || s.status === 'مدفوع';

          const currentEmp = employees.find(emp => emp.id === s.id) || {};
          const displayName = currentEmp.name || s.name || 'موظف';
          const displayImage = currentEmp.image || s.image;

          return (
            <div
              key={s.id}
              onClick={() => handleCardClick(s)}
              style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)', position: 'relative', gap: '10px' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#22c55e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#1f2937'; }}
            >
              <button
                type="button"
                title="نقل إلى سلة المهملات"
                onClick={(e) => moveToTrash(s.id, e)}
                style={{ position: 'absolute', top: '12px', left: '12px', background: '#1f2937', border: 'none', color: '#ef4444', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
              >
                🗑️
              </button>

              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1f2937', border: '3px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {displayImage ? (
                  <img src={displayImage} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '32px' }}>👤</span>
                )}
              </div>

              <h4 style={{ color: '#fff', fontSize: '16px', margin: '0 0 2px 0', fontWeight: 'bold' }}>{displayName}</h4>

              <span style={{ color: '#34d399', fontSize: '13px', fontWeight: 'bold' }}>الصافي: {netVal} $</span>

              <div style={{ background: '#0b0f19', border: '1px solid #334155', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: isPaid ? '#34d399' : '#facc15', fontWeight: 'bold', marginTop: '2px' }}>
                {isPaid ? '✅ تم التسديد شهرياً' : '⏳ مستحق الصرف'}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', width: '100%' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleCardClick(s); }}
                  style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '6px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  تعديل ✏️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* نافذة إضافة موظف جديد */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box' }}>
          <div
            style={{ background: '#111827', border: '1px solid #334155', borderRadius: '20px', width: '100%', maxWidth: '450px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', position: 'relative', color: '#fff', display: 'flex', flexDirection: 'column', gap: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', top: '20px', left: '20px', background: '#1f2937', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>

            <div>
              <h3 style={{ color: '#22c55e', margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>➕ إضافة موظف جديد للنظام</h3>
              <p style={{ margin: '0', color: '#94a3b8', fontSize: '12px' }}>سيتم إنشاء سجل راتب تلقائي وربطه بقسم إدارة الموظفين بالكامل.</p>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>اسم الموظف</label>
                <input
                  type="text"
                  placeholder="أدخل اسم الموظف..."
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%', boxSizing: 'border-box', ...inputStyle }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>الراتب الأساسي ($)</label>
                <input
                  type="number"
                  placeholder="500"
                  value={newEmpSalary}
                  onChange={(e) => setNewEmpSalary(e.target.value)}
                  style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%', boxSizing: 'border-box', ...inputStyle }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>رابط الصورة الشخصية (اختياري)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newEmpImage}
                  onChange={(e) => setNewEmpImage(e.target.value)}
                  style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%', boxSizing: 'border-box', ...inputStyle }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, background: '#374151', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ flex: 2, background: '#22c55e', color: '#0b0f19', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  حفظ وإضافة ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل الراتب */}
      {showEditModal && selectedSalary && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div
            style={{ background: '#111827', border: '1px solid #334155', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', position: 'relative', color: '#fff', display: 'flex', flexDirection: 'column', gap: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setSelectedSalary(null); setShowEditModal(false); }}
              style={{ position: 'absolute', top: '20px', left: '20px', background: '#1f2937', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>

            <div>
              <h3 style={{ color: '#22c55e', margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>⚙️ تعديل بيانات وراتب: {selectedSalary.name || ''}</h3>
              <p style={{ margin: '0', color: '#94a3b8', fontSize: '12px' }}>إدارة وتعديل الاسم، الراتب الأساسي، المكافآت، الخصومات وتسجيل الصرف الشهري.</p>
            </div>

            <form onSubmit={handleEditEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

              <div style={{ background: '#0b0f19', padding: '14px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px' }}>اسم الموظف</label>
                <input
                  type="text"
                  value={selectedSalary.name || ''}
                  onChange={(e) => setSelectedSalary({ ...selectedSalary, name: e.target.value })}
                  style={{ background: '#111827', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', width: '100%', boxSizing: 'border-box', ...inputStyle }}
                />
              </div>

              <div style={{ background: '#0b0f19', padding: '14px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8' }}>الراتب الأساسي</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingBase(!isEditingBase)}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    {isEditingBase ? 'إلغاء' : 'تعديل ✏️'}
                  </button>
                </div>
                {isEditingBase ? (
                  <input
                    type="number"
                    value={editBase}
                    onChange={(e) => setEditBase(e.target.value)}
                    style={{ background: '#111827', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', width: '100%', boxSizing: 'border-box', ...inputStyle }}
                  />
                ) : (
                  <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0', color: '#fff' }}>{editBase !== '' ? `${editBase} $` : '0 $'}</p>
                )}
              </div>

              <div style={{ background: '#0b0f19', padding: '14px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444', display: 'block', marginBottom: '8px' }}>الخصومات</span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    placeholder="المبلغ..."
                    value={deductionAmt}
                    onChange={(e) => setDeductionAmt(e.target.value)}
                    style={{ background: '#111827', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', flex: 1, minWidth: '100px', ...inputStyle }}
                  />
                  <input
                    type="text"
                    placeholder="السبب..."
                    value={deductionRes}
                    onChange={(e) => setDeductionRes(e.target.value)}
                    style={{ background: '#111827', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', flex: 2, minWidth: '130px', ...inputStyle }}
                  />
                </div>
              </div>

              <div style={{ background: '#0b0f19', padding: '14px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#34d399', display: 'block', marginBottom: '8px' }}>المكافآت</span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    placeholder="المبلغ..."
                    value={bonusAmt}
                    onChange={(e) => setBonusAmt(e.target.value)}
                    style={{ background: '#111827', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', flex: 1, minWidth: '100px', ...inputStyle }}
                  />
                  <input
                    type="text"
                    placeholder="السبب..."
                    value={bonusRes}
                    onChange={(e) => setBonusRes(e.target.value)}
                    style={{ background: '#111827', border: '1px solid #334155', padding: '10px', borderRadius: '8px', color: '#fff', flex: 2, minWidth: '130px', ...inputStyle }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexDirection: 'row', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => togglePaid(selectedSalary.id)}
                  style={{
                    flex: 1,
                    minWidth: '130px',
                    background: (selectedSalary.paid || selectedSalary.status === 'مدفوع') ? '#facc15' : '#2563eb',
                    color: (selectedSalary.paid || selectedSalary.status === 'مدفوع') ? '#111827' : '#fff',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {(selectedSalary.paid || selectedSalary.status === 'مدفوع') ? 'إلغاء التسديد ↩️' : 'تسديد الراتب 💵'}
                </button>

                <button
                  type="submit"
                  style={{ flex: 2, minWidth: '140px', background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  حفظ التغييرات ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة سلة المهملات */}
      {showTrashModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ background: '#111827', border: '1px solid #334155', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', position: 'relative', color: '#fff', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <button
              type="button"
              onClick={() => setShowTrashModal(false)}
              style={{ position: 'absolute', top: '20px', left: '20px', background: '#1f2937', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>

            <div>
              <h3 style={{ color: '#ef4444', margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>🗑️ سلة مهملات الرواتب</h3>
              <p style={{ margin: '0', color: '#94a3b8', fontSize: '12px' }}>استعادة السجلات المحذوفة إلى القائمة الرئيسية عند الحاجة.</p>
            </div>

            {trashSalaries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }}>📭</span>
                سلة المهملات فارغة.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                {trashSalaries.map((ts) => (
                  <div key={ts.id} style={{ background: '#0b0f19', border: '1px solid #1e293b', padding: '12px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#fff' }}>{ts.name || 'موظف محذوف'}</h4>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>الصافي السابق: {ts.netSalary ?? ts.base ?? 0} $</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => restoreFromTrash(ts.id)}
                      style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      استعادة ♻️
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowTrashModal(false)}
              style={{ width: '100%', background: '#374151', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Salaries;