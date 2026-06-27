// pages/admin/partners/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

const fmtRs = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 12,
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,.07)',
  flex: '1 1 180px',
  minWidth: 0,
};

const LABEL_STYLE = { fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.6px', color: '#aaa', marginBottom: 6 };
const VALUE_STYLE = { fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a' };

const PROFESSIONS = ['Doctor', 'Nutritionist', 'Yoga Instructor', 'Influencer', 'Other'];

const EMPTY_FORM = { name: '', mobile: '', email: '', handle: '', profession: 'Doctor',
  city: '', bank_name: '', bank_account: '', bank_ifsc: '' };

function AddPartnerModal({ onClose, onAdded }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-suggest handle from name
  const handleNameBlur = () => {
    if (form.handle) return;
    const slug = form.name.replace(/^Dr\.?\s*/i, 'Dr').replace(/\s+\S+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
    if (slug.length >= 3) setForm(f => ({ ...f, handle: slug }));
  };

  const submit = async e => {
    e.preventDefault();
    setSaving(true); setErr('');
    const r = await fetch('/api/admin/growth-partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setErr(d.error || 'Something went wrong'); return; }
    onAdded(d);
  };

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #ddd',
    borderRadius: 6, fontSize: '.85rem', boxSizing: 'border-box' };
  const lbl = { fontSize: '.75rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 };
  const row = { marginBottom: 14 };
  const half = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a' }}>Add Growth Partner</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem',
            cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>
        </div>

        {err && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, fontSize: '.83rem', color: '#b91c1c' }}>
            {err}
          </div>
        )}

        <form onSubmit={submit}>
          <div style={half}>
            <div>
              <label style={lbl}>Full Name *</label>
              <input style={inp} value={form.name} onChange={set('name')}
                onBlur={handleNameBlur} required placeholder="Dr. Arjun Sharma" />
            </div>
            <div>
              <label style={lbl}>Mobile *</label>
              <input style={inp} value={form.mobile} onChange={set('mobile')}
                required placeholder="9900000000" maxLength={10} />
            </div>
          </div>

          <div style={half}>
            <div>
              <label style={lbl}>Handle * <span style={{ fontWeight: 400, color: '#aaa' }}>(affiliate link)</span></label>
              <input style={inp} value={form.handle} onChange={set('handle')}
                required placeholder="DrArjun" />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" value={form.email} onChange={set('email')}
                placeholder="arjun@example.com" />
            </div>
          </div>

          <div style={half}>
            <div>
              <label style={lbl}>Profession *</label>
              <select style={inp} value={form.profession} onChange={set('profession')} required>
                {PROFESSIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>City</label>
              <input style={inp} value={form.city} onChange={set('city')} placeholder="Mumbai" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f0ede8', paddingTop: 16, marginBottom: 14 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.6px', color: '#aaa', marginBottom: 12 }}>Bank Details (optional)</div>
            <div style={row}>
              <label style={lbl}>Bank Name</label>
              <input style={inp} value={form.bank_name} onChange={set('bank_name')} placeholder="SBI" />
            </div>
            <div style={half}>
              <div>
                <label style={lbl}>Account Number</label>
                <input style={inp} value={form.bank_account} onChange={set('bank_account')}
                  placeholder="0000000000" />
              </div>
              <div>
                <label style={lbl}>IFSC Code</label>
                <input style={{ ...inp, textTransform: 'uppercase' }} value={form.bank_ifsc}
                  onChange={e => setForm(f => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))}
                  placeholder="SBIN0001234" maxLength={11} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 20px', border: '1px solid #ddd', borderRadius: 8,
                background: '#fff', fontSize: '.85rem', cursor: 'pointer', color: '#555' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '9px 20px', border: 'none', borderRadius: 8,
                background: saving ? '#aaa' : '#5C3D1E', color: '#fff',
                fontSize: '.85rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Adding…' : 'Add Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPartners() {
  const router = useRouter();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadPartners = () => {
    fetch('/api/admin/growth-partners')
      .then(r => r.json())
      .then(d => { setPartners(d.partners || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadPartners(); }, []);

  // Stats
  const totalPartners    = partners.length;
  const ordersViaPartners = partners.reduce((s, p) => s + (p.orderCount || 0), 0);
  const totalEarnedAll   = partners.reduce((s, p) => s + (p.totalEarned || 0), 0);

  return (
    <AdminLayout title="Growth Partners">
      {showModal && (
        <AddPartnerModal
          onClose={() => setShowModal(false)}
          onAdded={({ id }) => { setShowModal(false); loadPartners(); router.push(`/admin/partners/${id}`); }}
        />
      )}
      <PageHeader
        title={`Growth Partners ${totalPartners > 0 ? `(${totalPartners})` : ''}`}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowModal(true)}
              style={{ background: '#0891B2', color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 16px', fontSize: '.82rem',
                fontWeight: 700, cursor: 'pointer' }}>
              + Add Partner
            </button>
            <a href="/admin/partners/withdrawals"
              style={{ background: '#5C3D1E', color: '#fff', textDecoration: 'none',
                borderRadius: 8, padding: '8px 16px', fontSize: '.82rem', fontWeight: 700 }}>
              Withdrawal Queue
            </a>
          </div>
        }
      />

      {/* Stats */}
      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Total Partners</div>
          <div style={VALUE_STYLE}>{totalPartners}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Orders via Partners</div>
          <div style={{ ...VALUE_STYLE, color: '#4A7C59' }}>{ordersViaPartners}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Total Earned (all time)</div>
          <div style={{ ...VALUE_STYLE, color: '#5C3D1E' }}>{fmtRs(totalEarnedAll)}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>KYC Verified</div>
          <div style={{ ...VALUE_STYLE, color: '#C9A84C' }}>
            {partners.filter(p => p.kyc_verified).length}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : partners.length === 0 ? (
        <p style={{ color: '#aaa' }}>No growth partners yet.</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f0e8' }}>
                {['Name / Handle', 'Profession / City', 'Orders', 'Total Earned', 'KYC', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left',
                    fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.6px', color: '#888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id}
                  style={{ borderBottom: '1px solid #f0ede8' }}
                  onMouseOver={e => e.currentTarget.style.background = '#faf8f5'}
                  onMouseOut={e  => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#1a1a1a' }}>{p.name}</div>
                    <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>@{p.handle}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: '.83rem', color: '#444' }}>{p.profession || '—'}</div>
                    <div style={{ fontSize: '.75rem', color: '#aaa', marginTop: 2 }}>{p.city || '—'}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '.9rem', fontWeight: 700,
                    color: '#4A7C59' }}>{p.orderCount}</td>
                  <td style={{ padding: '10px 14px', fontSize: '.83rem', fontWeight: 600,
                    color: '#5C3D1E' }}>{fmtRs(p.totalEarned)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {p.kyc_verified ? (
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '.72rem',
                        fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>Verified</span>
                    ) : (
                      <span style={{ background: '#fef9c3', color: '#a16207', fontSize: '.72rem',
                        fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>KYC Pending</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => router.push(`/admin/partners/${p.id}`)}
                      style={{ background: '#5C3D1E', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '6px 14px', fontSize: '.78rem',
                        fontWeight: 600, cursor: 'pointer' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
