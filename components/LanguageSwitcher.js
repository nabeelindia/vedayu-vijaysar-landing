import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English'  },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी'    },
  { code: 'ta', label: 'Tamil',    native: 'தமிழ்'    },
  { code: 'te', label: 'Telugu',   native: 'తెలుగు'   },
];

export default function LanguageSwitcher() {
  const router          = useRouter();
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);
  const current         = LANGUAGES.find(l => l.code === router.locale) || LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const switchTo = (code) => {
    if (code === router.locale) { setOpen(false); return; }
    // Persist preference
    try { localStorage.setItem('vedayu_lang', code); } catch (_) {}
    // Set NEXT_LOCALE cookie (SSR picks it up on next request)
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`;
    router.push(router.asPath, router.asPath, { locale: code, scroll: false });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Switch language"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: '1.5px solid #d0c4b0',
          borderRadius: 20,
          padding: '3px 10px',
          fontSize: '.78rem',
          fontWeight: 700,
          color: '#5C3D1E',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}
      >
        🌐 {current.native} ▾
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          zIndex: 9999,
          background: '#fff',
          border: '1.5px solid #d0c4b0',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,.13)',
          minWidth: 140,
          overflow: 'hidden',
          top: ref.current
            ? ref.current.getBoundingClientRect().bottom + window.scrollY + 4
            : 50,
          left: ref.current
            ? Math.max(8, ref.current.getBoundingClientRect().left + window.scrollX - 40)
            : 'auto',
          right: ref.current
            ? 'auto'
            : 8,
        }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => switchTo(lang.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '9px 14px',
                background: lang.code === router.locale ? '#FFF8E1' : 'none',
                border: 'none',
                borderBottom: '1px solid #f5efe6',
                fontSize: '.85rem',
                fontWeight: lang.code === router.locale ? 700 : 500,
                color: '#2C1810',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{lang.native}</span>
              {lang.code === router.locale && <span style={{ color: '#4A7C59', fontSize: '.8rem' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
