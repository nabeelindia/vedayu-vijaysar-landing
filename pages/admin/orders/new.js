import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

const PACKS = [
  { name: 'Pack of 1', qty: 1, price: 499 },
  { name: 'Pack of 2', qty: 2, price: 899 },
  { name: 'Pack of 5', qty: 5, price: 1999 },
];

const inp = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #e0d8cc', fontSize: '.85rem',
  color: '#2C1810', outline: 'none', fontFamily: 'inherit',
};
const inpPrefilled = { ...inp, background: '#f5faf6', borderColor: '#c3e6cb', color: '#2d6a4f' };
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const row3 = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 };
const label = { display: 'block', fontSize: '.75rem', fontWeight: 700, color: '#5C3D1E', marginBottom: 4 };
const fieldBox = { marginBottom: 12 };
const sectionTitle = {
  fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em',
  textTransform: 'uppercase', color: '#a07850', margin: '20px 0 8px',
};

export default function NewOrderPage() {
  const router = useRouter();
  const { replace: replaceId } = router.query;
  const isReplacement = Boolean(replaceId);

  const [origOrder, setOrigOrder]   = useState(null);
  const [loadingOrig, setLoadingOrig] = useState(false);

  const [form, setForm] = useState({
    name: '', mobile: '', email: '',
    address: '', city: '', state: '', pincode: '',
  });
  const [selectedPack, setSelectedPack] = useState(0);
  const [customPack, setCustomPack]     = useState({ name: '', qty: '', price: '' });
  const [isCustom, setIsCustom]         = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [orderStatus, setOrderStatus]     = useState('confirmed');
  const [note, setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!replaceId) return;
    setLoadingOrig(true);
    fetch(`/api/admin/orders/${replaceId}`)
      .then(r => r.json())
      .then(d => {
        const o = d.order;
        if (!o) { setError('Original order not found'); return; }
        setOrigOrder(o);
        setForm({
          name:    o.name    || '',
          mobile:  o.mobile  || '',
          email:   o.email   || '',
          address: o.address || '',
          city:    o.city    || '',
          state:   o.state   || '',
          pincode: o.pincode || '',
        });
        const idx = PACKS.findIndex(p => p.name === o.pack);
        if (idx >= 0) setSelectedPack(idx);
      })
      .finally(() => setLoadingOrig(false));
  }, [replaceId]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const getPack = () => isCustom
    ? { name: customPack.name, qty: Number(customPack.qty), price: Number(customPack.price) }
    : PACKS[selectedPack];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pack = getPack();
    if (isCustom && (!pack.name || !pack.qty)) {
      setError('Enter custom pack name and qty.'); return;
    }

    setSaving(true);
    const body = {
      ...form,
      pack:            pack.name,
      qty:             pack.qty,
      price:           isReplacement ? 0 : pack.price,
      method:          isReplacement ? 'free' : paymentMethod,
      status:          isReplacement ? 'confirmed' : orderStatus,
      note:            note.trim() || undefined,
      replacement_for: isReplacement ? replaceId : undefined,
    };

    const res = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error || 'Failed to create order'); return; }
    router.push(`/admin/orders/${data.order_id}`);
  };

  if (loadingOrig) return <AdminLayout title="Create Order"><p style={{ color:'#888' }}>Loading original order…</p></AdminLayout>;

  return (
    <AdminLayout title="Create Order">
      <PageHeader title={isReplacement ? '🔁 Create Replacement Order' : '+ Create New Order'} />

      {isReplacement && origOrder && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', background: '#fdf4ec',
          border: '1.5px solid #e0c49a', borderRadius: 10,
          fontSize: '.78rem', fontWeight: 700, color: '#856404', marginBottom: 20,
        }}>
          🔗 Replacement for <span style={{ fontFamily: 'monospace' }}>{replaceId}</span>
          <span style={{ fontWeight: 400, color: '#a07850' }}>
            — {origOrder.name} · {origOrder.pack} · {origOrder.method?.toUpperCase()}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={sectionTitle}>Customer Information</div>
        <div style={row2}>
          <div style={fieldBox}>
            <label style={label}>Full Name *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.name}
              onChange={set('name')} required placeholder="Priya Sharma" />
          </div>
          <div style={fieldBox}>
            <label style={label}>Mobile *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.mobile}
              onChange={set('mobile')} required placeholder="10-digit mobile" maxLength={10} />
          </div>
        </div>
        <div style={fieldBox}>
          <label style={label}>Email</label>
          <input style={isReplacement ? inpPrefilled : inp} value={form.email}
            onChange={set('email')} type="email" placeholder="Optional" />
        </div>

        <div style={sectionTitle}>Delivery Address</div>
        <div style={fieldBox}>
          <label style={label}>Address Line *</label>
          <input style={isReplacement ? inpPrefilled : inp} value={form.address}
            onChange={set('address')} required placeholder="House no, street, area, landmark" />
        </div>
        <div style={row3}>
          <div style={fieldBox}>
            <label style={label}>City *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.city}
              onChange={set('city')} required placeholder="City" />
          </div>
          <div style={fieldBox}>
            <label style={label}>State *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.state}
              onChange={set('state')} required placeholder="State" />
          </div>
          <div style={fieldBox}>
            <label style={label}>Pincode *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.pincode}
              onChange={set('pincode')} required placeholder="6-digit" maxLength={6} />
          </div>
        </div>

        <div style={sectionTitle}>Pack</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {PACKS.map((p, i) => (
            <div key={p.name}
              onClick={() => { setIsCustom(false); setSelectedPack(i); }}
              style={{
                border: `2px solid ${!isCustom && selectedPack === i ? '#5C3D1E' : '#e0d8cc'}`,
                borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
                background: !isCustom && selectedPack === i ? '#fdf4ec' : '#faf7f3',
              }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#5C3D1E' }}>{p.name}</div>
              <div style={{ fontSize: '.7rem', color: '#888' }}>{p.qty} glass{p.qty > 1 ? 'es' : ''}</div>
              <div style={{ fontSize: '.82rem', fontWeight: 800, color: isReplacement ? '#4A7C59' : '#2C1810', marginTop: 4 }}>
                {isReplacement ? '₹0' : `₹${p.price.toLocaleString('en-IN')}`}
              </div>
            </div>
          ))}
          <div
            onClick={() => setIsCustom(true)}
            style={{
              border: `2px solid ${isCustom ? '#5C3D1E' : '#e0d8cc'}`,
              borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
              background: isCustom ? '#fdf4ec' : '#faf7f3',
            }}>
            <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#5C3D1E' }}>Custom</div>
            <div style={{ fontSize: '.7rem', color: '#888' }}>Enter manually</div>
            <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#888', marginTop: 4 }}>—</div>
          </div>
        </div>

        {isCustom && (
          <div style={{ ...row3, marginBottom: 12 }}>
            <div style={fieldBox}>
              <label style={label}>Pack Name *</label>
              <input style={inp} value={customPack.name}
                onChange={e => setCustomPack(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Pack of 3" />
            </div>
            <div style={fieldBox}>
              <label style={label}>Qty *</label>
              <input style={inp} type="number" min="1" value={customPack.qty}
                onChange={e => setCustomPack(p => ({ ...p, qty: e.target.value }))}
                placeholder="3" />
            </div>
            <div style={fieldBox}>
              <label style={label}>Price (₹)</label>
              <input style={inp} type="number" min="0" value={customPack.price}
                onChange={e => setCustomPack(p => ({ ...p, price: e.target.value }))}
                placeholder={isReplacement ? '0' : '1299'} disabled={isReplacement} />
            </div>
          </div>
        )}

        {isReplacement && (
          <div style={{ fontSize: '.75rem', color: '#4A7C59', fontWeight: 700, marginBottom: 12 }}>
            💚 Price automatically set to ₹0 (free replacement)
          </div>
        )}

        {!isReplacement && (
          <>
            <div style={sectionTitle}>Order Details</div>
            <div style={row2}>
              <div style={fieldBox}>
                <label style={label}>Payment Method *</label>
                <select style={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="cod">COD (Cash on Delivery)</option>
                  <option value="prepaid">Prepaid (Online paid)</option>
                  <option value="free">Free / Gift</option>
                </select>
              </div>
              <div style={fieldBox}>
                <label style={label}>Order Status *</label>
                <select style={inp} value={orderStatus} onChange={e => setOrderStatus(e.target.value)}>
                  <option value="confirmed">Confirmed (skip confirmation)</option>
                  <option value="pending">Pending (needs confirmation)</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: '#f0f9f4',
          border: '1.5px solid #c3e6cb', borderRadius: 8, marginBottom: 16,
        }}>
          <span style={{ fontSize: '.78rem', color: '#2d6a4f', fontWeight: 600 }}>
            ✉️ Confirmation email + 📲 WhatsApp will be sent to the customer automatically
          </span>
        </div>

        <div style={sectionTitle}>
          Internal Note <span style={{ fontWeight: 400, fontSize: '.68rem', color: '#aaa' }}>(optional)</span>
        </div>
        <div style={fieldBox}>
          <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={isReplacement ? 'e.g. Original order lost in transit' : 'e.g. Phone order from customer'} />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#FFF3F3', border: '1.5px solid #FFCDD2',
            borderRadius: 8, color: '#C62828', fontSize: '.82rem', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} style={{
          width: '100%', padding: 14, background: saving ? '#c4a882' : '#5C3D1E',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: '.95rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Creating…' : isReplacement ? 'Create Replacement Order →' : 'Create Order →'}
        </button>
      </form>
    </AdminLayout>
  );
}
