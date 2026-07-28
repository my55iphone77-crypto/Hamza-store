import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = 'HamzaStoreDB';
const EMPLOYEES_STORE = 'employees_data';
const LOGS_STORE = 'attendance_logs_data';

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject('IndexedDB غير مدعوم في هذا المتصفح');
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(EMPLOYEES_STORE)) {
        db.createObjectStore(EMPLOYEES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LOGS_STORE)) {
        db.createObjectStore(LOGS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const getStoreData = async (storeName) => {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(storeName)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
};

function Attendance({ 
  employees = [], 
  setEmployees = () => {}, 
  inputStyle = {}, 
  mails = [], 
  setMails = () => {} 
}) {
  // 🔗 جلب البيانات المركزية والمحدثة من AppContext
  const { 
    employees: contextEmployees = [], 
    setEmployees: setContextEmployees 
  } = useApp();

  const [internalEmployees, setInternalEmployees] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // دمج البيانات الممررة مع السياق والحالة الداخلية
  const activeEmployees = employees.length > 0 ? employees : (contextEmployees.length > 0 ? contextEmployees : internalEmployees);
  const safeEmployees = activeEmployees.length > 0 ? activeEmployees : JSON.parse(localStorage.getItem('employees_data') || '[]');
  const safeLogs = logs || [];

  const updateEmployees = (newList) => {
    setInternalEmployees(newList);
    if (setEmployees && typeof setEmployees === 'function') {
      setEmployees(newList);
    }
    if (setContextEmployees && typeof setContextEmployees === 'function') {
      setContextEmployees(newList);
    }
  };

  // 1️⃣ قراءة بيانات الموظفين وسجلات الحضور من قاعدة البيانات عند التحميل
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbEmployees = await getStoreData(EMPLOYEES_STORE);
        
        const db = await openDB();
        const txLogs = db.transaction(LOGS_STORE, 'readonly');
        const storeLogs = txLogs.objectStore(LOGS_STORE);
        const reqLogs = storeLogs.get('main_logs');
        
        reqLogs.onsuccess = () => {
          if (reqLogs.result && reqLogs.result.data) {
            setLogs(reqLogs.result.data);
          } else {
            const localLogs = localStorage.getItem('attendance_logs_data');
            if (localLogs) setLogs(JSON.parse(localLogs));
          }
        };

        if (dbEmployees && dbEmployees.length > 0) {
          updateEmployees(dbEmployees);
        } else {
          const localEmp = localStorage.getItem('employees_data');
          if (localEmp) updateEmployees(JSON.parse(localEmp));
        }

      } catch (err) {
        console.warn('استخدام LocalStorage بدلاً من IndexedDB:', err);
        const localEmp = localStorage.getItem('employees_data');
        if (localEmp) updateEmployees(JSON.parse(localEmp));
        const localLogs = localStorage.getItem('attendance_logs_data');
        if (localLogs) setLogs(JSON.parse(localLogs));
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, contextEmployees]);

  // 2️⃣ حفظ البيانات تلقائياً في قاعدة البيانات فور حدوث أي تغيير
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();
        
        // حفظ الموظفين وتحديث حالاتهم
        const txEmp = db.transaction(EMPLOYEES_STORE, 'readwrite');
        const storeEmp = txEmp.objectStore(EMPLOYEES_STORE);
        storeEmp.clear();
        safeEmployees.forEach(emp => storeEmp.put(emp));

        // حفظ سجلات الأحداث
        const txLogs = db.transaction(LOGS_STORE, 'readwrite');
        const storeLogs = txLogs.objectStore(LOGS_STORE);
        storeLogs.put({ id: 'main_logs', data: safeLogs });

        localStorage.setItem('employees_data', JSON.stringify(safeEmployees));
        localStorage.setItem('attendance_logs_data', JSON.stringify(safeLogs));
      } catch (err) {
        localStorage.setItem('employees_data', JSON.stringify(safeEmployees));
        localStorage.setItem('attendance_logs_data', JSON.stringify(safeLogs));
      }
    };

    saveData();
  }, [safeEmployees, safeLogs, isLoaded]);

  // 📨 إرسال بريد داخلي أو إشعار حقيقي مرتبط بالنظام العام
  const sendInternalMail = (to, subject, body) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: "Attendance System",
      recipient: to,
      subject,
      body,
      read: false
    };
    if (setMails) setMails(prev => [...(prev || []), mail]);
  };

  // 🟢 تسجيل حضور ببيانات حقيقية وترابط شامل
  const handleCheckIn = (emp) => {
    if (!emp) return;
    const checkInTime = new Date().toLocaleString("ar-JO");
    const updatedEmployees = safeEmployees.map((e) =>
      e && e.id === emp.id
        ? { ...e, status: "حاضر", checkIn: checkInTime }
        : e
    );
    updateEmployees(updatedEmployees);
    
    const logMessage = `🟢 ${emp.name || 'موظف'} سجّل حضور في ${checkInTime}`;
    setLogs([...safeLogs, logMessage]);

    // إرسال إشعار للمدير أو للنظام المالي والتحليلات
    sendInternalMail("manager@company.com", "🟢 تسجيل حضور موظف", `تم تسجيل حضور الموظف ${emp.name} بنجاح في الساعة ${checkInTime}`);
  };

  // 🔴 تسجيل انصراف ببيانات حقيقية وترابط شامل
  const handleCheckOut = (emp) => {
    if (!emp) return;
    const checkOutTime = new Date().toLocaleString("ar-JO");
    const updatedEmployees = safeEmployees.map((e) =>
      e && e.id === emp.id
        ? { ...e, status: "غادر", checkOut: checkOutTime }
        : e
    );
    updateEmployees(updatedEmployees);
    
    const logMessage = `🔴 ${emp.name || 'موظف'} سجّل انصراف في ${checkOutTime}`;
    setLogs([...safeLogs, logMessage]);

    // إرسال إشعار للمدير أو للنظام المالي والتحليلات
    sendInternalMail("manager@company.com", "🔴 تسجيل انصراف موظف", `تم تسجيل انصراف الموظف ${emp.name} في الساعة ${checkOutTime}`);
  };

  // 📊 إحصائيات عامة
  const totalEmployees = safeEmployees.length;
  const presentCount = safeEmployees.filter((e) => e && e.status === "حاضر").length;
  const leftCount = safeEmployees.filter((e) => e && e.status === "غادر").length;

  // 📤 تصدير CSV
  const exportCSV = () => {
    const header = "ID,Name,Status,CheckIn,CheckOut\n";
    const rows = safeEmployees
      .filter(e => e)
      .map(
        (e) =>
          `${e.id},${e.name || ''},${e.status || ""},${e.checkIn || ""},${
            e.checkOut || ""
          }`
      )
      .join("\n");
    const blob = new Blob([header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "attendance_log.csv";
    link.click();
  };

  // 📄 تصدير PDF
  const exportPDF = () => {
    const printContent = safeEmployees
      .filter(e => e)
      .map(
        (e) =>
          `👤 ${e.name || ''} | 📌 ${e.status || "غير محدد"} | 🟢 دخول: ${
            e.checkIn || "-"
          } | 🔴 خروج: ${e.checkOut || "-"}`
      )
      .join("\n");
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write("<pre>" + printContent + "</pre>");
      newWindow.print();
    }
  };

  return (
    <div
      style={{
        background: "#1e293b",
        padding: "20px",
        borderRadius: "12px",
        color: "#fff",
      }}
      dir="rtl"
    >
      <h3 style={{ marginBottom: "15px", color: "#10b981" }}>
        📋 سجل الحضور والدوام (Attendance - مرتبط تلقائياً)
      </h3>

      {/* قائمة الموظفين */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {safeEmployees.length === 0 ? (
          <p style={{ color: "#9ca3af", textAlign: "center", padding: "10px" }}>لا توجد بيانات للموظفين</p>
        ) : (
          safeEmployees.map((emp, index) => {
            if (!emp) return null;
            return (
              <div
                key={emp.id || index}
                style={{
                  background: "#111827",
                  padding: "12px",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  border: "1px solid #334155"
                }}
              >
                <div>
                  <p style={{ margin: '0 0 5px 0' }}>👤 الاسم: <strong style={{ color: '#38bdf8' }}>{emp.name || "غير محدد"}</strong></p>
                  <p style={{ margin: '0 0 5px 0' }}>📌 الحالة: <span style={{ color: emp.status === 'حاضر' ? '#10b981' : emp.status === 'غادر' ? '#ef4444' : '#facc15' }}>{emp.status || "غير محدد"}</span></p>
                  {emp.checkIn && <p style={{ margin: '0 0 3px 0', fontSize: '13px', color: '#94a3b8' }}>🟢 دخول: {emp.checkIn}</p>}
                  {emp.checkOut && <p style={{ margin: '0', fontSize: '13px', color: '#94a3b8' }}>🔴 خروج: {emp.checkOut}</p>}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleCheckIn(emp)}
                    style={{
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    🟢 تسجيل حضور
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCheckOut(emp)}
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    🔴 تسجيل انصراف
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 📊 إحصائيات */}
      <div
        style={{
          marginTop: "20px",
          background: "#0f172a",
          padding: "15px",
          borderRadius: "8px",
          border: "1px solid #334155"
        }}
      >
        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8' }}>📈 إحصائيات الحضور</h4>
        <p style={{ margin: '5px 0' }}>👥 عدد الموظفين الكلي: {totalEmployees}</p>
        <p style={{ margin: '5px 0', color: '#10b981' }}>🟢 الحاضرين: {presentCount}</p>
        <p style={{ margin: '5px 0', color: '#ef4444' }}>🔴 المغادرين: {leftCount}</p>
      </div>

      {/* 📜 سجل الأحداث */}
      <div
        style={{
          marginTop: "20px",
          background: "#111827",
          padding: "15px",
          borderRadius: "8px",
          border: "1px solid #334155"
        }}
      >
        <h4 style={{ margin: '0 0 10px 0', color: '#facc15' }}>📜 سجل الأحداث والنشاطات</h4>
        {safeLogs.length === 0 ? (
          <p style={{ color: "#9ca3af", margin: 0 }}>⚠️ لا يوجد أحداث مسجلة</p>
        ) : (
          <ul style={{ margin: 0, paddingRight: '20px', color: '#cbd5e1' }}>
            {safeLogs.map((log, i) => (
              <li key={i} style={{ marginBottom: '5px' }}>{log}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 📤 أزرار التصدير */}
      <div
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={exportCSV}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          📤 تصدير CSV
        </button>

        <button
          type="button"
          onClick={exportPDF}
          style={{
            background: "#f97316",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          📄 تصدير PDF
        </button>
      </div>
    </div>
  );
}

export default Attendance;