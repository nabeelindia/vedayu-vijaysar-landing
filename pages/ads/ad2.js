// Ad Creative 2 — "Social Proof / Testimonial" — 1080×1080
export default function Ad2() {
  return (
    <div style={{
      width: 1080, height: 1080, overflow: 'hidden', position: 'relative',
      background: '#FAF5E4',
      fontFamily: "Georgia, 'Times New Roman', serif",
    }}>
      {/* Brown header bar */}
      <div style={{
        background: '#5C3D1E',
        padding: '40px 60px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 26, fontWeight: 700, fontFamily: 'system-ui, sans-serif', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>🪵 Vedayu</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20, fontFamily: 'system-ui, sans-serif' }}>Vijaysar Wooden Glass</div>
        </div>
        <div style={{
          background: '#4A7C59', color: '#fff',
          padding: '16px 32px', borderRadius: 50,
          fontSize: 24, fontWeight: 700, fontFamily: 'system-ui, sans-serif',
        }}>
          ✅ Verified Purchase
        </div>
      </div>

      {/* Stars */}
      <div style={{ textAlign: 'center', padding: '44px 60px 0' }}>
        <div style={{ fontSize: 56, letterSpacing: 8, marginBottom: 16 }}>⭐⭐⭐⭐⭐</div>
        <div style={{ color: '#5C3D1E', fontSize: 26, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>5.0 out of 5 · Based on 5,000+ verified orders</div>
      </div>

      {/* Main quote */}
      <div style={{
        margin: '44px 60px',
        background: '#fff', borderRadius: 20,
        border: '2px solid #D4B896',
        padding: '44px 52px',
        position: 'relative',
      }}>
        <div style={{ fontSize: 80, color: '#C9A84C', lineHeight: 0.6, marginBottom: 24, fontFamily: 'Georgia, serif' }}>"</div>
        <p style={{
          fontSize: 38, lineHeight: 1.5, color: '#2C1810',
          margin: '0 0 28px', fontStyle: 'italic',
        }}>
          My fasting sugar dropped from 148 to 112 in just 6 weeks. I fill the glass every night and drink the water first thing in the morning. It's become my daily ritual.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src="https://i.pravatar.cc/80?img=47" alt="" style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid #C9A84C', objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#3D2610', fontFamily: 'system-ui, sans-serif' }}>Sunita Sharma</div>
            <div style={{ fontSize: 22, color: '#6B4C2A', fontFamily: 'system-ui, sans-serif' }}>Jaipur, Rajasthan · Pack of 2</div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        margin: '0 60px',
        display: 'flex', gap: 24, alignItems: 'center',
      }}>
        <img src="/images/product.jpg" alt="" style={{ width: 160, height: 160, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#2C1810', marginBottom: 10, fontFamily: 'system-ui, sans-serif' }}>
            Try it yourself — risk free
          </div>
          <div style={{ fontSize: 26, color: '#5C3D1E', marginBottom: 20, fontFamily: 'system-ui, sans-serif' }}>
            7-day replacement guarantee · Free delivery all India
          </div>
          <div style={{
            display: 'inline-block',
            background: '#5C3D1E', color: '#fff',
            padding: '18px 40px', borderRadius: 10,
            fontSize: 30, fontWeight: 800, fontFamily: 'system-ui, sans-serif',
          }}>
            Order Now — Starting ₹499
          </div>
        </div>
      </div>

      {/* vedayulife.com footer */}
      <div style={{
        position: 'absolute', bottom: 22, left: 0, right: 0,
        textAlign: 'center', color: '#9a7c5a', fontSize: 20,
        fontFamily: 'system-ui, sans-serif',
      }}>
        vedayulife.com · Cash on Delivery Available
      </div>
    </div>
  );
}
