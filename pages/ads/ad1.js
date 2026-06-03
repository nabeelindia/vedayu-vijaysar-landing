// Ad Creative 1 — "Morning Ritual" — Product Hero — 1080×1080
export default function Ad1() {
  return (
    <div style={{
      width: 1080, height: 1080, overflow: 'hidden', position: 'relative',
      background: 'linear-gradient(145deg, #3D2610 0%, #5C3D1E 45%, #7A5230 100%)',
      fontFamily: "Georgia, 'Times New Roman', serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top badge */}
      <div style={{
        position: 'absolute', top: 52, left: 52,
        background: '#C9A84C', color: '#3D2610',
        fontSize: 28, fontWeight: 800, fontFamily: 'system-ui, sans-serif',
        padding: '10px 28px', borderRadius: 50, letterSpacing: 1,
      }}>
        🌿 100% NATURAL AYURVEDA
      </div>

      {/* Product image - centered */}
      <div style={{
        position: 'absolute', right: 60, top: 100, bottom: 80,
        width: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Glow behind product */}
        <div style={{
          position: 'absolute',
          width: 420, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)',
        }} />
        <img
          src="/images/product.jpg"
          alt="Vijaysar Wooden Glass"
          style={{ width: 400, height: 400, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))' }}
        />
      </div>

      {/* Left text block */}
      <div style={{ position: 'absolute', left: 52, top: 140, width: 520 }}>
        <p style={{
          color: '#C9A84C', fontSize: 30, margin: '0 0 18px',
          fontFamily: 'system-ui, sans-serif', fontWeight: 600, letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          Vijaysar Wooden Glass
        </p>
        <h1 style={{
          color: '#fff', fontSize: 80, lineHeight: 1.05,
          margin: '0 0 32px', fontWeight: 700,
        }}>
          Your<br/>Morning<br/>Just Got<br/>Healthier
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.82)', fontSize: 28, lineHeight: 1.55,
          margin: '0 0 40px',
          fontFamily: 'system-ui, sans-serif', fontWeight: 400,
        }}>
          Infuse your water with ancient<br/>Ayurvedic healing overnight.
        </p>

        {/* Benefit pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 44 }}>
          {['Blood Sugar', 'Digestion', 'Cholesterol', 'Immunity'].map(b => (
            <span key={b} style={{
              background: 'rgba(201,168,76,0.18)', border: '1.5px solid #C9A84C',
              color: '#C9A84C', borderRadius: 50,
              padding: '8px 22px', fontSize: 22,
              fontFamily: 'system-ui, sans-serif', fontWeight: 600,
            }}>{b}</span>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          background: '#C9A84C', color: '#3D2610',
          display: 'inline-block', padding: '20px 48px', borderRadius: 12,
          fontSize: 32, fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 8px 32px rgba(201,168,76,0.4)',
        }}>
          Shop Now — ₹499 · Free Delivery 🛒
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 52px',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 24, fontFamily: 'system-ui, sans-serif' }}>vedayulife.com</span>
        <span style={{ color: '#C9A84C', fontSize: 24, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>⭐ 5,000+ Happy Families</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 24, fontFamily: 'system-ui, sans-serif' }}>Cash on Delivery Available</span>
      </div>
    </div>
  );
}
