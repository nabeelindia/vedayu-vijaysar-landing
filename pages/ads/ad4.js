// Ad Creative 4 — "How It Works" / Usage ritual — 1080×1080
const STEPS = [
  { num: '01', icon: '🌙', title: 'Fill at Night', desc: 'Pour room temperature water into your Vijaysar glass before bed' },
  { num: '02', icon: '⏳', title: 'Infuse Overnight', desc: 'Sleep while the Vijaysar wood naturally heals the water for 6–8 hours' },
  { num: '03', icon: '🌅', title: 'Drink at Dawn', desc: 'Drink the golden healing water first thing every morning on an empty stomach' },
  { num: '04', icon: '✨', title: 'Feel the Difference', desc: 'In 4–6 weeks, notice balanced blood sugar, better digestion & more energy' },
];

export default function Ad4() {
  return (
    <div style={{
      width: 1080, height: 1080, overflow: 'hidden', position: 'relative',
      background: '#2C1810',
      fontFamily: "Georgia, 'Times New Roman', serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Decorative top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: 'linear-gradient(90deg, #C9A84C, #4A7C59, #C9A84C)',
      }} />

      {/* Header */}
      <div style={{ padding: '52px 60px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 28, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif', fontWeight: 700 }}>🪵 Vedayu</div>
          <h1 style={{ color: '#fff', fontSize: 58, margin: '10px 0 0', lineHeight: 1.1 }}>How to Use Your<br/>Vijaysar Glass</h1>
        </div>
        <img
          src="/images/product.jpg"
          alt=""
          style={{ width: 200, height: 200, objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(201,168,76,0.3))' }}
        />
      </div>

      {/* Steps */}
      <div style={{ padding: '36px 60px', flex: 1, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {STEPS.map((s) => (
          <div key={s.num} style={{
            display: 'flex', alignItems: 'flex-start', gap: 28,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 16, padding: '24px 30px',
          }}>
            <div style={{
              minWidth: 64, height: 64, borderRadius: '50%',
              background: '#C9A84C', color: '#2C1810',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, fontFamily: 'system-ui, sans-serif',
            }}>{s.num}</div>
            <div style={{ fontSize: 36, marginTop: 10 }}>{s.icon}</div>
            <div>
              <div style={{ color: '#C9A84C', fontSize: 28, fontWeight: 700, fontFamily: 'system-ui, sans-serif', marginBottom: 6 }}>{s.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 22, lineHeight: 1.5, fontFamily: 'system-ui, sans-serif' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{
        margin: '0 60px 48px',
        background: 'linear-gradient(135deg, #C9A84C, #e8c96a)',
        borderRadius: 16, padding: '28px 44px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#2C1810', fontSize: 34, fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}>
            Get yours today — Starting ₹499
          </div>
          <div style={{ color: 'rgba(44,24,16,0.7)', fontSize: 22, fontFamily: 'system-ui, sans-serif', marginTop: 4 }}>
            Free delivery · Cash on Delivery · 7-day guarantee
          </div>
        </div>
        <div style={{
          background: '#2C1810', color: '#C9A84C',
          padding: '18px 36px', borderRadius: 12,
          fontSize: 28, fontWeight: 800, fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          vedayulife.com →
        </div>
      </div>
    </div>
  );
}
