import StatusBadge from './StatusBadge';

const fmt = n => `₹${Number(n).toLocaleString('en-IN')}`;
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtShortDate = (iso) => {
  const d = new Date(iso + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', timeZone:'Asia/Kolkata' });
};

export default function OrderCard({ order, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,.07)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      borderLeft: `4px solid ${order.method === 'cod' ? '#C9A84C' : '#4A7C59'}`,
    }}>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.88rem', color: '#5C3D1E' }}>
          {order.order_id}
        </div>
        <div style={{ fontSize: '.82rem', color: '#333', marginTop: 2 }}>
          {order.name} · {order.mobile} · {order.city}
        </div>
        <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
          {order.pack} · {fmt(order.price)} · {timeAgo(order.created_at)}
        </div>
        {order.scheduled_ship_date && (
          <div style={{ fontSize: '.72rem', color: '#4527A0', marginTop: 3, fontWeight: 600 }}>
            🗓 Ships: {fmtShortDate(order.scheduled_ship_date)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <StatusBadge status={order.status} small />
        {order.scheduled_ship_date && <StatusBadge status="scheduled" small />}
        {order.address_changed && (
          <span style={{
            fontSize: '.65rem', fontWeight: 700,
            color: '#E65100', background: '#FFF3E0',
            padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
          }}>
            📍 Address updated
          </span>
        )}
        <span style={{ fontSize: '.65rem', fontWeight: 700,
          color: order.method === 'cod' ? '#6D4C00' : order.method === 'prepaid' ? '#2E7D32' : '#5C3D1E',
          background: order.method === 'cod' ? '#FFF8E1' : order.method === 'prepaid' ? '#E8F5E9' : '#f0ede8',
          padding: '2px 7px', borderRadius: 20 }}>
          {order.method === 'cod' ? 'COD' : order.method === 'prepaid' ? 'Prepaid' : 'Free'}
        </span>
        {order.replacement_for && (
          <span style={{
            fontSize: '.65rem', fontWeight: 700,
            color: '#856404', background: '#FFF8E1',
            padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
            border: '1px solid #ffc107',
          }}>
            🔁 Replacement
          </span>
        )}
      </div>
    </div>
  );
}
