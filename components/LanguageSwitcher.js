import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

const LANGUAGES = [
  { code: 'en', native: 'EN', full: 'English' },
  { code: 'hi', native: 'हि', full: 'हिन्दी' },
  { code: 'ta', native: 'த', full: 'தமிழ்' },
  { code: 'te', native: 'తె', full: 'తెలుగు' },
];

function switchLocale(router, code) {
  if (code === router.locale) return;
  try { localStorage.setItem('vedayu_lang', code); } catch (_) {}
  document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`;
  router.push(router.asPath, router.asPath, { locale: code, scroll: false });
}

// Inline pills — for mobile drawer
function InlineSwitcher() {
  const router = useRouter();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {LANGUAGES.map(lang => {
        const active = lang.code === router.locale;
        return (
          <button
            key={lang.code}
            onClick={() => switchLocale(router, lang.code)}
            style={{
              background: active ? '#5C3D1E' : '#f5ede0',
              color: active ? '#fff' : '#5C3D1E',
              border: '1.5px solid ' + (active ? '#5C3D1E' : '#d0c4b0'),
              borderRadius: 20,
              padding: '7px 14px',
              fontSize: 14,
              fontWeight: 700,
              cursor: active ? 'default' : 'pointer',
              minHeight: 38,
              lineHeight: 1.3,
            }}
          >
            {lang.full}
          </button>
        );
      })}
    </div>
  );
}

// Dropdown — for desktop nav
function DropdownSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === router.locale) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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
          padding: '4px 10px',
          fontSize: '.82rem',
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
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          zIndex: 9999,
          background: '#fff',
          border: '1.5px solid #d0c4b0',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,.13)',
          minWidth: 130,
          overflow: 'hidden',
        }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { switchLocale(router, lang.code); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '9px 14px',
                background: lang.code === router.locale ? '#FFF8E1' : 'none',
                border: 'none',
                borderBottom: '1px solid #f5efe6',
                fontSize: '.88rem',
                fontWeight: lang.code === router.locale ? 700 : 500,
                color: '#2C1810',
                cursor: 'pointer',
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{lang.full}</span>
              {lang.code === router.locale && <span style={{ color: '#4A7C59', marginLeft: 8 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LanguageSwitcher({ inline = false }) {
  return inline ? <InlineSwitcher /> : <DropdownSwitcher />;
}
