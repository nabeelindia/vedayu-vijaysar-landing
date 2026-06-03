// Ad Creative 5 — "Cart Recovery" — BOFU Retargeting — 1080×1080
export default function Ad5() {
  return (
    <div style={{
      width: 1080, height: 1080, overflow: 'hidden', position: 'relative',
      background: '#1A0F06',
      fontFamily: "Georgia, 'Times New Roman', serif",
    }}>
      {/* Warm glow background */}
      <div style={{
        position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(90,50,15,0.8) 0%, transparent 70%)',
      }} />

      {/* Urgency banner at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: '#C9A84C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '22px 40px', gap: 20,
      }}>
        <span style={{ fontSize: 36 }}>⚡</span>
        <span style={{
          color: '#3D2610', fontSize: 32, fontWeight: 800,
          fontFamily: 'system-ui, sans-serif', letterSpacing: 1,
        }}>
          YOU LEFT SOMETHING BEHIND
        </span>
        <span style={{ fontSize: 36 }}>⚡</span>
      </div>

      {/* Product with glow */}
      <div style={{
        position: 'absolute', right: 60, top: 140, bottom: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 440,
      }}>
        <div style={{
          position: 'absolute',
          width: 380, height: 380, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.45) 0%, transparent 70%)',
        }} />
        <img
          src="/images/product.jpg"
          alt="Vijaysar Wooden Glass"
          style={{
            width: 360, height: 360, objectFit: 'contain',
            position: 'relative', zIndex: 1,
            filter: 'drop-shadow(0 20px 60px rgba(201,168,76,0.4))',
          }}
        />
        {/* Stock badge */}
        <div style={{
          position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          background: '#C0392B', color: '#fff',
          padding: '10px 24px', borderRadius: 50,
          fontSize: 22, fontWeight: 700, fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'nowrap', zIndex: 2,
        }}>
          🔥 Only 47 left in stock
        </div>
      </div>

      {/* Left content */}
      <div style={{ position: 'absolute', left: 52, top: 145, right: 520, display: 'flex', flexDirection: 'column' }}>
        <p style={{
          color: '#C9A84C', fontSize: 26, fontWeight: 700,
          fontFamily: 'system-ui, sans-serif', letterSpacing: 2,
          textTransform: 'uppercase', margin: '0 0 16px',
        }}>
          Vijaysar Wooden Glass
        </p>

        <h1 style={{
          color: '#fff', fontSize: 68, lineHeight: 1.08,
          margin: '0 0 28px', fontWeight: 700,
        }}>
          Your<br/>health<br/>can't<br/>wait.
        </h1>

        {/* What they'll miss */}
        <div style={{ margin: '0 0 32px' }}>
          {[
            '🩸 Manage blood sugar naturally',
            '💧 Ancient Ayurvedic healing',
            '🚚 Free delivery to your door',
            '💵 Pay on delivery — zero risk',
          ].map(item => (
            <div key={item} style={{
              color: 'rgba(255,255,255,0.88)', fontSize: 24,
              fontFamily: 'system-ui, sans-serif', marginBottom: 10,
            }}>
              {item}
            </div>
          ))}
        </div>

        {/* Price block */}
        <div style={{
          background: 'rgba(201,168,76,0.12)', border: '2px solid #C9A84C',
          borderRadius: 16, padding: '20px 28px', marginBottom: 28,
          display: 'inline-block',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ color: '#C9A84C', fontSize: 52, fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}>
              ₹499
            </span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 32, fontFamily: 'system-ui, sans-serif', textDecoration: 'line-through' }}>
              ₹799
            </span>
            <span style={{ color: '#4CAF50', fontSize: 26, fontWeight: 700, fontFamily: 'system-ui, sans-serif' }}>
              38% OFF
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, fontFamily: 'system-ui, sans-serif', marginTop: 4 }}>
            Free shipping · Cash on delivery
          </div>
        </div>

        {/* CTA button */}
        <div style={{
          background: 'linear-gradient(135deg, #C9A84C 0%, #E8C76A 100%)',
          color: '#3D2610', borderRadius: 14,
          padding: '22px 40px', fontSize: 30, fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 8px 32px rgba(201,168,76,0.5)',
          display: 'inline-block', letterSpacing: 0.5,
        }}>
          Complete My Order →
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(201,168,76,0.08)', borderTop: '1px solid rgba(201,168,76,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '18px 52px',
      }}>
        {['⭐ 5,000+ Happy Families', '🔒 Secure Checkout', '🌿 100% Natural'].map(item => (
          <span key={item} style={{
            color: 'rgba(255,255,255,0.65)', fontSize: 22,
            fontFamily: 'system-ui, sans-serif',
          }}>{item}</span>
        ))}
      </div>
    </div>
  );
}
