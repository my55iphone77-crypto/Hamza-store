import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';

// 🛠️ دالة مخصصة لإدارة التخزين الفائق (IndexedDB / LocalStorage Fallback)
const DB_NAME = 'HamzaStoreDB';
const COMMISSIONS_STORE = 'commissions_data';
const LOGS_STORE = 'commissions_logs_data';

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject('IndexedDB غير مدعوم في هذا المتصفح');
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(COMMISSIONS_STORE)) {
        db.createObjectStore(COMMISSIONS_STORE, { keyPath: 'id' });
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

function Commissions({ 
  commissions: externalCommissions, 
  setCommissions: externalSetCommissions = () => {}, 
  inputStyle = {},
  employees = [],
  setMails = () => {}
}) {
  // 🔗 جلب البيانات وتحديثاتها مباشرة من AppContext لضمان المزامنة الفورية
  const { 
    commissions: contextCommissions = [], 
    setCommissions: setContextCommissions,
    employees: contextEmployees = []
  } = useApp();

  const [internalCommissions, setInternalCommissions] = useState([]);
  const [localEmployees, setLocalEmployees] = useState([]);
  const [amount, setAmount] = useState("");
  const [employee, setEmployee] = useState("");
  const [logs, setLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // دمج الموظفين من السياق أو الخواص أو التخزين المحلي
  const activeEmployees = employees.length > 0 
    ? employees 
    : (contextEmployees.length > 0 
        ? contextEmployees 
        : (localEmployees.length > 0 ? localEmployees : JSON.parse(localStorage.getItem('employees_data') || '[]')));

  // دمج العمولات من السياق أو الخواص أو التخزين الداخلي
  const rawCommissions = externalCommissions !== undefined && externalCommissions.length > 0 
    ? externalCommissions 
    : (contextCommissions.length > 0 ? contextCommissions : internalCommissions);
  
  const safeCommissions = rawCommissions.length > 0 ? rawCommissions : JSON.parse(localStorage.getItem('commissions_data') || '[]');
  const safeLogs = logs || [];

  const updateCommissions = (newList) => {
    setInternalCommissions(newList);
    if (externalSetCommissions && typeof externalSetCommissions === 'function') {
      externalSetCommissions(newList);
    }
    if (setContextCommissions && typeof setContextCommissions === 'function') {
      setContextCommissions(newList);
    }
  };

  // 1️⃣ استرجاع العمولات وسجل الأحداث والبيانات من قاعدة البيانات عند فتح الصفحة
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbCommissions = await getStoreData(COMMISSIONS_STORE);
        const dbEmployees = await getStoreData('employees_data');
        
        const db = await openDB();
        const txLogs = db.transaction(LOGS_STORE, 'readonly');
        const storeLogs = txLogs.objectStore(LOGS_STORE);
        const reqLogs = storeLogs.get('main_commissions_logs');
        
        reqLogs.onsuccess = () => {
          if (reqLogs.result && reqLogs.result.data) {
            setLogs(reqLogs.result.data);
          } else {
            const localLogs = localStorage.getItem('commissions_logs_data');
            if (localLogs) setLogs(JSON.parse(localLogs));
          }
        };

        if (dbCommissions && dbCommissions.length > 0) {
          updateCommissions(dbCommissions);
        } else {
          const localComm = localStorage.getItem('commissions_data');
          if (localComm) updateCommissions(JSON.parse(localComm));
        }

        setLocalEmployees(dbEmployees);

      } catch (err) {
        console.warn('استخدام LocalStorage بدلاً من IndexedDB:', err);
        const localComm = localStorage.getItem('commissions_data');
        if (localComm) updateCommissions(JSON.parse(localComm));
        const localLogs = localStorage.getItem('commissions_logs_data');
        if (localLogs) setLogs(JSON.parse(localLogs));
      } finally {
        setIsLoaded(true);
      }
    };

    if (!isLoaded) {
      loadData();
    }
  }, [isLoaded, contextCommissions]);

  // 2️⃣ حفظ البيانات تلقائياً في IndexedDB و LocalStorage فور حدوث أي تحديث
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      try {
        const db = await openDB();

        // حفظ العمولات
        const txComm = db.transaction(COMMISSIONS_STORE, 'readwrite');
        const storeComm = txComm.objectStore(COMMISSIONS_STORE);
        storeComm.clear();
        safeCommissions.forEach(c => storeComm.put(c));

        // حفظ سجل الأحداث
        const txLogs = db.transaction(LOGS_STORE, 'readwrite');
        const storeLogs = txLogs.objectStore(LOGS_STORE);
        storeLogs.put({ id: 'main_commissions_logs', data: safeLogs });

        localStorage.setItem('commissions_data', JSON.stringify(safeCommissions));
        localStorage.setItem('commissions_logs_data', JSON.stringify(safeLogs));
      } catch (err) {
        localStorage.setItem('commissions_data', JSON.stringify(safeCommissions));
        localStorage.setItem('commissions_logs_data', JSON.stringify(safeLogs));
      }
    };

    saveData();
  }, [safeCommissions, safeLogs, isLoaded]);

  // 📨 إرسال إشعار داخلي حقيقي عند إضافة عمولة
  const sendInternalMail = (to, subject, body) => {
    const mail = {
      id: Date.now() + Math.random(),
      sender: "Commissions System",
      recipient: to,
      subject,
      body,
      read: false
    };
    if (setMails && typeof setMails === 'function') {
      setMails(prev => [...(prev || []), mail]);
    }
  };

  // ➕ إضافة عمولة جديدة
  const addCommission = (e) => {
    e.preventDefault();
    if (!amount || !employee) return;

    const newCommission = {
      id: Date.now(),
      employee,
      amount: parseFloat(amount),
      date: new Date().toLocaleString("ar-JO"),
    };

    updateCommissions([...safeCommissions, newCommission]);
    const logMsg = `💰 تمت إضافة عمولة ${amount} للموظف ${employee} بتاريخ ${newCommission.date}`;
    setLogs([...safeLogs, logMsg]);

    // إرسال إشعار حقيقي للمدير أو المحاسبة
    sendInternalMail("manager@company.com", "💰 عمولة جديدة للموظف", `تم تسجيل عمولة بقيمة ${amount} دينار للموظف ${employee}`);

    setAmount("");
    setEmployee("");
  };

  // 📊 حساب الإجمالي
  const totalCommissions = safeCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);

  // 📤 تصدير CSV
  const exportCSV = () => {
    const header = "ID,Employee,Amount,Date\n";
    const rows = safeCommissions
      .filter(c => c)
      .map((c) => `${c.id},${c.employee || ''},${c.amount || 0},${c.date || ''}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "commissions.csv";
    link.click();
  };

  // 📄 تصدير PDF
  const exportPDF = () => {
    const printContent = safeCommissions
      .filter(c => c)
      .map((c) => `👤 ${c.employee || ''} | 💰 ${c.amount || 0} | 📅 ${c.date || ''}`)
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
      <h3 style={{ marginBottom: "15px", color: "#f97316" }}>💰 إدارة العمولات (Commissions - مرتبطة تلقائياً)</h3>

      {/* نموذج إضافة عمولة */}
      <form
        onSubmit={addCommission}
        style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}
      >
        <select
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
        >
          <option value="">اختر الموظف...</option>
          {activeEmployees.map((emp, idx) => (
            <option key={emp.id || idx} value={emp.name}>
              {emp.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="قيمة العمولة"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
        />
        <button
          type="submit"
          style={{
            background: "#f97316",
            color: "#fff",
            border: "none",
            padding: "10px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ➕ إضافة
        </button>
      </form>

      {/* قائمة العمولات */}
      <div style={{ background: "#111827", padding: "15px", borderRadius: "8px", border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8' }}>📋 قائمة العمولات</h4>
        {safeCommissions.length === 0 ? (
          <p style={{ color: "#9ca3af", margin: 0 }}>⚠️ لا يوجد عمولات مسجلة</p>
        ) : (
          <ul style={{ margin: 0, paddingRight: '20px', color: '#cbd5e1' }}>
            {safeCommissions.map((c) => (
              <li key={c.id} style={{ marginBottom: '5px' }}>
                👤 <strong style={{ color: '#f8fafc' }}>{c.employee}</strong> | 💰 <span style={{ color: '#10b981' }}>{c.amount} دينار</span> | 📅 <span style={{ color: '#94a3b8', fontSize: '13px' }}>{c.date}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 📊 إجمالي العمولات */}
      <div
        style={{
          marginTop: "20px",
          background: "#0f172a",
          padding: "15px",
          borderRadius: "8px",
          border: '1px solid #334155'
        }}
      >
        <h4 style={{ margin: '0 0 10px 0', color: '#facc15' }}>📈 إجمالي العمولات</h4>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>💰 المجموع: {totalCommissions} دينار</p>
      </div>

      {/* 📜 سجل الأحداث */}
      <div
        style={{
          marginTop: "20px",
          background: "#111827",
          padding: "15px",
          borderRadius: "8px",
          border: '1px solid #334155'
        }}
      >
        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8' }}>📜 سجل الأحداث والنشاطات</h4>
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
            background: "#10b981",
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

export default Commissions;