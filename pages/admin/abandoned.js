import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import PageHeader  from '../../components/admin/PageHeader';

const fmtD = iso => iso
  ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  : '—';

const FILTERS = [
  { label: 'All',       value: 'all' },
  { label: 'Pending',   value: 'false' },
  { label: 'Recovered', value: 'true' },
];

export default function AbandonedCheckouts() {
  const [carts,    setCarts]    = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    setLoading(true);
    const qs = filter === 'all' ? '' : `?recovered=${filter}`;
    fetch(`/api/admin/abandoned${qs}`)
      .then(r => r.json())
      .then(d => { setCarts(d.carts || []); setLoading(false); });
  }, [filter]);

  const toggleRecovered = async (mobile) => {
    setToggling(mobile);
    const res  = await fetch(`/api/admin/abandoned?mobile=${encodeURIComponent(mobile)}`, { method: 'PATCH' });
    const data = await res.json();
    if (data.ok) {
      setCarts(prev => prev.map(c =>
        c.mobile === mobile
          ? { ...c, recovered: data.recovered, recovered_at: data.recovered ? new Date().toISOString() : null }
          : c
      ));
    }
    setToggling(null);
  };

  const pending   = carts.filter(c => !c.recovered).length;
  const recovered = carts.filter(c =>  c.recovered).length;

  return (
    <AdminLayout title="Abandoned Checkouts">
      <PageHeader title="Abandoned Checkouts" />

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',     count: carts.length, bg: '#f5f0e8', color: '#5C3D1E' },
          { label: 'Pending',   count: pending,       bg: '#FFF3E0', color: '#E65100' },
          { label: 'Recovered', count: recovered,     bg: '#E8F5E9', color: '#2E7D32' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '8px 16px',
            fontSize: '.82rem', fontWeight: 700, color: s.color }}>
            {s.count} {s.label}
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="admin-filter-bar" style={{ marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: '.8rem', fontWeight: 600,
              background: filter === f.value ? '#5C3D1E' : '#f0ede8',
              color:      filter === f.value ? '#fff'    : '#5C3D1E',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#aaa', fontSize: '.85rem' }}>Loading…</p>
      ) : carts.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '32px 24px',
          textAlign: 'center', border: '1px solid #e8d5b0', color: '#888',
          fontSize: '.85rem', lineHeight: 1.6,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>🛒</div>
          <p style={{ fontWeight: 700, color: '#5C3D1E', marginBottom: 6 }}>No abandoned checkouts recorded yet</p>
          <p>Carts are tracked when a visitor fills in their mobile number and leaves without completing the order.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="admin-abandon-table" style={{ background: '#fff', borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0ede8' }}>
                  {['Name', 'Mobile', 'Pack', 'Payment', 'Abandoned At', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left',
                      fontWeight: 700, color: '#888', fontSize: '.75rem',
                      textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carts.map(c => (
                  <tr key={c.mobile} style={{ borderBottom: '1px solid #f0ede8' }}>
                    <td style={{ padding: '10px 14px', color: '#1a1a1a', fontWeight: 500 }}>
                      {c.name || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <a href={`https://wa.me/91${c.mobile}`} target="_blank" rel="noreferrer"
                        style={{ color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>
                        {c.mobile}
                      </a>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{c.pack || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>
                      {c.payment === 'prepaid' ? 'Prepaid' : c.payment === 'cod' ? 'COD' : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap' }}>
                      {fmtD(c.abandoned_at)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: '.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: c.recovered ? '#E8F5E9' : '#FFF3E0',
                        color:      c.recovered ? '#2E7D32' : '#E65100',
                      }}>
                        {c.recovered ? 'Recovered' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => toggleRecovered(c.mobile)}
                        disabled={toggling === c.mobile}
                        style={{
                          fontSize: '.75rem', padding: '4px 12px', borderRadius: 20,
                          border: '1.5px solid', cursor: 'pointer', fontWeight: 600,
                          borderColor:  c.recovered ? '#d0c8bc'  : '#4A7C59',
                          background:   'transparent',
                          color:        c.recovered ? '#888'     : '#4A7C59',
                        }}>
                        {toggling === c.mobile ? '…' : c.recovered ? 'Unmark' : 'Mark Recovered'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="admin-abandon-cards">
            {carts.map(c => (
              <div key={c.mobile} style={{ background: '#fff', borderRadius: 12,
                padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.07)',
                marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#1a1a1a' }}>
                      {c.name || 'Unknown'}
                    </div>
                    <a href={`https://wa.me/91${c.mobile}`} target="_blank" rel="noreferrer"
                      style={{ color: '#25D366', fontWeight: 600, fontSize: '.82rem', textDecoration: 'none' }}>
                      📱 {c.mobile}
                    </a>
                  </div>
                  <span style={{
                    fontSize: '.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: c.recovered ? '#E8F5E9' : '#FFF3E0',
                    color:      c.recovered ? '#2E7D32' : '#E65100',
                  }}>
                    {c.recovered ? 'Recovered' : 'Pending'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '.78rem', color: '#666', marginBottom: 10 }}>
                  <span>{c.pack || '—'}</span>
                  <span>·</span>
                  <span>{c.payment === 'prepaid' ? 'Prepaid' : c.payment === 'cod' ? 'COD' : '—'}</span>
                  <span>·</span>
                  <span>{fmtD(c.abandoned_at)}</span>
                </div>
                <button onClick={() => toggleRecovered(c.mobile)} disabled={toggling === c.mobile}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 8, border: '1.5px solid',
                    cursor: 'pointer', fontWeight: 600, fontSize: '.8rem',
                    borderColor:  c.recovered ? '#d0c8bc'  : '#4A7C59',
                    background:   'transparent',
                    color:        c.recovered ? '#888'     : '#4A7C59',
                  }}>
                  {toggling === c.mobile ? '…' : c.recovered ? 'Unmark Recovered' : 'Mark as Recovered'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-abandon-table { display: block; }
        .admin-abandon-cards  { display: none; }
        @media (max-width: 600px) {
          .admin-abandon-table { display: none; }
          .admin-abandon-cards  { display: block; }
        }
      ` }} />
    </AdminLayout>
  );
}
