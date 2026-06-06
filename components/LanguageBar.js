import { useRouter } from 'next/router';

const LANGUAGES = [
  { code: 'en', native: 'English' },
  { code: 'hi', native: 'हिन्दी' },
  { code: 'ta', native: 'தமிழ்' },
  { code: 'te', native: 'తెలుగు' },
];

export default function LanguageBar() {
  const router = useRouter();

  const switchTo = (code) => {
    if (code === router.locale) return;
    try { localStorage.setItem('vedayu_lang', code); } catch (_) {}
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`;
    router.push(router.asPath, router.asPath, { locale: code, scroll: false });
  };

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: '#4A7C59',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flexWrap: 'wrap',
    }}>
      <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, fontWeight: 600, marginRight: 4 }}>
        🌐
      </span>
      {LANGUAGES.map(lang => {
        const active = lang.code === router.locale;
        return (
          <button
            key={lang.code}
            onClick={() => switchTo(lang.code)}
            style={{
              background: active ? '#fff' : 'rgba(255,255,255,.15)',
              color: active ? '#4A7C59' : '#fff',
              border: active ? 'none' : '1.5px solid rgba(255,255,255,.45)',
              borderRadius: 20,
              padding: '7px 18px',
              fontSize: 15,
              fontWeight: 700,
              cursor: active ? 'default' : 'pointer',
              minHeight: 38,
              lineHeight: 1.3,
              transition: 'background .15s, color .15s',
            }}
          >
            {lang.native}
          </button>
        );
      })}
    </div>
  );
}
