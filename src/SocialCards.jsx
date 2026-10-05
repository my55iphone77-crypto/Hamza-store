import React from 'react';

const PLATFORM_META = {
  instagram: { label: 'Instagram', icon: '◎', color: '#f472b6', build: (value) => `https://instagram.com/${value.replace(/^@/, '')}` },
  tiktok: { label: 'TikTok', icon: '♪', color: '#67e8f9', build: (value) => `https://tiktok.com/@${value.replace(/^@/, '')}` },
  facebook: { label: 'Facebook', icon: 'f', color: '#60a5fa', build: (value) => `https://facebook.com/${value.replace(/^@/, '')}` },
  youtube: { label: 'YouTube', icon: '▶', color: '#f87171', build: (value) => `https://youtube.com/@${value.replace(/^@/, '')}` },
  telegram: { label: 'Telegram', icon: '✈', color: '#38bdf8', build: (value) => `https://t.me/${value.replace(/^@/, '')}` },
  whatsapp: { label: 'WhatsApp', icon: '◔', color: '#4ade80', build: (value) => `https://wa.me/${value.replace(/[^0-9+]/g, '')}` }
};

export const SOCIAL_PLATFORM_OPTIONS = Object.entries(PLATFORM_META).map(([value, meta]) => ({ value, ...meta }));

export function getSocialUrl(card) {
  const value = String(card?.account || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return PLATFORM_META[card?.platform]?.build(value) || value;
}

export default function SocialCards({ cards = [] }) {
  const activeCards = Array.isArray(cards) ? cards.filter((card) => card && card.enabled !== false && card.account) : [];
  if (!activeCards.length) return null;

  return (
    <section className="hz-social-section" aria-label="حسابات المتجر على المنصات">
      <div className="hz-social-heading">
        <div>
          <span className="hz-store-kicker">تابعنا وتواصل معنا</span>
          <h2>حسابات المتجر الرسمية</h2>
        </div>
        <span>اختر المنصة التي تفضلها</span>
      </div>
      <div className="hz-social-grid">
        {activeCards.slice(0, 2).map((card, index) => {
          const meta = PLATFORM_META[card.platform] || PLATFORM_META.instagram;
          const url = getSocialUrl(card);
          return (
            <a key={`${card.platform}-${card.account}-${index}`} className="hz-social-card" href={url} target="_blank" rel="noreferrer" style={{ '--social-color': meta.color }}>
              <span className="hz-social-icon">{meta.icon}</span>
              <span className="hz-social-copy"><strong>{card.title || `حسابنا على ${meta.label}`}</strong><small>{meta.label} • {card.account}</small></span>
              <span className="hz-social-arrow">↗</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
