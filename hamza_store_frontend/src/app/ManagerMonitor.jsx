import React, { useState } from 'react';
import Logs from './Logs';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js/auto';
import { useApp } from './AppContext'; // 🔗 استيراد السياق المركزي للربط التلقائي

function ManagerMonitor({ requests: externalRequests = [], logs: externalLogs = [], setLogs: externalSetLogs }) {
  // 🔗 جلب البيانات المركزية وتحديثاتها من السياق العام لضمان التزامن الفوري
  const { requests: contextRequests, logs: contextLogs, setLogs: contextSetLogs } = useApp();

  // اعتماد المصادر المركزية كأولوية لضمان التزامن التام
  const requests = externalRequests.length > 0 ? externalRequests : (contextRequests || []);
  const logs = externalLogs.length > 0 ? externalLogs : (contextLogs || []);
  const setLogs = externalSetLogs || contextSetLogs;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const safeRequests = Array.isArray(requests) ? requests : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  // 🗓️ فلترة الطلبات والشكاوى حسب التاريخ بشكل آمن وواقعي
  const filteredRequests = safeRequests.filter(r => {
    if (!r) return false;
    const requestDateStr = r.date || r.timestamp || new Date().toISOString().split('T')[0];
    const requestDate = new Date(requestDateStr);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    return (!start || requestDate >= start) && (!end || requestDate <= end);
  });

  // 📊 تقرير شامل ودقيق بناءً على البيانات الحقيقية المفلترة
  const totalRequests = filteredRequests.length;
  const pendingRequests = filteredRequests.filter(r => r.status === "قيد المراجعة" || r.status === "pending" || !r.status).length;
  const completedRequests = filteredRequests.filter(r => r.status === "تم الرد" || r.status === "completed" || r.response).length;
  const employeeComplaints = filteredRequests.filter(r => r.complaintType === "employee" || r.target === "employee" || r.type === "employee").length;
  const serviceIssues = totalRequests - employeeComplaints;

  // 📈 بيانات الرسوم البيانية المتزامنة لحظياً
  const statusData = {
    labels: ['قيد المراجعة', 'تم الرد والإنجاز'],
    datasets: [
      {
        data: [pendingRequests, completedRequests],
        backgroundColor: ['#facc15', '#10b981'],
        borderWidth: 1
      }
    ]
  };

  const complaintData = {
    labels: ['شكاوى موظفين', 'مشاكل وبلاغات خدمة'],
    datasets: [
      {
        data: [employeeComplaints, serviceIssues >= 0 ? serviceIssues : 0],
        backgroundColor: ['#ef4444', '#3b82f6'],
        borderWidth: 1
      }
    ]
  };

  return (
    <div style={{ background: '#0f172a', padding: '30px', borderRadius: '20px', color: '#fff', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* رأس اللوحة */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#f97316', fontSize: '22px', fontWeight: 'bold' }}>
            📊 لوحة مراقبة المدير والتقارير التنفيذية (Manager Monitor)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>متابعة حالة الطلبات، شكاوى العملاء والموظفين، واستعراض الإحصائيات الحقيقية للنظام.</p>
        </div>
      </div>

      {/* فلترة حسب التاريخ */}
      <div style={{ marginBottom: '25px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#facc15', fontSize: '15px', fontWeight: 'bold' }}>🗓️ تصفية التقارير والطلبات حسب النطاق الزمني</h4>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>من تاريخ:</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: '13px', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>إلى تاريخ:</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155', fontSize: '13px', outline: 'none' }} />
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }} 
              style={{ marginTop: '20px', background: '#334155', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              إعادة ضبط الفلترة ✕
            </button>
          )}
        </div>
      </div>

      {/* تقرير عام ومؤشرات الأداء */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <div style={{ background: '#1e293b', padding: '18px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>📨 إجمالي الطلبات والشكاوى</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>{totalRequests}</span>
        </div>
        <div style={{ background: '#1e293b', padding: '18px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>⌛ الطلبات قيد المراجعة</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#facc15' }}>{pendingRequests}</span>
        </div>
        <div style={{ background: '#1e293b', padding: '18px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>✅ الطلبات والردود المنجزة</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{completedRequests}</span>
        </div>
        <div style={{ background: '#1e293b', padding: '18px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>👨‍💼 الشكاوى المرتبطة بالموظفين</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{employeeComplaints}</span>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#facc15', fontSize: '15px' }}>⚠️ نسبة حالة الطلبات</h4>
          <div style={{ width: '100%', maxWidth: '240px', height: '240px', display: 'flex', justifyContent: 'center' }}>
            <Pie data={statusData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '280px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#facc15', fontSize: '15px' }}>👨‍💼 توزيع أنواع الشكاوى والبلاغات</h4>
          <div style={{ width: '100%', maxWidth: '280px', height: '240px', display: 'flex', justifyContent: 'center' }}>
            <Bar data={complaintData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* قائمة الطلبات والشكاوى */}
      <div style={{ marginBottom: '25px', background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#f97316', fontSize: '16px', fontWeight: 'bold' }}>📋 تفاصيل الطلبات والشكاوى (حسب الفلترة المتاحة)</h4>
        
        {filteredRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>📭</span>
            <p style={{ margin: '0', fontSize: '13px' }}>لا توجد طلبات أو شكاوى مطابقة للنطاق الزمني المحدد.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredRequests.map((r, idx) => (
              <div key={r.id || idx} style={{ background: '#111827', padding: '15px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f2937', paddingBottom: '8px' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>📅 {r.date || r.timestamp || 'تاريخ غير محدد'}</span>
                  <span style={{ background: r.status === 'تم الرد' || r.status === 'completed' ? '#064e3b' : '#78350f', color: r.status === 'تم الرد' || r.status === 'completed' ? '#34d399' : '#facc15', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                    {r.status || 'قيد المراجعة'}
                  </span>
                </div>
                <div>👤 <strong>العميل:</strong> {r.customerName || r.name || 'غير معروف'} (📞 {r.phone || 'غير متوفر'})</div>
                <div>📍 <strong>الموقع/الفرع:</strong> {r.location || 'غير متوفر'}</div>
                <div>🛠️ <strong>المشكلة/البلاغ:</strong> {r.issue || r.description || 'لا يوجد وصف'}</div>
                <div>🎯 <strong>الجهة المستهدفة:</strong> {r.target || 'الإدارة العامة'}</div>
                <div style={{ background: '#0b0f19', padding: '8px 10px', borderRadius: '6px', marginTop: '4px', color: r.response ? '#34d399' : '#94a3b8' }}>
                  💬 <strong>الرد والتعقيب:</strong> {r.response || "لم يتم الرد بعد من قبل الإدارة"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* سجل الأحداث المربوط */}
      <div>
        <Logs logs={safeLogs} setLogs={setLogs} />
      </div>
    </div>
  );
}

export default ManagerMonitor;