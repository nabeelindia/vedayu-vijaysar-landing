// Ad Creative 3 — "4 Benefits" — 1080×1080
const BENEFITS = [
  { icon: '🩸', title: 'Blood Sugar', desc: 'Vijaysar bark compounds help regulate glucose metabolism naturally' },
  { icon: '🌿', title: 'Digestion', desc: 'Alkaline infused water soothes the gut and improves nutrient absorption' },
  { icon: '❤️', title: 'Cholesterol', desc: 'Clinical studies show reduced LDL cholesterol with regular use' },
  { icon: '⚖️', title: 'Weight Balance', desc: 'Supports metabolism and reduces sugar cravings over time' },
];

export default function Ad3() {
  return (
    <div style={{
      width: 1080, height: 1080, overflow: 'hidden', position: 'relative',
      background: 'linear-gradient(160deg, #F0F9F3 0%, #FAF5E4 60%, #F5EDD8 100%)',
      fontFamily: "Georgia, 'Times New Roman', serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '48px 60px 0', textAlign: 'center' }}>
        <div style={{ color: '#4A7C59', fontSize: 26, fontWeight: 700, fontFamily: 'system-ui, sans-serif', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
          🪵 Vedayu — Vijaysar Wooden Glass
        </div>
        <h1 style={{ color: '#2C1810', fontSize: 66, margin: 0, lineHeight: 1.1 }}>
          One Glass.<br/>Four Ancient Benefits.
        </h1>
        <p style={{ color: '#5C3D1E', fontSize: 28, margin: '16px 0 0', fontFamily: 'system-ui, sans-serif' }}>
          Used in Ayurveda for 3,000+ years. Backed by modern science.
        </p>
      </div>

      {/* Benefits grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 24, padding: '36px 60px',
        flex: 1,
      }}>
        {BENEFITS.map((b) => (
          <div key={b.title} style={{
            background: '#fff',
            border: '2px solid #D4B896',
            borderRadius: 20, padding: '32px 36px',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(92,61,30,0.08)',
          }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{b.icon}</div>
            <div style={{ color: '#3D2610', fontSize: 34, fontWeight: 700, marginBottom: 10, fontFamily: 'system-ui, sans-serif' }}>
              {b.title}
            </div>
            <div style={{ color: '#6B4C2A', fontSize: 23, lineHeight: 1.5, fontFamily: 'system-ui, sans-serif' }}>
              {b.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA strip */}
      <div style={{
        background: '#5C3D1E',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '28px 60px',
      }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 32, fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}>
            Starting ₹499 · Free Delivery
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 22, fontFamily: 'system-ui, sans-serif', marginTop: 4 }}>
            Cash on Delivery · 7-day replacement guarantee
          </div>
        </div>
        <div style={{
          background: '#C9A84C', color: '#3D2610',
          padding: '20px 44px', borderRadius: 12,
          fontSize: 30, fontWeight: 800, fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          Order Now 🛒
        </div>
      </div>
    </div>
  );
}
