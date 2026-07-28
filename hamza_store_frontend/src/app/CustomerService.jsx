import React, { useState } from 'react';
import axios from 'axios';
import { useApp } from './AppContext';

function CustomerService({ 
  requests: externalRequests, 
  setRequests: externalSetRequests = () => {}, 
  mails = [], 
  setMails = () => {}, 
  inputStyle = {},
  customers = [],
  employees = [],
  currentUser = { name: "موظف حالي", role: "موظف" }
}) {
  // 🔗 جلب البيانات وتحديثاتها مباشرة من AppContext للمزامنة المركزية الشاملة
  const { 
    requests: contextRequests = [], 
    setRequests: setContextRequests,
    mails: contextMails = [],
    setMails: setContextMails,
    customers: contextCustomers = [],
    employees: contextEmployees = []
  } = useApp();

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [issue, setIssue] = useState('');
  const [complaintType, setComplaintType] = useState('service'); 
  const [targetEmployee, setTargetEmployee] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackedRequest, setTrackedRequest] = useState(null);

  // دمج البيانات من السياق المركزي أو الخواص الممررة
  const finalRequests = externalRequests !== undefined && externalRequests.length > 0 
    ? externalRequests 
    : (contextRequests.length > 0 ? contextRequests : JSON.parse(localStorage.getItem("customer_requests_data") || '[]'));
  
  const safeCustomers = customers.length > 0 ? customers : (contextCustomers.length > 0 ? contextCustomers : JSON.parse(localStorage.getItem("customers_data") || '[]'));
  const safeEmployees = employees.length > 0 ? employees : (contextEmployees.length > 0 ? contextEmployees : JSON.parse(localStorage.getItem("employees_data") || '[]'));
  const finalMails = contextMails.length > 0 ? contextMails : mails;

  const updateRequests = (newList) => {
    if (externalSetRequests && typeof externalSetRequests === "function") {
      externalSetRequests(newList);
    }
    if (setContextRequests && typeof setContextRequests === "function") {
      setContextRequests(newList);
    }
    localStorage.setItem("customer_requests_data", JSON.stringify(newList));
  };

  const updateGlobalMails = (updater) => {
    if (setMails && typeof setMails === "function") {
      setMails(updater);
    }
    if (setContextMails && typeof setContextMails === "function") {
      setContextMails(updater);
    }
  };

  const sendInternalMail = (to, subject, body) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: currentUser?.name || "نظام خدمة العملاء والشكاوى",
      recipient: to,
      subject,
      body,
      read: false,
      date: new Date().toLocaleString("ar-JO")
    };
    updateGlobalMails(prev => [...(prev || []), mail]);
  };

  const sendExternalMail = async (to, subject, body) => {
    try {
      await axios.post("/api/sendExternalMail", { to, subject, body });
    } catch (err) {
      console.error("Error sending external mail", err);
    }
  };

  const addRequest = (e) => {
    e.preventDefault();
    if (!customerName || !phone || !location || !issue) return;

    const matchedCustomer = safeCustomers.find(c => c.name === customerName || c.phone === phone);
    const customerEmail = matchedCustomer ? matchedCustomer.email : null;

    let targetDestination = "خدمة العملاء";
    if (complaintType === "employee") {
      targetDestination = targetEmployee ? `الموظف: ${targetEmployee}` : "الإدارة";
    } else if (complaintType === "manager_complaint") {
      targetDestination = "المدير العام / الإدارة العليا";
    }

    const newRequest = {
      id: Date.now(),
      customerName,
      phone,
      location,
      issue,
      complaintType,
      target: targetDestination,
      date: new Date().toLocaleString("ar-JO"),
      status: "قيد المراجعة",
      response: ""
    };

    const updatedRequestsList = [...finalRequests, newRequest];
    updateRequests(updatedRequestsList);

    const message = complaintType === 'manager_complaint' 
      ? `🚨 شكوى جديدة موجهة للمدير من الموظف: ${customerName}\nالتفاصيل: ${issue}`
      : `تم تسجيل الطلب/الشكوى بنجاح.\nالنوع: ${complaintType === 'employee' ? 'شكوى على موظف' : 'مشكلة خدمة'}\nالمشكلة: ${issue}\nالوجهة: ${targetDestination}`;
    
    const recipientTarget = complaintType === 'manager_complaint' 
      ? "manager@company.com" 
      : (complaintType === 'employee' ? (targetEmployee || "management") : "customer-service");

    sendInternalMail(recipientTarget, complaintType === 'manager_complaint' ? "🚨 شكوى موظف موجهة للمدير" : "📢 طلب/شكوى جديدة", message);

    if (customerEmail) {
      sendExternalMail(customerEmail, "📋 استلام طلبك", message);
    }

    setCustomerName('');
    setPhone('');
    setLocation('');
    setIssue('');
    setTargetEmployee('');
    setComplaintType('service');
  };

  const updateRequest = (id, newStatus, responseText) => {
    let updatedReqName = "";
    let updatedReqPhone = "";

    const updatedList = finalRequests.map(r => {
      if (r && r.id === id) {
        updatedReqName = r.customerName;
        updatedReqPhone = r.phone;
        return { ...r, status: newStatus, response: responseText };
      }
      return r;
    });

    updateRequests(updatedList);

    const matchedCustomer = safeCustomers.find(c => c.name === updatedReqName || c.phone === updatedReqPhone);
    const notificationMessage = `تم تحديث حالة الطلب/الشكوى إلى: "${newStatus}".\nالرد الرسمي: "${responseText}"`;

    sendInternalMail(updatedReqName || "customer", "🔔 تحديث حالة الطلب", notificationMessage);

    if (matchedCustomer && matchedCustomer.email) {
      sendExternalMail(matchedCustomer.email, "🔔 تحديث جديد بخصوص طلبك", notificationMessage);
    }
  };

  const filteredRequests = finalRequests.filter(r => {
    if (!r) return false;
    const nameMatch = (r.customerName || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const issueMatch = (r.issue || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const locationMatch = (r.location || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    return nameMatch || issueMatch || locationMatch;
  });

  const trackRequestByPhone = () => {
    const found = finalRequests.find(r => r && r.phone === trackPhone);
    setTrackedRequest(found || null);
  };

  const totalRequests = finalRequests.length;
  const pendingRequests = finalRequests.filter(r => r && r.status === "قيد المراجعة").length;
  const completedRequests = finalRequests.filter(r => r && r.status === "تم الرد").length;
  const managerComplaints = finalRequests.filter(r => r && r.complaintType === "manager_complaint").length;

  return (
    <div style={{ background: '#0b0f19', padding: '30px', borderRadius: '20px', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', border: '1px solid #1e293b', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }} dir="rtl">
      
      {/* 🏷️ العنوان الرئيسي والشريط العلوي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1e293b', paddingBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#38bdf8', fontSize: '22px', fontWeight: 'bold' }}>
            🎧 خدمة العملاء وشكاوى الموظفين (المربوطة مركزياً)
          </h2>
          <p style={{ margin: '0', color: '#94a3b8', fontSize: '13px' }}>إدارة بلاغات الزبائن، متابعة تذاكر الدعم، ورفع الشكاوى للإدارة بنظام بطاقات عصري.</p>
        </div>
      </div>

      {/* 📊 بطاقات الإحصائيات السريعة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <div style={{ background: '#111827', padding: '15px', borderRadius: '14px', border: '1px solid #1f2937' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>إجمالي البلاغات</span>
          <h3 style={{ margin: '5px 0 0 0', color: '#38bdf8', fontSize: '20px' }}>{totalRequests}</h3>
        </div>
        <div style={{ background: '#111827', padding: '15px', borderRadius: '14px', border: '1px solid #1f2937' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>قيد المراجعة</span>
          <h3 style={{ margin: '5px 0 0 0', color: '#facc15', fontSize: '20px' }}>{pendingRequests}</h3>
        </div>
        <div style={{ background: '#111827', padding: '15px', borderRadius: '14px', border: '1px solid #1f2937' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>تم الرد والمعالجة</span>
          <h3 style={{ margin: '5px 0 0 0', color: '#10b981', fontSize: '20px' }}>{completedRequests}</h3>
        </div>
        <div style={{ background: '#111827', padding: '15px', borderRadius: '14px', border: '1px solid #1f2937' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>شكاوى الموظفين للمدير</span>
          <h3 style={{ margin: '5px 0 0 0', color: '#c084fc', fontSize: '20px' }}>{managerComplaints}</h3>
        </div>
      </div>

      {/* 🔍 شريط البحث */}
      <div style={{ marginBottom: '25px' }}>
        <input
          type="text"
          placeholder="🔍 ابحث عن طلب عميل، مشكلة، أو شكوى موظف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', background: '#111827', border: '1px solid #334155', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '14px', boxSizing: 'border-box', ...inputStyle }}
        />
      </div>

      {/* ✍️ نموذج تسجيل بلاغ أو شكوى جديدة */}
      <form onSubmit={addRequest} style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h3 style={{ margin: '0', color: '#f59e0b', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📝 تسجيل بلاغ أو شكوى جديدة
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <select value={complaintType} onChange={(e) => setComplaintType(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
            <option value="service">🛠️ مشكلة خدمة (من زبون)</option>
            <option value="employee">👨‍💼 شكوى على موظف زميل</option>
            <option value="manager_complaint">🚨 شكوى / ملاحظة موظف للمدير مباشرة</option>
          </select>

          {safeCustomers.length > 0 && complaintType === 'service' ? (
            <select 
              value={customerName} 
              onChange={(e) => {
                const selected = safeCustomers.find(c => c.name === e.target.value);
                setCustomerName(e.target.value);
                if (selected) setPhone(selected.phone || '');
              }} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}
            >
              <option value="">اختر العميل...</option>
              {safeCustomers.map(c => (
                <option key={c.id} value={c.name}>{c.name} ({c.phone})</option>
              ))}
            </select>
          ) : (
            <input 
              type="text" 
              placeholder={complaintType === 'manager_complaint' ? "اسم الموظف المُرسل للشكوى للمدير..." : "اسم العميل أو المُرسل..."} 
              value={customerName} 
              onChange={(e) => setCustomerName(e.target.value)} 
              style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} 
            />
          )}

          <input type="text" placeholder="رقم الهاتف..." value={phone} onChange={(e) => setPhone(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          <input type="text" placeholder="الموقع / القسم..." value={location} onChange={(e) => setLocation(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
        </div>

        {complaintType === "employee" && (
          safeEmployees.length > 0 ? (
            <select value={targetEmployee} onChange={(e) => setTargetEmployee(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}>
              <option value="">اختر الموظف المعني بالشكوى...</option>
              {safeEmployees.map(emp => (
                <option key={emp.id} value={emp.name}>{emp.name} ({emp.role || 'موظف'})</option>
              ))}
            </select>
          ) : (
            <input type="text" placeholder="اسم الموظف المعني..." value={targetEmployee} onChange={(e) => setTargetEmployee(e.target.value)} style={{ background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }} />
          )
        )}

        <textarea 
          rows="3" 
          placeholder="تفاصيل المشكلة أو الشكوى..." 
          value={issue} 
          onChange={(e) => setIssue(e.target.value)} 
          style={{ background: '#0b0f19', border: '1px solid #334155', padding: '12px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', resize: 'vertical', ...inputStyle }} 
        />

        <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', alignSelf: 'flex-start' }}>
          إرسال البلاغ 🚀
        </button>
      </form>

      {/* 📋 نظام البطاقات لعرض الشكاوى والطلبات */}
      <h3 style={{ color: '#38bdf8', fontSize: '16px', marginBottom: '15px' }}>📋 قائمة الشكاوى والبلاغات النشطة</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {filteredRequests.length === 0 ? (
          <p style={{ color: '#9ca3af', gridColumn: '1 / -1', textAlign: 'center', padding: '30px' }}>لا توجد طلبات أو شكاوى مطابقة</p>
        ) : (
          filteredRequests.map((r, index) => {
            if (!r) return null;
            const isManagerComplaint = r.complaintType === 'manager_complaint';
            const isCompleted = r.status === 'تم الرد';

            return (
              <div 
                key={r.id || index} 
                style={{ 
                  background: '#111827', 
                  padding: '20px', 
                  borderRadius: '16px', 
                  border: isManagerComplaint ? '1.5px solid #a855f7' : '1px solid #1f2937', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  gap: '15px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ 
                      background: isManagerComplaint ? '#581c87' : (r.complaintType === 'employee' ? '#1e3a8a' : '#065f46'), 
                      color: isManagerComplaint ? '#e9d5ff' : (r.complaintType === 'employee' ? '#93c5fd' : '#34d399'), 
                      padding: '3px 10px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      fontWeight: 'bold' 
                    }}>
                      {isManagerComplaint ? '🚨 شكوى للمدير' : (r.complaintType === 'employee' ? '👨‍💼 شكوى موظف' : '🛠️ مشكلة خدمة')}
                    </span>
                    <span style={{ 
                      background: isCompleted ? '#065f46' : '#78350f', 
                      color: isCompleted ? '#34d399' : '#fcd34d', 
                      padding: '3px 8px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      fontWeight: 'bold' 
                    }}>
                      {r.status || 'قيد المراجعة'}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '15px' }}>👤 {r.customerName} <span style={{ color: '#94a3b8', fontSize: '12px' }}>({r.phone})</span></h4>
                  <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '12px' }}>📍 الموقع/القسم: {r.location}</p>
                  <p style={{ margin: '0 0 8px 0', color: '#f1f5f9', fontSize: '13px', background: '#0b0f19', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    💬 <strong>التفاصيل:</strong> {r.issue}
                  </p>
                  <p style={{ margin: '0 0 4px 0', color: '#38bdf8', fontSize: '12px' }}>🎯 الجهة المستهدفة: {r.target}</p>
                  <p style={{ margin: '0', color: '#10b981', fontSize: '12px' }}>💬 الرد: {r.response || "لم يتم الرد بعد"}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid #1f2937' }}>
                  <button 
                    onClick={() => updateRequest(r.id, "قيد المراجعة", "جارٍ متابعة الشكوى من قبل القسم المختص")} 
                    style={{ flex: 1, background: '#facc15', color: '#000', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    قيد المراجعة ⏳
                  </button>
                  <button 
                    onClick={() => updateRequest(r.id, "تم الرد", "تم معالجة الشكوى واتخاذ اللازم بنجاح")} 
                    style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    تم الرد ✅
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 📱 تتبع الطلب برقم الهاتف */}
      <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#f97316', fontSize: '15px' }}>📱 تتبع حالة الطلب أو الشكوى برقم الهاتف</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="أدخل رقم الهاتف للبحث..."
            value={trackPhone}
            onChange={(e) => setTrackPhone(e.target.value)}
            style={{ flex: 1, background: '#0b0f19', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', ...inputStyle }}
          />
          <button onClick={trackRequestByPhone} style={{ background: '#f97316', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            تتبع 🔍
          </button>
        </div>

        {trackedRequest ? (
          <div style={{ marginTop: '15px', background: '#0b0f19', padding: '15px', borderRadius: '12px', border: '1px solid #38bdf8' }}>
            <h5 style={{ margin: '0 0 5px 0', color: '#38bdf8' }}>نتائج التتبع للرقم: {trackedRequest.phone}</h5>
            👤 {trackedRequest.customerName} | 📍 {trackedRequest.location}  
            <br />🛠️ {trackedRequest.issue}  
            <br />⚠️ الحالة: <span style={{ color: '#facc15' }}>{trackedRequest.status}</span>  
            <br />💬 الرد: {trackedRequest.response || "لم يتم الرد بعد"}
          </div>
        ) : trackPhone && (
          <p style={{ marginTop: '10px', color: '#ef4444', fontSize: '13px' }}>❌ لا يوجد طلب أو شكوى مسجلة بهذا الرقم</p>
        )}
      </div>

    </div>
  );
}

export default CustomerService;