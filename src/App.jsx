import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { AppProvider, useApp } from './app/AppContext';

import Storefront from './Storefront';
import Accounting from './app/Accounting';
import Achievements from './app/Achievements';
import AiBot from './app/AiBot';
import Analytics from './app/Analytics';
import Announcements from './app/Announcements';
import Attendance from './app/Attendance';
import Commissions from './app/Commissions';
import Coupons from './app/Coupons';
import Customers from './app/Customers';
import CustomerService from './app/CustomerService';
import Documents from './app/Documents';
import EmailCenter from './app/EmailCenter';
import Employees from './app/Employees';
import Logs from './app/Logs';
import Orders from './app/Orders';
import Performance from './app/Performance';
import Products from './app/Products';
import Salaries from './app/Salaries';
import SalesLog from './app/SalesLog';
import Settings from './app/Settings';
import Tasks from './app/Tasks';
import Tickets from './app/Tickets';
import WorkHours from './app/WorkHours';
import { APP_PERMISSION_MAP } from './permissions';

// على localhost نستخدم السيرفر المحلي، وعلى Render الواجهة والـ API على نفس الرابط فنستخدم مسار نسبي
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:4000/api'
  : '/api';

const APP_GROUPS = {
  Products: 'المتجر والكتالوج', Coupons: 'المتجر والكتالوج', Customers: 'العملاء والدعم',
  CustomerService: 'العملاء والدعم', Tickets: 'العملاء والدعم', Announcements: 'العملاء والدعم', EmailCenter: 'العملاء والدعم',
  SalesLog: 'الطلبات والمال', Orders: 'الطلبات والمال', Accounting: 'الطلبات والمال', Analytics: 'الطلبات والمال',
  Employees: 'الفريق والعمليات', Salaries: 'الفريق والعمليات', Attendance: 'الفريق والعمليات', WorkHours: 'الفريق والعمليات',
  Tasks: 'الفريق والعمليات', Performance: 'الفريق والعمليات', Achievements: 'الفريق والعمليات', Commissions: 'الفريق والعمليات',
  Documents: 'الفريق والعمليات',
  Settings: 'النظام', Logs: 'النظام', AiBot: 'النظام'
};

const GLASS_STYLE = `
  .hz-atmosphere {
    background:
      radial-gradient(ellipse 800px 500px at 10% -5%, rgba(249,115,22,0.38), transparent 55%),
      radial-gradient(ellipse 700px 500px at 95% 0%, rgba(56,189,248,0.35), transparent 55%),
      radial-gradient(ellipse 900px 600px at 50% 105%, rgba(168,85,247,0.30), transparent 55%),
      radial-gradient(ellipse 500px 350px at 25% 55%, rgba(16,185,129,0.20), transparent 60%),
      #05060a;
    min-height: 100dvh;
    width: 100%;
    box-sizing: border-box;
  }

  .hz-glass-card {
    --glow: #38bdf8;
    position: relative;
    background:
      radial-gradient(130% 65% at 12% 0%, rgba(255,255,255,0.38), transparent 55%),
      linear-gradient(155deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 55%);
    backdrop-filter: blur(26px) saturate(200%);
    -webkit-backdrop-filter: blur(26px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 24px;
    padding: 22px;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.35s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.35s ease, border-color 0.3s ease;
    box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .hz-glass-card::before {
    content: '';
    position: absolute; inset: -50% -50% auto -50%; height: 220%;
    background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.16) 50%, transparent 58%);
    transform: translateX(-65%);
    transition: transform 0.7s ease;
    pointer-events: none;
  }
  .hz-glass-card:hover::before { transform: translateX(65%); }
  .hz-glass-card::after {
    content: '';
    position: absolute; left: 10%; right: 10%; bottom: -26px; height: 26px;
    background: radial-gradient(ellipse at center, var(--glow), transparent 72%);
    filter: blur(14px);
    opacity: 0.5;
    border-radius: 50%;
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: none;
  }
	  .hz-glass-card:hover {
	    transform: none;
    border-color: var(--glow);
	    box-shadow: 0 30px 60px rgba(0,0,0,0.55), 0 0 45px color-mix(in srgb, var(--glow) 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.4);
	  }
	  @media (hover: hover) and (pointer: fine) {
	    .hz-glass-card:not(.hz-app-full-container):hover { transform: translateY(-5px) scale(1.01); }
	  }
  .hz-glass-card:hover::after { opacity: 0.9; transform: scale(1.3); }
	  .hz-glass-card:active { transform: none; }
	  .hz-glass-card button:active, .hz-glass-card [role="button"]:active {
	    transform: translateY(1px) scale(0.98);
	    filter: brightness(1.12);
	  }
	  .hz-atmosphere button, .hz-atmosphere [role="button"], .hz-atmosphere input, .hz-atmosphere select, .hz-atmosphere textarea {
	    touch-action: manipulation;
	    -webkit-tap-highlight-color: transparent;
	  }
	  .hz-atmosphere button, .hz-atmosphere [role="button"] { min-height: 44px; }
	  .hz-glass-card { touch-action: manipulation; }
	  @media (hover: none), (pointer: coarse) {
	    .hz-glass-card:hover { transform: none; border-color: rgba(255,255,255,0.2); box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3); }
	    .hz-glass-card:active { transform: none; }
	  }

  .hz-app-full-container {
    width: 100% !important;
    min-height: calc(100dvh - 120px);
    margin: 0 !important;
    border-radius: 20px;
    box-sizing: border-box;
    cursor: default !important;
    overflow: visible !important;
  }
  .hz-app-full-container > div { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
  .hz-section-shell { width: 100%; max-width: 100%; min-width: 0; display: block; }
  .hz-section-shell > * { width: 100%; max-width: 100%; min-width: 0; }
  .hz-section-shell > [style*="position: fixed"] { width: 100vw !important; max-width: none !important; min-width: 0 !important; height: 100dvh !important; max-height: none !important; overflow-y: auto !important; align-items: center !important; padding: clamp(12px, 3vw, 24px) !important; background: rgba(15, 23, 42, 0.16) !important; backdrop-filter: blur(4px) !important; touch-action: pan-y; }
  .hz-section-shell > [style*="position: fixed"] > div { width: min(100%, 760px) !important; max-width: min(100%, 760px) !important; height: min(760px, calc(100dvh - clamp(24px, 3vw, 48px))) !important; max-height: calc(100dvh - clamp(24px, 3vw, 48px)) !important; min-height: 0 !important; margin: auto !important; overflow-y: auto !important; overflow-x: hidden !important; flex: 0 1 auto; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
  .hz-section-shell img, .hz-section-shell video, .hz-section-shell canvas { max-width: 100%; }
  .hz-section-shell table { width: 100%; max-width: 100%; border-collapse: collapse; }
  .hz-section-shell input, .hz-section-shell select, .hz-section-shell textarea { max-width: 100%; min-width: 0; }
  .hz-section-shell [style*="display: flex"] { min-width: 0; }
  .hz-section-shell [style*="display: grid"] { min-width: 0; }
  .hz-section-shell h1, .hz-section-shell h2, .hz-section-shell h3, .hz-section-shell h4, .hz-section-shell p { overflow-wrap: anywhere; }
  .hz-products-section { width: 100% !important; max-width: none !important; min-width: 0 !important; overflow: visible !important; }
  .hz-products-grid { width: 100% !important; max-width: none !important; min-width: 0 !important; align-items: stretch; }
  .hz-products-grid > * { min-width: 0; max-width: none; }
  .hz-admin-main { width: 100% !important; padding: 12px 18px !important; }
  .hz-products-section { min-height: calc(100dvh - 150px); }
  .hz-section-shell .hz-product-modal { width: min(100%, 560px) !important; max-width: 560px !important; padding: 18px !important; }
  .hz-product-modal h3 { font-size: 16px !important; margin-bottom: 10px !important; }
  .hz-product-modal input, .hz-product-modal select, .hz-product-modal textarea { padding: 8px 10px !important; font-size: 12px !important; }
  .hz-product-modal .hz-product-form { gap: 8px !important; }
  .hz-field-label { display: flex; flex-direction: column; gap: 5px; color: #c4b5fd; font-size: 12px; font-weight: 700; }
  .hz-schedule-box { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px; border: 1px solid rgba(56,189,248,0.28); border-radius: 12px; background: rgba(15,23,42,0.55); color: #bae6fd; font-size: 12px; }
  .hz-schedule-box strong, .hz-schedule-box > span { grid-column: 1 / -1; }
  .hz-schedule-box label { display: flex; flex-direction: column; gap: 5px; color: #cbd5e1; }
  @media (max-width: 720px) { .hz-section-shell [style*="position: fixed"] > div.hz-product-modal { width: 100% !important; max-width: 100% !important; } .hz-schedule-box { grid-template-columns: minmax(0, 1fr); } .hz-schedule-box strong, .hz-schedule-box > span { grid-column: auto; } }
  .hz-section-shell [style*="position: fixed"] { inset: 0 !important; width: 100vw !important; height: 100dvh !important; max-width: none !important; max-height: none !important; align-items: center !important; padding: clamp(12px, 3vw, 24px) !important; overflow-y: auto !important; background: rgba(15, 23, 42, 0.16) !important; backdrop-filter: blur(4px) !important; touch-action: pan-y; }
  .hz-section-shell [style*="position: fixed"] > div { width: min(100%, 760px) !important; max-width: min(100%, 760px) !important; height: min(760px, calc(100dvh - clamp(24px, 3vw, 48px))) !important; max-height: calc(100dvh - clamp(24px, 3vw, 48px)) !important; min-height: 0 !important; margin: auto !important; overflow-y: auto !important; overflow-x: hidden !important; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
  .hz-product-form, .hz-employee-form { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 12px !important; }
  .hz-product-form > button:last-child, .hz-employee-form > button:last-child { grid-column: 1 / -1; }
  .hz-product-form > *, .hz-employee-form > * { min-width: 0; width: 100%; }
  .hz-section-shell [style*="position: fixed"] > div.hz-product-modal { width: min(100%, 760px) !important; max-width: 760px !important; padding: 20px !important; }
  @media (max-width: 720px) { .hz-section-shell [style*="position: fixed"] > div.hz-product-modal { width: 100% !important; max-width: 100% !important; } }
  @media (max-width: 720px) { .hz-product-form, .hz-employee-form { grid-template-columns: minmax(0, 1fr); } .hz-product-form > button:last-child, .hz-employee-form > button:last-child { grid-column: auto; } }
  .hz-section-shell [style*="position: fixed"] > div[style*="maxWidth"], .hz-section-shell [style*="position: fixed"] > div[style*="max-width"] { width: min(100%, 760px) !important; max-width: min(100%, 760px) !important; max-height: calc(100dvh - clamp(24px, 6vw, 48px)) !important; margin: auto !important; }
  .hz-atmosphere, .hz-atmosphere * { box-sizing: border-box; }
  .hz-atmosphere { min-width: 0; overflow-x: clip; overscroll-behavior-x: none; }
  .hz-admin-main, .hz-admin-main > div { min-width: 0; max-width: 100%; }
  .hz-admin-main input, .hz-admin-main select, .hz-admin-main textarea, .hz-admin-main button { max-width: 100%; }
  @media (max-width: 640px) {
    .hz-admin-header { padding: 10px 12px !important; }
    .hz-admin-header > div { width: 100%; justify-content: center; }
    .hz-admin-main { padding: 10px 8px !important; overflow-x: clip; }
    .hz-app-full-container { padding: 12px !important; border-radius: 16px; }
    .hz-glass-card { padding: 14px; border-radius: 18px; }
    .hz-glass-icon { width: 42px; height: 42px; font-size: 19px; }
    .hz-admin-main [style*="grid-template-columns"] { grid-template-columns: minmax(0, 1fr) !important; }
    .hz-admin-main [style*="min-width"] { min-width: 0 !important; }
    .hz-admin-main [style*="width:"] { max-width: 100% !important; }
  }

  .hz-glass-icon {
    width: 48px; height: 48px; border-radius: 15px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--glow) 65%, transparent), color-mix(in srgb, var(--glow) 25%, transparent));
    border: 1px solid color-mix(in srgb, var(--glow) 80%, white 15%);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--glow) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.45);
  }

  @keyframes hzPulseDot {
    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
    70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  }
  .hz-unread-dot {
    position: absolute; top: 14px; left: 14px;
    width: 11px; height: 11px; border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 10px rgba(239,68,68,0.8);
    animation: hzPulseDot 1.8s infinite;
  }

  .hz-glass-btn {
    background:
      radial-gradient(120% 100% at 20% 0%, rgba(255,255,255,0.18), transparent 60%),
      rgba(17,24,39,0.5);
    backdrop-filter: blur(22px) saturate(190%);
    -webkit-backdrop-filter: blur(22px) saturate(190%);
    border: 1px solid rgba(255,255,255,0.2);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
    transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .hz-glass-btn:hover {
    transform: translateY(-2px);
    border-color: rgba(255,255,255,0.4);
    box-shadow: 0 10px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
  }
  .hz-dashboard-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 26px; }
  .hz-dashboard-summary > div { display: flex; flex-direction: column; gap: 5px; padding: 16px 18px; border: 1px solid rgba(56,189,248,0.2); border-radius: 18px; background: linear-gradient(145deg, rgba(15,23,42,0.8), rgba(30,41,59,0.38)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12); }
  .hz-dashboard-summary strong { color: #f8fafc; font-size: 22px; }
  .hz-dashboard-summary span { color: #94a3b8; font-size: 12px; }
  .hz-app-group { margin-bottom: 30px; }
  .hz-app-group-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 14px; padding: 0 4px 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .hz-app-group-heading h2 { margin: 0; color: #bae6fd; font-size: 18px; }
  .hz-app-group-heading span { color: #64748b; font-size: 12px; }
  @media (max-width: 640px) { .hz-dashboard-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hz-dashboard-summary > div { padding: 12px; } }
  .hz-orders-panel { padding: 4px; color: #e2e8f0; }
  .hz-orders-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  .hz-orders-header h2 { margin: 0 0 6px; color: #67e8f9; font-size: 24px; }
  .hz-orders-header p { color: #94a3b8; font-size: 13px; }
  .hz-orders-refresh { color: #fff; padding: 10px 14px; border-radius: 12px; cursor: pointer; }
  .hz-orders-alert { margin-bottom: 16px; padding: 12px 14px; border: 1px solid rgba(248,113,113,0.55); border-radius: 12px; color: #fecaca; background: rgba(127,29,29,0.25); }
  .hz-orders-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .hz-orders-stats > div { display: flex; flex-direction: column; gap: 4px; padding: 15px; border: 1px solid rgba(56,189,248,0.18); border-radius: 16px; background: rgba(15,23,42,0.55); }
  .hz-orders-stats span { color: #94a3b8; font-size: 12px; }
  .hz-orders-stats strong { color: #f8fafc; font-size: 21px; }
  .hz-orders-filters { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 10px; margin-bottom: 18px; }
  .hz-orders-filters input, .hz-orders-filters select, .hz-order-status select { min-height: 44px; padding: 10px 12px; color: #fff; border: 1px solid #334155; border-radius: 10px; background: rgba(15,23,42,0.85); }
  .hz-orders-list { display: grid; gap: 12px; }
  .hz-order-card { display: grid; grid-template-columns: minmax(170px, 1.1fr) minmax(160px, 1fr) 120px 160px; align-items: center; gap: 14px; padding: 16px; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; background: linear-gradient(145deg, rgba(30,41,59,0.65), rgba(15,23,42,0.55)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1); }
  .hz-order-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .hz-order-main strong { color: #f8fafc; }
  .hz-order-main span, .hz-order-items span { color: #94a3b8; font-size: 12px; overflow-wrap: anywhere; }
  .hz-order-number { color: #67e8f9; font-weight: 800; }
  .hz-order-items { display: flex; flex-wrap: wrap; gap: 5px; }
  .hz-order-items span { padding: 5px 7px; border-radius: 8px; background: rgba(2,132,199,0.14); }
  .hz-order-total { color: #86efac; font-size: 16px; font-weight: 800; white-space: nowrap; }
  .hz-order-status { display: flex; flex-direction: column; gap: 5px; color: #94a3b8; font-size: 11px; }
  .hz-orders-empty { padding: 45px 20px; color: #94a3b8; text-align: center; border: 1px dashed rgba(148,163,184,0.35); border-radius: 16px; }
  @media (max-width: 800px) { .hz-order-card { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hz-order-main { grid-column: 1 / -1; } }
  @media (max-width: 560px) { .hz-orders-filters { grid-template-columns: 1fr; } .hz-order-card { grid-template-columns: 1fr; } }
`;

function MainContent() {
  const [activeApp, setActiveApp] = useState(null);
  const [showStorefront, setShowStorefront] = useState(true);

  const appContext = useApp();
  const safeContext = appContext && typeof appContext === 'object' ? appContext : {};

  const {
    employees = [], setEmployees = () => {},
    attendance = [], setAttendance = () => {},
    salaries = [], setSalaries = () => {},
    workHours = [], setWorkHours = () => {},
    performance = [], setPerformance = () => {},
    achievements = [], setAchievements = () => {},
    products = [], setProducts = () => {},
    coupons = [], setCoupons = () => {},
    salesLog = [], setSalesLog = () => {},
    accountingTransactions = [], setAccountingTransactions = () => {},
    customers = [], setCustomers = () => {},
    customerService = [], setCustomerService = () => {},
    tickets = [], setTickets = () => {},
    mails = [], setMails = () => {},
    announcements = [], setAnnouncements = () => {},
    tasks = [], setTasks = () => {},
    documents = [], setDocuments = () => {},
    logs = [], setLogs = () => {},
    commissions = [], setCommissions = () => {},
    currentUser = null,
    setCurrentUser = () => {},
    setToken = () => {},
    setLoginError = () => {},
    socket = null,
    hasPermission = () => false
  } = safeContext;
  const refreshAllData = safeContext.refreshAllData;

  // 🔑 OAuth Redirect Handler — يقرأ التوكن من الرابط بعد تسجيل الدخول الاجتماعي
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('authToken');
    const authError = urlParams.get('authError');

    if (authError) {
      setLoginError('فشل تسجيل الدخول عبر ' + authError);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (authToken) {
      localStorage.setItem('hamza_token', authToken);
      localStorage.setItem('token', authToken);
      setToken(authToken);

      axios.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      .then(res => {
        if (res.data?.success && res.data?.user) {
          setCurrentUser(res.data.user);
          localStorage.setItem('hamza_user', JSON.stringify(res.data.user));
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, [setCurrentUser, setToken, setLoginError]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdateData = (event) => {
      if (!event) return;

      if (event.type === 'PRODUCTS' && Array.isArray(event.payload)) {
        setProducts(event.payload);
      } else if (event.type === 'ORDERS' && Array.isArray(event.payload)) {
        setSalesLog(event.payload);
      } else if (event.type === 'EMPLOYEES' && Array.isArray(event.payload)) {
        setEmployees(event.payload);
      } else if (event.type === 'REFRESH_ALL') {
        if (typeof refreshAllData === 'function') {
          refreshAllData();
        }
      }
    };

    socket.on('UPDATE_DATA', handleUpdateData);

    return () => {
      socket.off('UPDATE_DATA', handleUpdateData);
    };
  }, [socket, setProducts, setSalesLog, setEmployees, refreshAllData]);

  const inputStyle = useMemo(() => ({ background: 'rgba(15, 23, 42, 0.82)', color: '#fff', border: '1px solid #334155', padding: '10px 14px', borderRadius: '10px' }), []);

  const [sessions, setSessions] = useState([{ id: '1', name: 'الجلسة العامة للتحليل والإدارة' }]);
  const [currentSessionId, setCurrentSessionId] = useState('1');
  const [chatHistories, setChatHistories] = useState({});
  const [aiInputText, setAiInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const createNewPrivateSession = () => {
    const newId = String(Date.now());
    setSessions(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return [...safePrev, { id: newId, name: `جلسة خاصة ${safePrev.length + 1}` }];
    });
    setCurrentSessionId(newId);
  };

  const appsList = useMemo(() => [
    { id: 'AiBot', name: 'روبوت الذكاء والتقارير', icon: '🤖', borderColor: '#3b82f6', component: <AiBot currentUser={currentUser} sessions={sessions} currentSessionId={currentSessionId} setCurrentSessionId={setCurrentSessionId} createNewPrivateSession={createNewPrivateSession} chatHistories={chatHistories} setChatHistories={setChatHistories} aiInputText={aiInputText} setAiInputText={setAiInputText} inputStyle={inputStyle} transactions={accountingTransactions} products={products} employees={employees} /> },
    { id: 'Products', name: 'إدارة المنتجات والمخزون', icon: '📦', borderColor: '#10b981', component: <Products products={products} setProducts={setProducts} inputStyle={inputStyle} currentUser={currentUser} /> },
    { id: 'Employees', name: 'إدارة الموظفين (HR)', icon: '👥', borderColor: '#8b5cf6', component: <Employees employees={employees} setEmployees={setEmployees} searchTerm={searchTerm} setSearchTerm={setSearchTerm} /> },
    { id: 'Salaries', name: 'الرواتب والمكافآت', icon: '💵', borderColor: '#f59e0b', component: <Salaries salaries={salaries} setSalaries={setSalaries} inputStyle={inputStyle} currentUser={currentUser} /> },
    { id: 'EmailCenter', name: 'مركز البريد (Gmail)', icon: '✉️', borderColor: '#3b82f6', component: <EmailCenter emails={mails} setEmails={setMails} messages={mails} inputStyle={inputStyle} /> },
    { id: 'Accounting', name: 'المحاسبة والأرباح', icon: '💰', borderColor: '#10b981', component: <Accounting transactions={accountingTransactions} setTransactions={setAccountingTransactions} mails={mails} setMails={setMails} currentUser={currentUser} inputStyle={inputStyle} /> },
    { id: 'Orders', name: 'مركز الطلبات', icon: '🛒', borderColor: '#22d3ee', component: <Orders /> },
    { id: 'SalesLog', name: 'سجل المبيعات والطلبات', icon: '📊', borderColor: '#6366f1', component: <SalesLog transactions={salesLog} sales={salesLog} /> },
    { id: 'Coupons', name: 'كوبونات الخصم', icon: '🎟️', borderColor: '#f43f5e', component: <Coupons coupons={coupons} setCoupons={setCoupons} inputStyle={inputStyle} /> },
    { id: 'Tickets', name: 'تذاكر الدعم الفني', icon: '🎫', borderColor: '#14b8a6', component: <Tickets tickets={tickets} setTickets={setTickets} /> },
    { id: 'Announcements', name: 'إعلانات المتجر', icon: '📢', borderColor: '#f97316', component: <Announcements announcements={announcements} setAnnouncements={setAnnouncements} /> },
    { id: 'Tasks', name: 'إدارة مهام الكوادر', icon: '📝', borderColor: '#84cc16', component: <Tasks tasks={tasks} setTasks={setTasks} /> },
    { id: 'Logs', name: 'سجل النشاطات والأمان', icon: '🛡️', borderColor: '#3b82f6', component: <Logs logs={logs} setLogs={setLogs} /> },
    { id: 'Settings', name: 'إعدادات المتجر العامة', icon: '⚙️', borderColor: '#64748b', component: <Settings /> },
    { id: 'Analytics', name: 'الإحصائيات المتقدمة', icon: '📈', borderColor: '#0ea5e9', component: <Analytics employees={employees} customers={customers} products={products} transactions={accountingTransactions} /> },
    { id: 'Performance', name: 'مراقبة الأداء والإنذارات', icon: '🔍', borderColor: '#eab308', component: <Performance performance={performance} setPerformance={setPerformance} /> },
    { id: 'WorkHours', name: 'تتبع ساعات العمل', icon: '⏱️', borderColor: '#a855f7', component: <WorkHours workHours={workHours} setWorkHours={setWorkHours} /> },
    { id: 'Achievements', name: 'قياس الإنجازات', icon: '🏆', borderColor: '#10b981', component: <Achievements achievements={achievements} setAchievements={setAchievements} mails={mails} setMails={setMails} currentUser={currentUser} inputStyle={inputStyle} /> },
    { id: 'Customers', name: 'إدارة العملاء', icon: '🤝', borderColor: '#3b82f6', component: <Customers customers={customers} setCustomers={setCustomers} /> },
    { id: 'CustomerService', name: 'خدمة العملاء', icon: '🎧', borderColor: '#f59e0b', component: <CustomerService tickets={customerService} setTickets={setCustomerService} /> },
    { id: 'Documents', name: 'المستندات والأوراق', icon: '📁', borderColor: '#6366f1', component: <Documents documents={documents} setDocuments={setDocuments} /> },
    { id: 'Attendance', name: 'الحضور والانصراف', icon: '📅', borderColor: '#10b981', component: <Attendance attendance={attendance} setAttendance={setAttendance} /> },
    { id: 'Commissions', name: 'العمولات والمبيعات', icon: '💎', borderColor: '#ec4899', component: <Commissions commissions={commissions} setCommissions={setCommissions} /> },
  ], [currentUser, sessions, currentSessionId, chatHistories, aiInputText, inputStyle, accountingTransactions, setAccountingTransactions, products, setProducts, employees, setEmployees, searchTerm, salaries, setSalaries, mails, setMails, salesLog, coupons, setCoupons, tickets, setTickets, announcements, setAnnouncements, tasks, setTasks, logs, setLogs, performance, setPerformance, workHours, setWorkHours, achievements, setAchievements, customers, setCustomers, customerService, setCustomerService, documents, setDocuments, attendance, setAttendance, commissions, setCommissions]);

  const visibleAppsList = useMemo(() => {
    const safeList = Array.isArray(appsList) ? appsList : [];
    return safeList.filter(app => hasPermission(APP_PERMISSION_MAP[app.id]));
  }, [appsList, hasPermission]);

  const effectiveActiveApp = visibleAppsList.some(app => app.id === activeApp) ? activeApp : null;
  const currentApp = useMemo(
    () => visibleAppsList.find(app => app && app.id === effectiveActiveApp),
    [visibleAppsList, effectiveActiveApp]
  );
  const groupedApps = useMemo(() => visibleAppsList.reduce((groups, app) => {
    const groupName = APP_GROUPS[app.id] || 'النظام';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(app);
    return groups;
  }, {}), [visibleAppsList]);

  const isManagerOrEmployee = useMemo(() => {
    if (!currentUser || typeof currentUser !== 'object') return false;
    const role = typeof currentUser.role === 'string' ? currentUser.role : '';
    return ['owner', 'admin', 'manager', 'stock', 'sales', 'support', 'employee', 'staff'].includes(role) || currentUser.isOwner === true;
  }, [currentUser]);

  return (
    <div className="hz-atmosphere" style={{ color: '#f8fafc', width: '100%', fontFamily: 'Tajawal, sans-serif', direction: 'rtl', boxSizing: 'border-box' }}>
      <style>{GLASS_STYLE}</style>

      {!showStorefront && (
        <header className="hz-admin-header" style={{ padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
          <img src="/logo.png" alt="Hamza Store" style={{ width: '140px', height: 'auto', maxHeight: '56px', objectFit: 'contain', display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => { setShowStorefront(true); setActiveApp(null); }} className="hz-glass-btn" style={{ color: '#fff', padding: '8px 14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>🛍️ واجهة المتجر</button>
            {isManagerOrEmployee && (
              <button onClick={() => setShowStorefront(false)} className="hz-glass-btn" style={{ '--glow': '#7c3aed', color: '#c4b5fd', padding: '8px 14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>⚙️ لوحة التحكم</button>
            )}
          </div>
        </header>
      )}

      <main className="hz-admin-main" style={{ padding: showStorefront ? '0' : '20px 40px', width: '100%', boxSizing: 'border-box' }}>
        {showStorefront || !isManagerOrEmployee ? (
          <Storefront inputStyle={inputStyle} onOpenDashboard={() => setShowStorefront(false)} />
        ) : (
          <div style={{ width: '100%' }}>
            {!effectiveActiveApp ? (
              <div>
                <div className="hz-dashboard-summary">
                  <div><strong>مركز التشغيل</strong><span>الأقسام العاملة: {visibleAppsList.length}</span></div>
                  <div><strong>{products.length}</strong><span>منتج في الكتالوج</span></div>
                  <div><strong>{salesLog.length}</strong><span>عملية/طلب</span></div>
                  <div><strong>{tasks.filter(task => task && !task.completed).length}</strong><span>مهمة مفتوحة</span></div>
                </div>
                {Object.entries(groupedApps).map(([groupName, groupApps]) => (
                  <section key={groupName} className="hz-app-group">
                    <div className="hz-app-group-heading"><h2>{groupName}</h2><span>{groupApps.length} أقسام</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px', width: '100%' }}>
                      {groupApps.map((app, index) => {
                        if (!app) return null;
                        const glow = app.borderColor || '#38bdf8';
                        return (
                          <div key={app.id || index} onClick={() => setActiveApp(app.id)} className="hz-glass-card" style={{ '--glow': glow, textAlign: 'center' }}>
                            <div className="hz-glass-icon" style={{ margin: '0 auto 12px auto' }}>{app.icon || '📌'}</div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{app.name || 'تطبيق'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="hz-glass-card hz-app-full-container">
                <button onClick={() => setActiveApp(null)} className="hz-glass-btn" style={{ color: '#fff', padding: '6px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '15px' }}>← العودة للقائمة</button>
                <div className="hz-section-shell">
                  {currentApp && currentApp.component ? (
                    <SectionErrorBoundary appName={currentApp.name} onBack={() => setActiveApp(null)}>
                      {currentApp.component}
                    </SectionErrorBoundary>
                  ) : <div>التطبيق غير موجود</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error(`تعذر تشغيل قسم ${this.props.appName || 'غير معروف'}:`, error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="hz-section-error" role="alert" dir="rtl">
        <div className="hz-glass-icon" style={{ '--glow': '#ef4444', margin: '0 auto 14px' }}>!</div>
        <h2>تعذر تشغيل هذا القسم</h2>
        <p>تم عزل العطل حتى تبقى بقية لوحة التحكم تعمل. يمكنك العودة للقائمة وتجربة قسم آخر.</p>
        <button type="button" className="hz-glass-btn" onClick={this.props.onBack}>العودة إلى الأقسام</button>
      </section>
    );
  }
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'حدث خطأ غير متوقع.' };
  }

  componentDidCatch(error, info) {
    console.error('واجهة التطبيق تعطلت:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="hz-atmosphere" dir="rtl" style={{ display: 'grid', placeItems: 'center', padding: '24px', color: '#fff' }}>
        <section className="hz-glass-card" style={{ maxWidth: '560px', textAlign: 'center', cursor: 'default' }}>
          <div className="hz-glass-icon" style={{ '--glow': '#ef4444', margin: '0 auto 16px' }}>!</div>
          <h2 style={{ color: '#fff', margin: '0 0 10px' }}>تعذر تحميل هذا القسم</h2>
          <p style={{ color: '#cbd5e1', marginBottom: '18px' }}>تم إيقاف العرض المتعطل لحماية بقية النظام. أعد المحاولة أو ارجع للصفحة الرئيسية.</p>
          <p dir="ltr" style={{ color: '#fca5a5', fontSize: '12px', wordBreak: 'break-word', marginBottom: '18px' }}>{this.state.message}</p>
          <button type="button" className="hz-glass-btn" onClick={() => window.location.reload()} style={{ color: '#fff', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer' }}>
            إعادة تحميل النظام
          </button>
        </section>
      </div>
    );
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppErrorBoundary>
        <MainContent />
      </AppErrorBoundary>
    </AppProvider>
  );
}
