import React, { useState } from 'react';
import Logs from './Logs';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js/auto';
import { useApp } from './AppContext'; // 🔗 استيراد السياق المركزي للربط التلقائي

function Performance({ employees: externalEmployees = [], logs: externalLogs = [], setLogs: externalSetLogs }) {
  // 🔗 جلب البيانات المركزية وتحديثاتها من السياق العام لضمان المزامنة الفورية
  const { employees: contextEmployees, logs: contextLogs, setLogs: contextSetLogs } = useApp();

  // اعتماد المصادر المركزية كأولوية لضمان التزامن التام
  const employees = externalEmployees.length > 0 ? externalEmployees : (contextEmployees || []);
  const logs = externalLogs.length > 0 ? externalLogs : (contextLogs || []);
  const setLogs = externalSetLogs || contextSetLogs;

  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const safeEmployees = Array.isArray(employees) ? employees : [];

  // 🗂️ فلترة الموظفين حسب القسم بشكل آمن وواقعي
  const filteredEmployees = selectedDepartment === 'all'
    ? safeEmployees
    : safeEmployees.filter(e => e && (e.department === selectedDepartment || e.role === selectedDepartment));

  // 📊 تجهيز بيانات الأداء للرسم البياني
  const employeeLabels = filteredEmployees.map(e => e ? e.name : '');
  const employeeRequests = filteredEmployees.map(e => e ? (e.handledRequests || e.tasksCompleted || 0) : 0);
  const employeeSuccess = filteredEmployees.map(e => e ? (e.successRate || 100) : 0);
  const employeeResolution = filteredEmployees.map(e => e ? (e.avgResolutionTime || 2) : 0);

  const employeeData = {
    labels: employeeLabels,
    datasets: [
      {
        label: 'عدد الطلبات والمهام المعالجة',
        data: employeeRequests,
        backgroundColor: '#3b82f6',
        borderRadius: 6
      },
      {
        label: 'نسبة النجاح (%)',
        data: employeeSuccess,
        backgroundColor: '#10b981',
        borderRadius: 6
      },
      {
        label: 'متوسط زمن الحل (ساعات)',
        data: employeeResolution,
        backgroundColor: '#facc15',
        borderRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#fff', font: { family: 'Tajawal' } } }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
    }
  };

  // 🏆 ترتيب الموظفين حسب نسبة النجاح أو الإنجازات الحقيقية
  const rankedEmployees = [...filteredEmployees].sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
  const topEmployees = rankedEmployees.slice(0, 3);

  // 🗂️ استخراج الأقسام المتاحة بشكل آمن ومنع التكرار
  const departments = ['all', ...new Set(safeEmployees.map(e => e ? (e.department || e.role) : '').filter(Boolean))];

  return (
    <div style={{ background: '#0f172a', padding: '30px', borderRadius: '20px', color: '#fff', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس الصفحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: '22px', fontWeight: 'bold' }}>
            🏆 لوحة إنجازات وتقييم أداء الموظفين (Performance)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>متابعة معدلات إنجاز المهام، نسب النجاح، وتحديد المتميزين بناءً على بيانات النظام الحية.</p>
        </div>
      </div>

      {/* اختيار القسم */}
      <div style={{ marginBottom: '25px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#facc15', fontSize: '15px', fontWeight: 'bold' }}>🗂️ تصفية الأداء حسب القسم الوظيفي</h4>
        <select 
          value={selectedDepartment} 
          onChange={(e) => setSelectedDepartment(e.target.value)} 
          style={{ padding: '10px 14px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: '13px', outline: 'none', width: '100%', maxWidth: '300px', cursor: 'pointer' }}
        >
          {departments.map((d, i) => (
            <option key={i} value={d}>{d === 'all' ? '🌐 كل الأقسام والخدمات' : d}</option>
          ))}
        </select>
      </div>

      {/* رسم بياني لمقارنة الأداء */}
      <div style={{ marginBottom: '25px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#38bdf8', fontSize: '16px', fontWeight: 'bold' }}>📊 مقارنة الأداء العام بين الموظفين</h4>
        <div style={{ width: '100%', height: '320px' }}>
          {filteredEmployees.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>
              لا توجد بيانات كافية لعرض الرسوم البيانية
            </div>
          ) : (
            <Bar data={employeeData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* قائمة الإنجازات الفردية */}
      <div style={{ marginBottom: '25px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#f97316', fontSize: '16px', fontWeight: 'bold' }}>✅ التفاصيل والإنجازات الفردية للموظفين</h4>
        
        {filteredEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>📭</span>
            <p style={{ margin: '0', fontSize: '13px' }}>لا توجد بيانات مسجلة للموظفين في هذا القسم حالياً.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
            {filteredEmployees.map((e, i) => {
              if (!e) return null;
              return (
                <div key={e.id || i} style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
                    <h5 style={{ margin: '0', color: '#3b82f6', fontSize: '15px', fontWeight: 'bold' }}>👨‍💼 {e.name}</h5>
                    <span style={{ background: '#1e293b', color: '#facc15', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', border: '1px solid #334155' }}>
                      {e.department || e.role || 'عام'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
                    <div>📨 الطلبات والمهام المعالجة: <strong style={{ color: '#fff' }}>{e.handledRequests || e.tasksCompleted || 0}</strong></div>
                    <div>✅ نسبة النجاح والدقة: <strong style={{ color: '#10b981' }}>{e.successRate || 100}%</strong></div>
                    <div>⏱️ متوسط زمن الاستجابة والحل: <strong style={{ color: '#facc15' }}>{e.avgResolutionTime || 2} ساعة</strong></div>
                  </div>
                  
                  <div style={{ marginTop: '6px', background: '#0b0f19', padding: '10px', borderRadius: '8px' }}>
                    <h6 style={{ margin: '0 0 6px 0', color: '#f97316', fontSize: '12px', fontWeight: 'bold' }}>🏅 أبرز الإنجازات والشارات:</h6>
                    {(!e.achievements || e.achievements.length === 0) ? (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>لا توجد إنجازات مسجلة بعد</span>
                    ) : (
                      <ul style={{ margin: '0', paddingRight: '16px', fontSize: '12px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {e.achievements.map((a, j) => (
                          <li key={j}>🌟 {a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* أفضل الموظفين */}
      <div style={{ marginBottom: '25px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>🥇 لوحة الشرف: أفضل 3 موظفين حسب نسبة النجاح</h4>
        
        {topEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: '13px' }}>
            لا توجد بيانات متاحة لتصنيف الأوائل حالياً.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
            {topEmployees.map((e, i) => {
              if (!e) return null;
              const medalColors = ['#f59e0b', '#94a3b8', '#b45309']; // ذهبي، فضي، برونزي
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={e.id || i} style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: `1px solid ${medalColors[i] || '#334155'}`, display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{medals[i] || '🏅'}</span>
                    <div>
                      <h5 style={{ margin: '0', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{e.name}</h5>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{e.department || e.role || 'عام'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '6px', borderTop: '1px solid #1f2937', paddingTop: '8px' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>النجاح: {e.successRate || 100}%</span>
                    <span style={{ color: '#38bdf8' }}>الطلبات: {e.handledRequests || e.tasksCompleted || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* سجل الأحداث والعمليات الفورية */}
      <div>
        <Logs logs={logs} setLogs={setLogs} />
      </div>

    </div>
  );
}

export default Performance;