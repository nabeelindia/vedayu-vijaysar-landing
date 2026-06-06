import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const LANGUAGES = [
  { code: 'en', native: 'English', hint: 'English' },
  { code: 'hi', native: 'हिन्दी', hint: 'Hindi' },
  { code: 'ta', native: 'தமிழ்', hint: 'Tamil' },
  { code: 'te', native: 'తెలుగు', hint: 'Telugu' },
];

export default function LanguageWelcomeModal() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vedayu_lang');
      if (!stored) setShow(true);
    } catch (_) {}
  }, []);

  const choose = (code) => {
    try { localStorage.setItem('vedayu_lang', code); } catch (_) {}
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`;
    setShow(false);
    if (code !== router.locale) {
      router.replace(router.asPath, router.asPath, { locale: code, scroll: false });
    }
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.55)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 18,
        padding: '28px 24px',
        width: '100%',
        maxWidth: 340,
        boxShadow: '0 12px 48px rgba(0,0,0,.28)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🌿</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#5C3D1E' }}>
          Choose your language
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999', lineHeight: 1.6 }}>
          अपनी भाषा चुनें&nbsp;·&nbsp;மொழியை தேர்ந்தெடு&nbsp;·&nbsp;భాష ఎంచుకోండి
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => choose(lang.code)}
              style={{
                background: '#f9f4ee',
                border: '2px solid #d0c4b0',
                borderRadius: 12,
                padding: '13px 16px',
                fontSize: 17,
                fontWeight: 700,
                color: '#5C3D1E',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background .15s, border-color .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#4A7C59';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = '#4A7C59';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#f9f4ee';
                e.currentTarget.style.color = '#5C3D1E';
                e.currentTarget.style.borderColor = '#d0c4b0';
              }}
            >
              <span>{lang.native}</span>
              <span style={{ fontSize: 13, opacity: .6, fontWeight: 500 }}>{lang.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
