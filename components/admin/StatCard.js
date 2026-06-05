export default function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,.07)',
      cursor: onClick ? 'pointer' : 'default',
      flex: '1 1 140px', minWidth: 0,
    }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: color || '#1a1a1a', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '.72rem', fontWeight: 600, color: '#555', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: '.65rem', color: '#aaa', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
