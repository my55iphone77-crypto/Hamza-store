import React, { useEffect, useState } from 'react';

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
  const [instagramProfile, setInstagramProfile] = useState(null);
  const [instagramMedia, setInstagramMedia] = useState([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    fetch('/api/instagram/status').then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.connected) {
        setInstagramProfile(data.profile || null);
        fetch('/api/instagram/media').then((response) => response.ok ? response.json() : null).then((mediaData) => setInstagramMedia(Array.isArray(mediaData?.media) ? mediaData.media : [])).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (instagramMedia.length < 2) return undefined;
    const timer = window.setInterval(() => setFeaturedIndex((index) => (index + 1) % instagramMedia.length), 5000);
    return () => window.clearInterval(timer);
  }, [instagramMedia.length]);
  const defaults = [{ platform: 'instagram', account: '', title: '', enabled: true }, { platform: 'tiktok', account: '', title: '', enabled: true }];
  const configuredCards = Array.isArray(cards) && cards.length ? cards : defaults;
  const activeCards = configuredCards.filter((card) => card && card.enabled !== false).slice(0, 2);

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
          const actionUrl = card.platform === 'instagram' && !url ? '/api/instagram/oauth/start' : (url || '#');
          return (
            <a key={`${card.platform}-${card.account}-${index}`} className="hz-social-card" href={actionUrl} target={url ? '_blank' : undefined} rel={url ? 'noreferrer' : undefined} onClick={(event) => { if (!url && card.platform !== 'instagram') event.preventDefault(); }} style={{ '--social-color': meta.color }}>
              <span className="hz-social-icon">{meta.icon}</span>
              <span className="hz-social-copy"><strong>{card.title || `حسابنا على ${meta.label}`}</strong><small>{instagramProfile && card.platform === 'instagram' ? `متصل مباشرة • @${instagramProfile.username}` : (card.account ? `${meta.label} • ${card.account}` : `${meta.label} • اختر المنصة وسجّل الدخول`)}</small>{card.platform === 'instagram' && !instagramProfile && <span className="hz-social-login">تسجيل الدخول الرسمي</span>}</span>
              <span className="hz-social-arrow">{card.platform === 'instagram' && !instagramProfile ? '🔐' : '↗'}</span>
            </a>
          );
        })}
      </div>
      {instagramProfile && (
        <div className="hz-instagram-live-panel">
          <div className="hz-instagram-profile-head"><img src={instagramProfile.profile_picture_url || '/logo.png'} alt={instagramProfile.username} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/logo.png'; }} /><div><strong>{instagramProfile.name || instagramProfile.username}</strong><span>@{instagramProfile.username}</span><p>{instagramProfile.biography || 'حساب Instagram الرسمي'}</p></div><a href={`https://www.instagram.com/${instagramProfile.username}/`} target="_blank" rel="noreferrer">فتح Instagram ↗</a></div>
          <div className="hz-instagram-profile-stats"><span><b>{instagramProfile.media_count ?? instagramMedia.length}</b> منشور</span><span><b>{instagramProfile.followers_count ?? '—'}</b> متابع</span><span><b>{instagramProfile.follows_count ?? '—'}</b> يتابع</span></div>
          {instagramMedia.length > 0 ? <div className="hz-instagram-featured"><div className="hz-instagram-featured-media">{instagramMedia[featuredIndex].media_type === 'VIDEO' ? <video src={instagramMedia[featuredIndex].playable_url} poster={instagramMedia[featuredIndex].playable_thumbnail_url || undefined} autoPlay muted={!soundOn} loop playsInline controls /> : <img src={instagramMedia[featuredIndex].playable_url} alt={instagramMedia[featuredIndex].caption || 'Instagram post'} />}<span>{instagramMedia[featuredIndex].media_type === 'VIDEO' ? '▶ فيديو من الحساب' : 'منشور من الحساب'}</span></div><div className="hz-instagram-featured-actions"><a href={instagramMedia[featuredIndex].permalink} target="_blank" rel="noreferrer">عرض المنشور ↗</a><div className="hz-instagram-dots">{instagramMedia.map((media, index) => <button type="button" key={media.id} onClick={() => setFeaturedIndex(index)} className={index === featuredIndex ? 'active' : ''} aria-label={`عرض ${index + 1}`} />)}</div></div></div> : <p className="hz-instagram-empty">تم الربط، لكن Instagram لم يُرجع محتوى قابلًا للعرض حاليًا.</p>}
        </div>
      )}
    </section>
  );
}
