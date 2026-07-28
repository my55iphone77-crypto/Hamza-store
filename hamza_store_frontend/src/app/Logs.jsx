import React from 'react';
import { useApp } from './AppContext'; // 🔗 استيراد السياق المركزي للربط التلقائي

function Logs({ logs: externalLogs, setLogs: externalSetLogs }) {
  // 🔗 جلب البيانات المركزية (السجلات) ودالة التحديث من السياق العام
  const { logs: contextLogs, setLogs: contextSetLogs } = useApp();

  // اعتماد المصادر المركزية كأولوية في حال لم يتم تمريرها عبر الـ props
  const logs = externalLogs !== undefined ? externalLogs : (contextLogs || []);
  const setLogs = externalSetLogs || contextSetLogs;

  // 🧹 دالة لتفريغ السجلات إذا لزم الأمر
  const handleClearLogs = () => {
    if (typeof setLogs === 'function') {
      setLogs([]);
    }
  };

  // 🔍 دالة ذكية لتحويل أي سجل (نصوص، كائنات، أو أحداث معقدة) إلى محتوى نصي ووضعي متكامل
  const renderLogContent = (log) => {
    if (!log) return "حدث غير معروف";
    if (typeof log === 'string') return log;
    if (typeof log === 'object') {
      // استخراج الرسالة الأساسية أو الوصف حسب الهيكل المتاح
      const text = log.action || log.message || log.text || log.description || '';
      const user = log.user || log.userName ? ` (بواسطة: ${log.user || log.userName})` : '';
      const time = log.time || log.timestamp ? ` [${new Date(log.time || log.timestamp).toLocaleTimeString()}]` : '';
      
      if (text) {
        return `${time} ${text}${user}`;
      }
      try {
        return JSON.stringify(log, null, 2);
      } catch (e) {
        return "سجل بتنسيق غير متوافق";
      }
    }
    return String(log);
  };

  // 🎨 دالة لتحديد أيقونة ولون السجل بناءً على محتواه لتجربة مرئية واقعية
  const getLogStyleAndIcon = (log) => {
    const content = typeof log === 'string' ? log : JSON.stringify(log);
    
    if (content.includes('➕') || content.includes('إضافة') || content.includes('توظيف')) {
      return { icon: '🟢', color: '#34d399', bg: '#064e3b' }; // أخضر للإضافات
    }
    if (content.includes('❌') || content.includes('حذف') || content.includes('إزالة')) {
      return { icon: '🔴', color: '#f87171', bg: '#7f1d1d' }; // أحمر للحذف
    }
    if (content.includes('✏️') || content.includes('تعديل') || content.includes('تحديث')) {
      return { icon: '🟡', color: '#facc15', bg: '#78350f' }; // أصفر للتعديلات
    }
    if (content.includes('💰') || content.includes('راتب') || content.includes('مبيعات')) {
      return { icon: '🔵', color: '#38bdf8', bg: '#1e3a8a' }; // أزرق للمعاملات المالية
    }
    return { icon: '📄', color: '#9ca3af', bg: '#111827' }; // افتراضي
  };

  const safeLogs = Array.isArray(logs) ? logs : [];

  return (
    <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', color: '#fff', fontFamily: 'Tajawal, sans-serif', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }} dir="rtl">
      
      {/* رأس قسم السجلات مع زر مسح السجل */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: '0', color: '#f97316', fontSize: '18px', fontWeight: 'bold' }}>
            📜 سجل الأحداث والعمليات الفورية (Logs)
          </h3>
          <span style={{ background: '#0f172a', color: '#f97316', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', border: '1px solid #334155', fontWeight: 'bold' }}>
            {safeLogs.length}
          </span>
        </div>

        {safeLogs.length > 0 && typeof setLogs === 'function' && (
          <button 
            onClick={handleClearLogs}
            style={{ background: '#334155', color: '#cbd5e1', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#475569'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#334155'}
          >
            مسح السجلات 🧹
          </button>
        )}
      </div>
      
      {safeLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
          <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>📭</span>
          <p style={{ margin: '0', fontSize: '13px' }}>لا توجد أحداث أو عمليات مسجلة حتى الآن. ستبدأ الأنشطة بالظهور هنا فوراً عند التفاعل مع النظام.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
          {/* عرض السجلات بحيث يظهر الحدث الأحدث في الأعلى */}
          {[...safeLogs].reverse().map((log, index) => {
            const styleInfo = getLogStyleAndIcon(log);
            return (
              <div 
                key={log && log.id ? log.id : index} 
                style={{ 
                  background: '#0b0f19', 
                  padding: '12px 14px', 
                  borderRadius: '10px', 
                  border: '1px solid #1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                <span style={{ fontSize: '16px' }}>{styleInfo.icon}</span>
                <span style={{ fontSize: '13px', color: '#e2e8f0', wordBreak: 'break-word', lineHeight: '1.5' }}>
                  {renderLogContent(log)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Logs;