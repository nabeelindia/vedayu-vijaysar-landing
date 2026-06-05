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
          {order.name} · {order.city}
        </div>
        <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
          {order.pack} · {fmt(order.price)} · {timeAgo(order.created_at)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <StatusBadge status={order.status} small />
        <span style={{ fontSize: '.65rem', fontWeight: 700,
          color: order.method === 'cod' ? '#6D4C00' : '#2E7D32',
          background: order.method === 'cod' ? '#FFF8E1' : '#E8F5E9',
          padding: '2px 7px', borderRadius: 20 }}>
          {order.method === 'cod' ? 'COD' : 'Prepaid'}
        </span>
      </div>
    </div>
  );
}
