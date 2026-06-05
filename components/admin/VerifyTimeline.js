const EVENT_LABELS = {
  placed:         { label: 'Order placed',            color: '#5C3D1E' },
  verify_sent:    { label: 'Confirmation sent (WA)',  color: '#1565C0' },
  nudged:         { label: 'Nudge sent',              color: '#E65100' },
  confirmed:      { label: 'Customer confirmed ✅',    color: '#2E7D32' },
  cancelled:      { label: 'Customer cancelled ❌',    color: '#C62828' },
  auto_confirmed: { label: 'Auto-confirmed 🤖',        color: '#1565C0' },
};

function Dot({ done, color }) {
  return (
    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3,
      background: done ? color : '#ddd', border: done ? 'none' : '2px solid #bbb' }} />
  );
}

export default function VerifyTimeline({ order, verification }) {
  const events = [
    { key: 'placed',      at: order?.created_at,        done: true },
    { key: 'verify_sent', at: verification?.created_at, done: !!verification },
    { key: 'nudged',      at: verification?.nudged_at,  done: !!verification?.nudged_at },
    { key: verification?.status === 'cancelled' ? 'cancelled' : 'confirmed',
      at: verification?.verified_at || verification?.cancelled_at,
      done: !!(verification?.verified_at || verification?.cancelled_at) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {events.map((ev, i) => {
        const cfg = EVENT_LABELS[ev.key] || {};
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Dot done={ev.done} color={cfg.color} />
            <div>
              <div style={{ fontSize: '.8rem', fontWeight: ev.done ? 600 : 400,
                color: ev.done ? cfg.color : '#bbb' }}>
                {cfg.label}
              </div>
              {ev.at && (
                <div style={{ fontSize: '.7rem', color: '#aaa' }}>
                  {new Date(ev.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
