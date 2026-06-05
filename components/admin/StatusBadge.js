const STATUS_CONFIG = {
  pending:        { label: 'Waiting for reply', bg: '#FFF8E1', color: '#6D4C00' },
  confirmed:      { label: 'Confirmed',          bg: '#E8F5E9', color: '#2E7D32' },
  auto_confirmed: { label: 'Auto-confirmed',     bg: '#E3F2FD', color: '#1565C0' },
  sent:           { label: 'Order sent',         bg: '#E8EAF6', color: '#283593' },
  delivered:      { label: 'Delivered',          bg: '#E8F5E9', color: '#1B5E20' },
  cancelled:      { label: 'Cancelled',          bg: '#FFEBEE', color: '#C62828' },
  returned:       { label: 'Returned',           bg: '#FCE4EC', color: '#880E4F' },
  scheduled:      { label: 'Scheduled',          bg: '#EDE7F6', color: '#4527A0' },
};

export default function StatusBadge({ status, small }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: '#f0f0f0', color: '#555' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: small ? '2px 7px' : '4px 10px',
      borderRadius: 20, fontSize: small ? '.65rem' : '.75rem',
      fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}
