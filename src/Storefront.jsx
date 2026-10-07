import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useApp } from './app/AppContext';
import LoginPage from './app/LoginPage';
import { useProducts, ProductSearchBar, ProductGrid } from './StoreProducts';
import SupportSection from './SupportSection';
import SocialCards from './SocialCards';
import { useAuthCart, HeaderControls, CheckoutForm, OrderConfirmation, ResetPasswordPage } from './AuthCartCheckout';

const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const API_BASE_URL = isLocal ? 'http://localhost:4000/api' : '/api';
const SOCKET_URL = isLocal ? 'http://localhost:4000' : window.location.origin;
const isPublishedProduct = (product = {}) => {
  const status = String(product.status || '').trim().toLowerCase();
  if (status) return ['منشور', 'published', 'active'].includes(status);
  return product.isPublished !== false && product.published !== false;
};

const GLASS_STYLE = `
  /* ✅ إصلاح السكرول: overflow-x:hidden على html و body معاً كان يحوّل body لحاوية سكرول ثانية */
  html { margin: 0; padding: 0; background: #05060a; -webkit-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; background: #05060a; overflow-x: clip; overscroll-behavior-x: none; }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hz-product-card {
    --glow: #10b981;
    position: relative;
    background:
      radial-gradient(130% 65% at 12% 0%, rgba(255,255,255,0.38), transparent 55%),
      linear-gradient(155deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 55%);
    backdrop-filter: blur(26px) saturate(200%);
    -webkit-backdrop-filter: blur(26px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 18px;
    padding: 16px;
    overflow: hidden;
    transition: transform 0.35s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.35s ease, border-color 0.3s ease;
    box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .hz-product-card::before {
    content: '';
    position: absolute; inset: -50% -50% auto -50%; height: 220%;
    background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.16) 50%, transparent 58%);
    transform: translateX(-65%);
    transition: transform 0.7s ease;
    pointer-events: none;
    z-index: 3;
  }
  .hz-product-card:hover::before { transform: translateX(65%); }
  .hz-product-card:hover {
    transform: translateY(-10px) scale(1.015);
    border-color: var(--glow);
    box-shadow: 0 30px 60px rgba(0,0,0,0.55), 0 0 45px color-mix(in srgb, var(--glow) 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.4);
  }

  .hz-product-media { position: absolute; inset: 0; z-index: 0; }
  .hz-product-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s ease; }
  .hz-product-card:hover .hz-product-media img { transform: scale(1.08); }
  .hz-product-media::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(5,6,10,0.15) 0%, rgba(5,6,10,0.55) 55%, rgba(5,6,10,0.92) 100%);
  }
  .hz-product-media.hz-no-image {
    background: radial-gradient(130% 90% at 30% 10%, rgba(16,185,129,0.25), transparent 60%), linear-gradient(155deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 60%);
  }
  .hz-product-media.hz-no-image::after { background: none; }
  .hz-product-body { position: relative; z-index: 2; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px; }
  .hz-product-glasschip { background: rgba(15,20,30,0.45); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.18); }

  .hz-category-glass-bar {
    background: radial-gradient(130% 65% at 12% 0%, rgba(255,255,255,0.25), transparent 60%), rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(24px) saturate(190%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px; padding: 12px 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px;
  }
  .hz-category-chip {
    background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12); color: #cbd5e1;
    padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .hz-category-chip:hover { background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.4); color: #f8fafc; transform: translateY(-2px); }
  .hz-category-chip.active {
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.4), rgba(59, 130, 246, 0.25));
    border-color: rgba(96, 165, 250, 0.6); color: #fff; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
  }
  .hz-header-wallet { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .hz-header-balances { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .hz-header-balances span { display: inline-flex; align-items: center; white-space: nowrap; padding: 5px 8px; border-radius: 9px; font-size: 11px; font-weight: 700; }
  .hz-balance-pill { color: #fde68a; background: rgba(250,204,21,0.12); border: 1px solid rgba(250,204,21,0.35); }
  .hz-loyalty-pill { color: #e9d5ff; background: rgba(168,85,247,0.14); border: 1px solid rgba(168,85,247,0.35); }
  .hz-redeem-form { display: flex; align-items: center; gap: 5px; }
  .hz-redeem-form input { width: 130px; background: rgba(11,15,25,0.7); border: 1px solid rgba(250,204,21,0.35); border-radius: 8px; padding: 6px 8px; color: #fff; font-size: 11px; }
  .hz-redeem-form button { background: #a16207; color: #fff; border: none; border-radius: 8px; padding: 6px 8px; cursor: pointer; font-size: 11px; }
  .hz-store-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: nowrap; min-width: 0; }
  .hz-store-brand { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1 1 auto; }
  .hz-store-brand img { flex: 0 0 auto; }
  .hz-store-brand span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hz-header-controls { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; flex-wrap: nowrap; min-width: max-content; }
  .hz-header-controls > div { flex: 0 0 auto; }

  .hz-social-section { width: 100%; margin: 42px 0 28px; }
  .hz-social-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
  .hz-social-kicker { display: block; color: #facc15; font-size: 11px; font-weight: 700; margin-bottom: 7px; }
  .hz-social-heading h2 { margin: 0; color: #f8fafc; font-size: clamp(20px, 3vw, 28px); }
  .hz-social-line { width: 54%; height: 1px; background: linear-gradient(90deg, transparent, rgba(250,204,21,0.8)); }
  .hz-social-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .hz-social-card { min-width: 0; border-radius: 20px; padding: 18px; color: #f8fafc; overflow: hidden; }
  .hz-social-card-top, .hz-social-profile, .hz-social-footer { display: flex; align-items: center; gap: 12px; }
  .hz-social-card-top { justify-content: space-between; }
  .hz-social-card-top strong, .hz-social-card-top span, .hz-social-profile-copy strong, .hz-social-profile-copy span { display: block; }
  .hz-social-card-top strong { font-size: 14px; }
  .hz-social-card-top span, .hz-social-profile-copy span, .hz-social-footer { color: #94a3b8; font-size: 11px; margin-top: 4px; }
  .hz-social-icon { width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center; color: var(--social-color); border: 1px solid color-mix(in srgb, var(--social-color) 65%, white 10%); border-radius: 12px; font-size: 25px; }
  .hz-social-profile { margin-top: 16px; padding: 12px; border-radius: 14px; background: rgba(5,6,10,0.42); border: 1px solid rgba(255,255,255,0.1); }
  .hz-social-avatar { width: 38px; height: 38px; flex: 0 0 38px; display: grid; place-items: center; border-radius: 50%; color: #fff; font-weight: 800; background: linear-gradient(135deg, var(--social-color), #7c3aed); }
  .hz-social-profile-copy { min-width: 0; flex: 1; }
  .hz-social-profile-copy strong { overflow-wrap: anywhere; font-size: 12px; }
  .hz-social-open { flex: 0 0 auto; color: #fff; background: linear-gradient(135deg, #c026d3, #7c3aed); border-radius: 9px; padding: 8px 10px; text-decoration: none; font-size: 11px; font-weight: 700; }
  .hz-social-open-disabled { background: rgba(255,255,255,0.08); color: #cbd5e1; }
  .hz-social-footer { justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); }

  .hz-glass-card {
    position: relative;
    background: radial-gradient(130% 65% at 12% 0%, rgba(255,255,255,0.38), transparent 55%), linear-gradient(155deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 55%);
    backdrop-filter: blur(26px) saturate(200%); border: 1px solid rgba(255,255,255,0.2); border-radius: 18px; padding: 18px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .hz-glass-btn {
    background: radial-gradient(120% 100% at 20% 0%, rgba(255,255,255,0.18), transparent 60%), rgba(17,24,39,0.5);
    backdrop-filter: blur(22px); border: 1px solid rgba(255,255,255,0.2);
    transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .hz-glass-btn:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.4); box-shadow: 0 10px 24px rgba(0,0,0,0.5); }
  .hz-store-header {
    position: relative; overflow: hidden; isolation: isolate;
    background: linear-gradient(135deg, rgba(15,23,42,0.88), rgba(8,11,16,0.62));
    border: 1px solid rgba(148,163,184,0.22); border-radius: 22px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.14);
  }
  .hz-store-header::after { content: ''; position: absolute; inset: 0; z-index: -1; background: radial-gradient(circle at 12% 0%, rgba(56,189,248,0.16), transparent 38%), radial-gradient(circle at 88% 100%, rgba(249,115,22,0.12), transparent 42%); pointer-events: none; }
  .hz-hero-frame { position: relative; width: 100%; max-width: 100%; box-sizing: border-box; height: clamp(260px, 50vw, 760px); margin-bottom: 24px; border-radius: 24px; overflow: hidden; border: 1px solid rgba(240,192,96,0.38); box-shadow: 0 20px 60px rgba(0,0,0,0.42), 0 0 45px rgba(56,189,248,0.08); background: #080b10; }
  .hz-hero-frame::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(2,6,23,0.02), rgba(2,6,23,0.32)); }
  .hz-hero-frame img, .hz-hero-frame video { display: block; width: 100%; height: 100% !important; max-height: 100% !important; object-fit: cover !important; object-position: center; background: #080b10; }
  .hz-hero-media { position: absolute; inset: 0; opacity: 0; transition: opacity .55s ease; pointer-events: none; }
  .hz-hero-media.active { opacity: 1; pointer-events: auto; }
  .hz-hero-arrow { position: absolute; z-index: 4; top: 50%; transform: translateY(-50%); width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.3); border-radius: 50%; color: #fff; background: rgba(8,11,16,.58); backdrop-filter: blur(12px); cursor: pointer; font-size: 22px; }
  .hz-hero-arrow.prev { inset-inline-start: 14px; }
  .hz-hero-arrow.next { inset-inline-end: 14px; }
  .hz-hero-dots { position: absolute; z-index: 4; inset: auto 0 12px; display: flex; justify-content: center; gap: 7px; }
  .hz-hero-dot { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.45); cursor: pointer; }
  .hz-hero-dot.active { width: 24px; border-radius: 999px; background: #facc15; }
  .hz-store-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin: 26px 0 4px; padding: 16px 18px; border: 1px solid rgba(148,163,184,0.18); border-radius: 18px; background: linear-gradient(135deg, rgba(15,23,42,0.72), rgba(8,11,16,0.52)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12); color: #94a3b8; font-size: 11px; }
  .hz-store-footer strong { color: #bae6fd; font-size: 13px; }
  .hz-social-section { margin-top: 26px; }
  .hz-social-heading { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-bottom: 14px; padding: 0 4px; }
  .hz-social-heading h2 { margin: 0; color: #f8fafc; font-size: clamp(18px, 2.5vw, 24px); }
  .hz-social-heading > span { color: #64748b; font-size: 11px; }
  .hz-social-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .hz-social-card { display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 82px; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--social-color) 35%, rgba(255,255,255,0.16)); border-radius: 20px; color: #f8fafc; text-decoration: none; background: linear-gradient(135deg, color-mix(in srgb, var(--social-color) 15%, rgba(15,23,42,0.78)), rgba(8,11,16,0.62)); box-shadow: 0 14px 30px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.14); transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
  .hz-social-card:hover { transform: translateY(-4px); border-color: var(--social-color); box-shadow: 0 18px 38px rgba(0,0,0,0.35), 0 0 26px color-mix(in srgb, var(--social-color) 24%, transparent); }
  .hz-social-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 48px; height: 48px; border-radius: 15px; color: var(--social-color); background: color-mix(in srgb, var(--social-color) 15%, rgba(15,23,42,0.72)); border: 1px solid color-mix(in srgb, var(--social-color) 50%, transparent); font-size: 24px; font-weight: 900; }
  .hz-social-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .hz-social-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  .hz-social-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #94a3b8; font-size: 11px; }
  .hz-social-login { display: inline-flex; width: fit-content; margin-top: 4px; padding: 4px 8px; border-radius: 999px; color: #fbcfe8; background: rgba(244,114,182,0.12); border: 1px solid rgba(244,114,182,0.26); font-size: 10px; font-weight: 800; }
  .hz-instagram-live-panel { width: min(100%, 680px); box-sizing: border-box; margin: 12px auto 0; padding: 12px; border: 1px solid rgba(244,114,182,0.24); border-radius: 18px; background: linear-gradient(135deg, rgba(244,114,182,0.08), rgba(15,23,42,0.68)); }
  .hz-instagram-live-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; color: #fbcfe8; font-size: 14px; }
  .hz-instagram-live-heading a { color: #67e8f9; font-size: 12px; text-decoration: none; }
  .hz-instagram-media-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .hz-instagram-media { position: relative; display: block; aspect-ratio: 1; overflow: hidden; border-radius: 16px; border: 1px solid rgba(255,255,255,0.14); background: #0f172a; }
  .hz-instagram-media img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .25s ease; }
  .hz-instagram-media:hover img { transform: scale(1.06); }
  .hz-instagram-media span { position: absolute; inset: auto 8px 8px; padding: 5px 7px; border-radius: 8px; color: #fff; background: rgba(2,6,23,0.72); font-size: 10px; text-align: center; }
  .hz-instagram-empty { margin: 0; color: #94a3b8; font-size: 12px; }
  .hz-instagram-profile-head { display: flex; align-items: center; gap: 14px; }
  .hz-instagram-profile-head > img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #f472b6; background: #1e293b; }
  .hz-instagram-profile-head > div { min-width: 0; flex: 1; }
  .hz-instagram-profile-head strong, .hz-instagram-profile-head span, .hz-instagram-profile-head p { display: block; }
  .hz-instagram-profile-head strong { color: #f8fafc; font-size: 14px; }
  .hz-instagram-profile-head span { margin-top: 3px; color: #f9a8d4; font-size: 12px; }
  .hz-instagram-profile-head p { margin: 4px 0 0; color: #cbd5e1; font-size: 11px; line-height: 1.4; white-space: pre-wrap; max-height: 32px; overflow: hidden; }
  .hz-instagram-profile-head > a { flex: 0 0 auto; padding: 9px 12px; border-radius: 10px; color: #fff; background: linear-gradient(135deg, #ec4899, #8b5cf6); text-decoration: none; font-size: 11px; font-weight: 800; }
  .hz-instagram-profile-stats { display: flex; gap: 18px; margin: 10px 0; padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; font-size: 10px; }
  .hz-instagram-profile-stats b { color: #f8fafc; font-size: 14px; margin-left: 4px; }
  .hz-instagram-featured-media { position: relative; display: block; width: 100%; margin: 0; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 13px; background: #020617; }
  .hz-instagram-featured-media img, .hz-instagram-featured-media video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hz-instagram-featured-media > span { position: absolute; right: 12px; bottom: 12px; padding: 7px 10px; border-radius: 9px; color: #fff; background: rgba(2,6,23,0.78); font-size: 11px; }
  .hz-instagram-dots { display: flex; justify-content: center; gap: 6px; margin-top: 10px; }
  .hz-instagram-dots button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 50%; background: #475569; cursor: pointer; }
  .hz-instagram-dots button.active { width: 20px; border-radius: 99px; background: #f472b6; }
  .hz-instagram-featured-actions { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 8px; }
  .hz-instagram-featured-actions > button, .hz-instagram-featured-actions > a { padding: 6px 10px; border: 1px solid rgba(244,114,182,0.35); border-radius: 9px; color: #fbcfe8; background: rgba(244,114,182,0.1); font-size: 11px; cursor: pointer; text-decoration: none; }
  .hz-social-arrow { margin-right: auto; color: var(--social-color); font-size: 20px; }
  .hz-store-intro { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin: 0 0 18px; padding: 0 4px; }
  .hz-store-intro-copy { min-width: 0; }
  .hz-store-kicker { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 8px; color: #67e8f9; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; }
  .hz-store-kicker::before { content: ''; width: 24px; height: 2px; border-radius: 999px; background: linear-gradient(90deg, #38bdf8, #f59e0b); }
  .hz-store-intro h2 { margin: 0 0 6px !important; font-size: clamp(22px, 3vw, 32px) !important; line-height: 1.15; color: #f8fafc !important; text-shadow: 0 6px 24px rgba(56,189,248,0.16); }
  .hz-store-intro p { margin: 0 !important; max-width: 720px; color: #94a3b8 !important; line-height: 1.7; }
  .hz-catalog-count { flex: 0 0 auto; padding: 10px 14px; border: 1px solid rgba(52,211,153,0.25); border-radius: 14px; color: #a7f3d0; background: rgba(16,185,129,0.08); font-size: 12px; font-weight: 800; white-space: nowrap; }
  .hz-category-glass-bar { border-radius: 20px; padding: 14px 16px; margin-bottom: 22px; box-shadow: 0 14px 34px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.16); }
  .hz-category-chip { border-radius: 14px; padding: 8px 14px; }
  .hz-category-chip.active { box-shadow: 0 8px 20px rgba(37,99,235,0.25), inset 0 1px 0 rgba(255,255,255,0.2); }
  .hz-grid { gap: clamp(14px, 1.8vw, 22px); }
  .hz-product-card { border-radius: 22px; box-shadow: 0 16px 38px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.24); }
  .hz-product-card:hover { transform: translateY(-6px) scale(1.01); }
  .hz-add-btn { border-radius: 13px !important; font-weight: 800; box-shadow: 0 8px 18px rgba(16,185,129,0.16); }
  .hz-atmosphere {
    background:
      radial-gradient(ellipse 800px 500px at 10% -5%, rgba(249,115,22,0.38), transparent 55%),
      radial-gradient(ellipse 700px 500px at 95% 0%, rgba(56,189,248,0.35), transparent 55%),
      radial-gradient(ellipse 900px 600px at 50% 105%, rgba(168,85,247,0.30), transparent 55%),
      radial-gradient(ellipse 500px 350px at 25% 55%, rgba(16,185,129,0.20), transparent 60%),
      #05060a;
  }

  /* ================= إصلاحات الأداء (بدون أي تغيير بالشكل) ================= */
  /* بطاقة فيها صورة: الصورة تغطيها بالكامل، فالبلور تحتها مش ظاهر أصلاً → نوقفه (الشكل نفسه تماماً) */
  .hz-product-card.hz-has-img { backdrop-filter: none; -webkit-backdrop-filter: none; }
  /* زر "أضف للسلة": خلفيته خضراء معتمة، فالبلور فيه مش ظاهر */
  .hz-add-btn { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  /* لا نستخدم content-visibility هنا لأنه يسبب قفزات وتعليقاً في بعض متصفحات الهاتف أثناء التمرير */
  .hz-grid { min-width: 0; touch-action: pan-y; overscroll-behavior-y: contain; }
  .hz-product-card { min-width: 0; touch-action: pan-y; }
  /* شات البوت: بلور داخل بلور (الخلفية تحته نفس اللون) → ما بيظهر فرق بس بيكلّف كتير */
  .hz-bot-inner-panel, .hz-bot-bubble-user, .hz-bot-bubble-bot, .hz-bot-input {
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  }
  /* على اللمس: hover بيعلق ويسبب لاج، فنلغي حركته فقط (على الماوس يبقى كما هو) */
  @media (hover: none), (pointer: coarse) {
    .hz-product-card::before { display: none; }
    .hz-product-card:hover { transform: none; border-color: rgba(255,255,255,0.2); box-shadow: 0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3); }
    .hz-product-card:hover .hz-product-media img { transform: none; }
    .hz-glass-btn:hover, .hz-category-chip:hover { transform: none; }
  }

  /* ================= تجاوب الأبعاد مع كل الأجهزة ================= */
  .hz-container { width: 100%; max-width: none; min-width: 0; margin: 0; }
  /* لا تمدد الأقسام الفارغة إلى طول الشاشة؛ كل قسم يتبع محتواه فقط */
  .hz-root, .hz-root > .hz-container, .hz-root > .hz-container > * { min-height: 0 !important; }
  .hz-grid {
    display: grid; width: 100%; box-sizing: border-box;
    grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
    gap: clamp(12px, 2vw, 24px);
  }
  /* تابلت */
  @media (min-width: 560px) and (max-width: 1023px) {
    .hz-hero-frame { height: clamp(280px, 54vw, 560px); }
  }
  /* تجاوب شامل للهواتف الكبيرة والتابلت والشاشات المتوسطة */
  @media (max-width: 1023px) {
    .hz-store-header { flex-wrap: wrap; width: 100%; }
    .hz-store-brand { min-width: 0; }
    .hz-header-controls { min-width: 0; max-width: 100%; flex: 1 1 100%; flex-wrap: wrap; }
    .hz-header-controls > div { min-width: 0; max-width: 100%; flex-wrap: wrap; }
    .hz-store-intro { align-items: stretch; flex-direction: column; }
    .hz-catalog-count { align-self: flex-start; }
    .hz-checkout-form, .hz-category-glass-bar, .hz-social-section, .hz-store-footer { max-width: 100%; min-width: 0; }
    .hz-social-card, .hz-social-profile-copy, .hz-instagram-live-panel { min-width: 0; }
    .hz-social-card strong, .hz-social-card small { overflow-wrap: anywhere; }
  }
  /* موبايل */
  @media (max-width: 559px) {
    .hz-store-header { border-radius: 18px; padding: 10px !important; }
    .hz-hero-frame { height: clamp(230px, 66vw, 340px); min-height: 0; border-radius: 18px; margin-bottom: 12px; }
    .hz-hero-arrow { width: 36px; height: 36px; font-size: 18px; }
    .hz-hero-arrow.prev { inset-inline-start: 8px; }
    .hz-hero-arrow.next { inset-inline-end: 8px; }
    .hz-store-intro { display: block; }
    .hz-catalog-count { display: inline-flex; margin-top: 12px; }
    .hz-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%; }
    .hz-category-glass-bar { padding: 12px; border-radius: 16px; }
    .hz-category-glass-bar > div:first-child { width: 100%; margin: 0 0 4px !important; }
    .hz-category-glass-bar > div:last-child { display: flex !important; flex-wrap: nowrap !important; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; padding: 2px 1px 5px; }
    .hz-category-glass-bar > div:last-child::-webkit-scrollbar { display: none; }
    .hz-category-chip { flex: 0 0 auto; min-height: 42px; padding: 9px 12px; white-space: nowrap; }
    /* بطاقات مضغوطة عشان تكفي عمودين جنب بعض بالموبايل */
    .hz-product-card { border-radius: 18px; padding: 10px; }
    .hz-product-body { padding: 8px !important; min-height: 135px; }
    .hz-product-body h3 { font-size: 13px !important; line-height: 1.3; margin-bottom: 6px !important;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .hz-product-body p { font-size: 11px !important; margin-bottom: 8px !important;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .hz-product-glasschip { font-size: 10px !important; padding: 3px 7px !important; }
    .hz-price-row { flex-wrap: wrap; gap: 8px !important; margin-top: 8px !important; padding-top: 10px !important; }
    .hz-price-row .hz-add-btn { flex: 1 1 calc(50% - 4px); min-width: 0; padding: 9px 6px !important; font-size: 12px !important; }
    .hz-root input, .hz-root textarea, .hz-root select { font-size: 16px !important; }
    .hz-header-wallet { width: auto; justify-content: center; order: initial; }
    .hz-redeem-form input { width: 120px; }
    .hz-social-grid { grid-template-columns: minmax(0, 1fr); }
    .hz-support-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
    .hz-support-grid .hz-glass-card { padding: 10px !important; }
    .hz-social-heading { align-items: start; flex-direction: column; }
    .hz-store-header { padding: 8px 10px !important; gap: 8px; flex-wrap: wrap; overflow: hidden; width: 100%; box-sizing: border-box; }
    .hz-store-brand { gap: 6px; flex: 1 1 100%; width: 100%; min-width: 0; }
    .hz-store-brand img { width: 88px !important; max-height: 42px !important; }
    .hz-store-brand span { font-size: 12px !important; max-width: 80px; }
    .hz-header-controls { gap: 5px; width: 100%; min-width: 0; max-width: 100%; flex: 1 1 100%; flex-wrap: wrap; overflow: hidden; }
    .hz-header-controls > div { width: 100%; min-width: 0; flex-wrap: wrap !important; gap: 5px !important; }
    .hz-header-controls .hz-admin-btn { padding: 7px 8px !important; font-size: 11px !important; max-width: 100%; }
    .hz-header-controls .hz-header-wallet { max-width: 100%; }
    .hz-header-controls > div { justify-content: stretch; }
    .hz-header-controls > div > .hz-cart-shell { flex: 1 1 auto; }
    .hz-header-controls > div > .hz-cart-shell > button { width: 100%; justify-content: center; min-height: 44px; }
    .hz-header-controls > div > .hz-header-wallet { flex: 1 1 100%; justify-content: center; }
    .hz-header-controls > div > .hz-header-wallet .hz-header-balances { justify-content: center; }
    .hz-redeem-form { width: 100%; justify-content: center; }
    .hz-redeem-form input { flex: 1 1 auto; width: auto; min-width: 0; min-height: 42px; }
    .hz-redeem-form button { min-height: 42px; }
    .hz-cart-menu { position: fixed !important; left: 10px !important; right: 10px !important; width: auto !important; max-height: min(72dvh, 560px) !important; padding: 12px !important; }
    .hz-cart-menu > div > div { align-items: stretch !important; }
    .hz-cart-menu > div > div > div:last-child { flex-wrap: wrap; }
    .hz-cart-menu .hz-checkout-btn { min-height: 44px; width: 100%; }
    .hz-store-intro { margin-bottom: 14px; }
    .hz-store-intro h2 { font-size: 22px !important; }
    .hz-store-intro p { font-size: 13px; }
    .hz-social-card { min-height: 74px; padding: 12px; }
    .hz-instagram-media-grid { gap: 7px; }
  }
  @media (max-width: 380px) {
    .hz-store-brand span { max-width: 68px; }
    .hz-product-body { min-height: 178px; }
    .hz-price-row .hz-add-btn { flex-basis: 100%; }
  }
  @media (max-width: 559px) {
    .hz-checkout-form { padding: 14px !important; border-radius: 16px !important; gap: 14px !important; }
    .hz-checkout-form > div:first-child { align-items: flex-start !important; gap: 10px !important; }
    .hz-checkout-form > div:first-child h3 { font-size: 16px !important; line-height: 1.45; }
    .hz-checkout-form > div:first-child p { font-size: 12px !important; overflow-wrap: anywhere; }
    .hz-checkout-form > div:nth-child(2) { grid-template-columns: minmax(0, 1fr) !important; }
    .hz-checkout-form .hz-pay-card { min-height: 58px; }
    .hz-checkout-form > div:last-child { flex-direction: column; }
    .hz-checkout-form > div:last-child button { width: 100%; min-height: 46px; }
    .hz-checkout-form .hz-cancel-btn { width: 100%; }
    .hz-order-tracker-form { flex-direction: column; }
    .hz-order-tracker-form input, .hz-order-tracker-form button { width: 100%; min-height: 44px; }
  }
  /* تابلت / آيباد */
  @media (min-width: 560px) and (max-width: 1023px) { .hz-grid { grid-template-columns: repeat(3, 1fr); } }
  /* لابتوب */
  @media (min-width: 1024px) and (max-width: 1439px) { .hz-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  /* كمبيوتر */
  @media (min-width: 1440px) and (max-width: 1919px) { .hz-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
  /* شاشات كبيرة / تلفزيون / بلايستيشن */
  @media (min-width: 1920px) { .hz-root { zoom: 1; } .hz-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
  @media (min-width: 2560px) { .hz-root { zoom: 1; } .hz-grid { grid-template-columns: repeat(6, 1fr); } }
  /* أزرار مريحة للمس */
  @media (pointer: coarse) { .hz-category-chip, .hz-add-btn, .hz-root button { min-height: 44px; } }
  /* تركيز واضح للكيبورد والريموت */
  .hz-root button:focus-visible, .hz-root input:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
`;

export default function Storefront({ inputStyle = {}, onOpenDashboard = () => {} }) {
  const { token, products: globalProducts, setProducts: setGlobalProducts, settings = {}, globalEventBus, handleForgotPasswordRequest: globalForgot, forgotPasswordSent, forgotPasswordSubmitting, loginError } = useApp();
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const socketRef = useRef(null);

  const [trackerOrderId, setTrackerOrderId] = useState('');
  const [orderStatusResult, setOrderStatusResult] = useState(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [sensitiveSyncStatus, setSensitiveSyncStatus] = useState('متصل وآمن 🔒');

  const heroMediaItems = useMemo(() => {
    const configured = Array.isArray(settings.heroMediaItems) ? settings.heroMediaItems : [];
    const items = configured.map((item) => typeof item === 'string' ? item : item?.url).map((url) => String(url || '').trim()).filter(Boolean);
    return items.length ? items : [String(settings.heroMediaUrl || '/hero-banner.png').trim() || '/hero-banner.png'];
  }, [settings.heroMediaItems, settings.heroMediaUrl]);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroMedia = heroMediaItems[heroIndex % heroMediaItems.length];
  const heroIsVideo = /[.]mp4($|[?#])|[.]webm($|[?#])|[.]mov($|[?#])/i.test(heroMedia);


  useEffect(() => {
    if (heroMediaItems.length < 2) return undefined;
    const timer = window.setInterval(() => setHeroIndex((index) => (index + 1) % heroMediaItems.length), 7000);
    return () => window.clearInterval(timer);
  }, [heroMediaItems.length]);

  const moveHero = (direction) => setHeroIndex((index) => (index + direction + heroMediaItems.length) % heroMediaItems.length);

  const api = useMemo(() => {
    try {
      const safeToken = typeof token === 'string' ? token.trim() : '';
      return axios.create({
        baseURL: API_BASE_URL,
        timeout: 10000,
        headers: safeToken ? { 'Authorization': `Bearer ${safeToken}` } : {}
      });
    } catch (e) {
      return axios.create({ baseURL: API_BASE_URL, timeout: 10000 });
    }
  }, [token]);

  const { products: localProducts, loading, searchTerm, setSearchTerm, fetchProducts } = useProducts({ api, setError });

  useEffect(() => {
    try {
      const key = 'hamza_visitor_session';
      let sessionId = sessionStorage.getItem(key);
      if (!sessionId) {
        sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(key, sessionId);
      }
      fetch(`${API_BASE_URL}/analytics/visit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, path: window.location.pathname, referrer: document.referrer }) }).catch(() => {});
    } catch { /* عداد الزيارات لا يجب أن يعطل واجهة المتجر */ }
  }, []);

  const products = useMemo(() => {
    return (globalProducts && globalProducts.length > 0) ? globalProducts : localProducts;
  }, [globalProducts, localProducts]);

  const authCart = useAuthCart({ api, fetchProducts, searchTerm, setError });

  // 🔄 WebSocket & Global Event Bus Integration
  useEffect(() => {
    const safeToken = typeof token === 'string' ? token.trim() : '';

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // ✅ fallback للـ polling
      auth: { token: safeToken },
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('UPDATE_DATA', (data) => {
      if (data && (data.type === 'PRODUCTS' || data.type === 'REFRESH_ALL')) {
        if (typeof fetchProducts === 'function') fetchProducts();
      }
    });

    socket.on('PRODUCT_UPDATED', () => {
      if (typeof fetchProducts === 'function') fetchProducts();
    });

    socket.on('PRODUCT_DELETED', () => {
      if (typeof fetchProducts === 'function') fetchProducts();
    });

    socket.on('SENSITIVE_DATA_UPDATED', () => {
      setSensitiveSyncStatus('⚡ تم مزامنة الملفات الحساسة لحظياً');
      if (typeof fetchProducts === 'function') fetchProducts();
      setTimeout(() => setSensitiveSyncStatus('متصل وآمن 🔒'), 3000);
    });

    socket.on('ADMIN_SYNC', () => {
      if (typeof fetchProducts === 'function') fetchProducts();
    });

    let unsubscribeBus = () => {};
    if (globalEventBus && typeof globalEventBus.subscribe === 'function') {
      unsubscribeBus = globalEventBus.subscribe('GLOBAL_SYNC_EVENT', (payload) => {
        if (payload && payload.key === 'products' && Array.isArray(payload.value)) {
          if (typeof setGlobalProducts === 'function') {
            setGlobalProducts(payload.value);
          }
        }
      });
    }

    return () => {
      socket.disconnect();
      unsubscribeBus();
    };
  }, [fetchProducts, token, globalEventBus, setGlobalProducts]);

  const categories = useMemo(() => {
    const set = new Set(['all']);
    if (Array.isArray(products)) {
      products.forEach(p => {
        if (isPublishedProduct(p) && p.category) {
          const cleanCat = String(p.category).trim();
          if (cleanCat) set.add(cleanCat);
        }
      });
    }
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter(p => {
      if (!isPublishedProduct(p)) return false;
      if (selectedCategory === 'all') return true;

      return String(p.category || '').trim() === String(selectedCategory).trim();
    });
  }, [products, selectedCategory]);

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    if (!trackerOrderId.trim()) return;
    setTrackerLoading(true);
    setOrderStatusResult(null);
    try {
      const res = await api.get(`/orders/${trackerOrderId.trim()}`);
      setOrderStatusResult(res.data);
    } catch (err) {
      setOrderStatusResult({ error: 'لم يتم العثور على طلب بهذا الرقم، تأكد من البيانات المدخلة.' });
    } finally {
      setTrackerLoading(false);
    }
  };

  const resetParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const resetEmail = resetParams?.get('email') || '';
  const resetToken = resetParams?.get('token') || '';
  if (typeof window !== 'undefined' && window.location.pathname === '/reset-password' && resetEmail && resetToken) {
    return (
      <div style={{ minHeight: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f19', padding: '20px', boxSizing: 'border-box' }} dir="rtl">
        <ResetPasswordPage authCart={authCart} email={resetEmail} token={resetToken} />
      </div>
    );
  }

  if (authCart && authCart.showLoginPage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#0b0f19', padding: '20px', boxSizing: 'border-box' }} dir="rtl">
        {!authCart.showForgotPassword ? (
          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <LoginPage
              onLoginSuccess={() => authCart.setShowLoginPage(false)}
              authCart={authCart}
            />
            <button
              type="button"
              onClick={() => { if (typeof authCart.setShowForgotPassword === 'function') authCart.setShowForgotPassword(true); }}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '13px', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold' }}
            >
              نسيت كلمة المرور؟ 🔄
            </button>
          </div>
        ) : (
          <div className="hz-glass-card" style={{ padding: '30px', width: '100%', maxWidth: '420px', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '18px' }}>🔄 استعادة كلمة المرور الفورية</h3>
            {forgotPasswordSent ? (
              <div>
                <p style={{ color: '#34d399', fontSize: '13px', lineHeight: '1.6' }}>✅ تم إرسال رابط حقيقي وفعلي لإعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.</p>
                <button
                  onClick={() => {
                    if (typeof authCart.setShowForgotPassword === 'function') authCart.setShowForgotPassword(false);
                  }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', width: '100%', marginTop: '15px', fontWeight: 'bold' }}
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const emailInput = e.target.elements.resetEmail ? e.target.elements.resetEmail.value : '';
                    if (typeof globalForgot === 'function') {
                      await globalForgot(emailInput);
                    } else if (typeof authCart.handleForgotPasswordRequest === 'function') {
                      await authCart.handleForgotPasswordRequest(emailInput);
                    }
                  } catch (err) { console.error(err); }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}
              >
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', lineHeight: '1.5' }}>أدخل بريدك الإلكتروني المسجل لنرسل لك رسالة حقيقية لاستعادة الحساب بكامل الأمان والشكل الزجاجي.</p>
                {loginError && (
                  <div style={{ color: '#fca5a5', background: 'rgba(127, 29, 29, 0.4)', border: '1px solid #ef4444', borderRadius: '10px', padding: '10px', fontSize: '12px' }}>
                    {loginError}
                  </div>
                )}
                <input type="email" name="resetEmail" placeholder="البريد الإلكتروني..." required
                  style={{ background: 'rgba(11, 15, 25, 0.6)', border: '1px solid rgba(255,255,255,0.2)', padding: '14px', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none' }} />
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button type="submit" disabled={forgotPasswordSubmitting}
                    style={{ flex: 1, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {forgotPasswordSubmitting ? 'جاري الإرسال الفعلي...' : 'إرسال البريد الحقيقي 📧'}
                  </button>
                  <button type="button"
                    onClick={() => { if (typeof authCart.setShowForgotPassword === 'function') authCart.setShowForgotPassword(false); }}
                    style={{ background: 'rgba(75, 85, 99, 0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '14px 18px', borderRadius: '12px', cursor: 'pointer' }}>
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  if (authCart && authCart.checkoutMode) {
    return (
      <div className="hz-root" style={{ width: '100%', minHeight: '100dvh', padding: 'clamp(12px, 2vw, 24px)', boxSizing: 'border-box', color: '#f8fafc', fontFamily: 'Tajawal, sans-serif', background: 'transparent' }} dir="rtl">
        <style>{GLASS_STYLE}</style>
        <div className="hz-container" style={{ maxWidth: 'none', width: '100%' }}>
          <div className="hz-glass-btn hz-store-header" style={{ padding: '12px 18px', marginBottom: '24px', borderRadius: '18px' }}>
            <div className="hz-store-brand">
              <img src="/logo.png" alt="Hamza Store" style={{ width: '118px', height: 'auto', maxHeight: '52px', objectFit: 'contain', display: 'block' }} />
              <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '14px' }}>{settings.storeName || 'HAMZA STORE'}</span>
            </div>
            <div className="hz-header-controls">
              <HeaderControls authCart={authCart} onOpenDashboard={onOpenDashboard} />
            </div>
          </div>
          <div className="hz-glass-card" style={{ maxWidth: 'none', width: '100%', margin: '0', padding: 'clamp(14px, 3vw, 30px)', borderColor: 'rgba(16,185,129,0.45)', boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 35px rgba(16,185,129,0.08)' }}>
            <button type="button" onClick={() => { setError(''); authCart.setCheckoutMode(false); }} style={{ background: 'rgba(51,65,85,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)', padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '16px' }}>← العودة للمتجر</button>
            {error && <div role="alert" style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '14px', color: '#fecaca', background: 'rgba(127,29,29,0.72)', border: '1px solid rgba(248,113,113,0.65)', boxShadow: '0 8px 24px rgba(127,29,29,0.18)', lineHeight: 1.8, fontSize: '13px' }}>⚠️ {error}</div>}
            {!authCart.lastOrder && <CheckoutForm authCart={authCart} inputStyle={inputStyle} />}
            <OrderConfirmation authCart={authCart} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hz-root" style={{
      width: '100%',
      minHeight: '100dvh',
      padding: 'clamp(12px, 2vw, 24px)',
      paddingTop: 'max(clamp(12px, 2vw, 24px), env(safe-area-inset-top))',
      paddingBottom: 'max(clamp(12px, 2vw, 24px), env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
      color: '#f8fafc',
      fontFamily: 'Tajawal, sans-serif',
      margin: '0',
      position: 'relative'
    }} dir="rtl">

      <style>{GLASS_STYLE}</style>

      <div className="hz-container">

      <div className="hz-glass-btn hz-store-header" style={{ padding: '12px 18px', marginBottom: '20px', borderRadius: '18px' }}>
        <div className="hz-store-brand">
          <img src="/logo.png" alt="Hamza Store" style={{ width: '118px', height: 'auto', maxHeight: '52px', objectFit: 'contain', objectPosition: 'left center', display: 'block' }} />
          <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '14px' }}>{settings.storeName || 'HAMZA STORE'}</span>
          <span style={{ fontSize: '11px', padding: '3px 10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            {sensitiveSyncStatus}
          </span>
        </div>

        <div className="hz-header-controls">
          <HeaderControls authCart={authCart} onOpenDashboard={onOpenDashboard} />
        </div>
      </div>

      {!settings.hideHero && <div className="hz-hero-frame" aria-label="معرض واجهة المتجر">
        <div className="hz-hero-media active">
          {heroIsVideo ? (
            <video key={heroMedia} src={heroMedia} autoPlay muted playsInline controls onEnded={() => heroMediaItems.length > 1 && moveHero(1)} />
          ) : (
            <img src={heroMedia} alt={settings.storeName || 'Hamza Store - ألعاب وتقنية'} />
          )}
        </div>
        {heroMediaItems.length > 1 && <>
          <button type="button" className="hz-hero-arrow prev" onClick={() => moveHero(-1)} aria-label="الصورة السابقة">‹</button>
          <button type="button" className="hz-hero-arrow next" onClick={() => moveHero(1)} aria-label="الصورة التالية">›</button>
          <div className="hz-hero-dots">{heroMediaItems.map((item, index) => <button type="button" key={`${item}-${index}`} className={`hz-hero-dot${index === (heroIndex % heroMediaItems.length) ? ' active' : ''}`} onClick={() => setHeroIndex(index)} aria-label={`عرض الوسيط ${index + 1}`} />)}</div>
        </>}
      </div>}

      <CheckoutForm authCart={authCart} inputStyle={inputStyle} />
      <OrderConfirmation authCart={authCart} />

      <div className="hz-store-intro">
        <div className="hz-store-intro-copy">
        <span className="hz-store-kicker">Hamza Digital Market</span>
        <h2>
          🛍️ {settings.storeName || 'متجر بطاقات الألعاب الرقمية السحابي'}
        </h2>
        <p>{settings.storeTagline || settings.welcomeText || 'بطاقات رقمية أصلية، تسليم سريع، وتجربة شراء آمنة.'}</p>
        </div>
        <span className="hz-catalog-count">● متجر موثوق ومتصل</span>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <ProductSearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} inputStyle={inputStyle} />

      <div className="hz-category-glass-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 'bold', fontSize: '14px', marginLeft: '10px' }}>
          <span>🏷️</span>
          <span>الفئات والأقسام:</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const displayName = cat === 'all' ? 'جميع المنتجات 🌟' : cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`hz-category-chip ${isActive ? 'active' : ''}`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>جاري تحميل المنتجات السحابية...</div>
        ) : !filteredProducts.length ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>لا توجد منتجات متاحة في هذه الفئة حالياً.</div>
        ) : (
          <div className="hz-grid">
            {filteredProducts.map((product) => {
              const isOpenStoreCredit = product.deliveryType === 'store_credit';
              const stock = product.stock ?? product.quantity ?? 0;
              const originalPrice = Number(product.price ?? 0);

              const rawDiscount = product.discountPrice ?? product.salePrice ?? 0;
              const discountPrice = Number(rawDiscount);
              const hasDiscount = discountPrice > 0 && discountPrice < originalPrice;
              const displayPrice = hasDiscount ? discountPrice : originalPrice;
              const loyaltyPrice = Math.max(0, Number(product.loyaltyPrice || 0));

              const name = product.name || product.title || 'منتج رقمي';
              const imageUrl = product.image || product.imageUrl || product.img || product.photo || product.picture || '';

              return (
                <div
                  key={product._id || product.id}
                  className={`hz-product-card${imageUrl ? ' hz-has-img' : ''}`}
                  style={{ '--glow': '#10b981', padding: 0 }}
                >
                  <div className={`hz-product-media${imageUrl ? '' : ' hz-no-image'}`}>
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={name}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('hz-no-image'); }}
                      />
                    )}
                  </div>

                  <div className="hz-product-body" style={{ padding: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span className="hz-product-glasschip" style={{ fontSize: '11px', color: '#34d399', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                          المخزون: {isOpenStoreCredit ? 'مفتوح' : stock}
                        </span>
                        {hasDiscount && (
                          <span className="hz-product-glasschip" style={{ fontSize: '11px', color: '#f59e0b', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                            خصم 🔥
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: '#f8fafc', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                        {name}
                      </h3>
                      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
                        {product.description || 'بطاقة رقمية سحابية أصلية.'}
                      </p>
                    </div>

                    <div className="hz-price-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '15px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                          {displayPrice} دينار
                        </span>
                        {loyaltyPrice > 0 && <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e9d5ff' }}>أو ⭐ {loyaltyPrice} نقطة</span>}
                        {hasDiscount && (
                          <span style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through' }}>
                            {originalPrice} دينار
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => authCart && authCart.addToCart && authCart.addToCart({ ...product, price: displayPrice })}
                        className="hz-glass-btn hz-add-btn"
                        style={{
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          color: '#fff',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '13px'
                        }}
                      >
                        أضف للسلة 🛒
                      </button>
                      {loyaltyPrice > 0 && (
                        <button
                          onClick={() => authCart && authCart.addToCart && authCart.addToCart({ ...product, price: 0, loyaltyOnly: true, loyaltyPrice })}
                          className="hz-glass-btn hz-add-btn"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          شراء بالنقاط ⭐
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ maxWidth: '600px', margin: '40px auto 20px auto' }}>
        <div className="hz-glass-card" style={{ padding: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <span style={{ fontSize: '20px' }}>📦</span>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '16px' }}>التحقق الفعلي من حالة طلبك</h3>
          </div>
          <p style={{ margin: '0 0 15px 0', color: '#94a3b8', fontSize: '12px' }}>أدخل رقم الطلب لجلب حالته من قاعدة البيانات مباشرة:</p>

          <form className="hz-order-tracker-form" onSubmit={handleTrackOrder} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="أدخل رقم الطلب هنا..."
              value={trackerOrderId}
              onChange={(e) => setTrackerOrderId(e.target.value)}
              style={{
                flex: 1, background: 'rgba(11, 15, 25, 0.6)', border: '1px solid rgba(255,255,255,0.2)',
                padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '13px', outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={trackerLoading}
              className="hz-glass-btn"
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
            >
              {trackerLoading ? 'جاري البحث...' : 'بحث 🔍'}
            </button>
          </form>

          {orderStatusResult && (
            <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(15,23,42,0.7)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', fontSize: '13px' }}>
              {orderStatusResult.error ? (
                <span style={{ color: '#fca5a5' }}>{orderStatusResult.error}</span>
              ) : (
                <div>
                  <p style={{ margin: '0 0 6px 0', color: '#34d399', fontWeight: 'bold' }}>✅ حالة الطلب: {orderStatusResult.status || 'مكتمل'}</p>
                  {orderStatusResult.orderNumber && <p style={{ margin: '0 0 6px 0', color: '#cbd5e1' }}>رقم الطلب: <strong>{orderStatusResult.orderNumber}</strong></p>}
                  <p style={{ margin: 0, color: '#cbd5e1' }}>المبلغ: {orderStatusResult.totalAmount ?? orderStatusResult.price ?? 0} دينار</p>
                  {Array.isArray(orderStatusResult.items) && orderStatusResult.items.some((item) => Array.isArray(item.deliveredCodes) && item.deliveredCodes.length > 0) && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <strong style={{ color: '#34d399' }}>🔐 الأكواد الخاصة بطلبك:</strong>
                      {orderStatusResult.items.flatMap((item) => (Array.isArray(item.deliveredCodes) ? item.deliveredCodes.map((code, index) => (
                        <code key={`${item.id || item.name}-${index}`} dir="ltr" style={{ display: 'block', background: '#020617', color: '#34d399', padding: '9px 10px', borderRadius: '8px', wordBreak: 'break-all', letterSpacing: '1px' }}>{code}</code>
                      )) : []))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <SupportSection api={api} currentUser={authCart && authCart.currentUser} inputStyle={inputStyle} />
      </div>

      <SocialCards cards={settings.socialCards} />

      <footer className="hz-store-footer">
        <strong>{settings.storeName || 'HAMZA STORE'}</strong>
        <span>تجربة رقمية آمنة وسريعة • جميع الحقوق محفوظة</span>
        <span>متصل وآمن 🔒</span>
      </footer>

      </div>
    </div>
  );
}
