import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import OrderCard from '../../../components/admin/OrderCard';
import PageHeader from '../../../components/admin/PageHeader';

const FILTERS = ['all','cod','prepaid','pending','confirmed','auto_confirmed','sent','delivered','cancelled'];

export default function OrdersList() {
  const router = useRouter();
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const load = (f = filter, s = search, p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p });
    if (['cod','prepaid'].includes(f)) params.set('method', f);
    else if (f !== 'all') params.set('status', f);
    if (s) params.set('search', s);
    fetch(`/api/admin/orders?${params}`).then(r => r.json()).then(d => {
      setOrders(d.data || []);
      setTotal(d.total || 0);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleFilter = (f) => { setFilter(f); setPage(1); load(f, search, 1); };
  const handleSearch = (e) => {
    if (e.key === 'Enter') { setPage(1); load(filter, e.target.value, 1); }
  };

  return (
    <AdminLayout title="Orders">
      <PageHeader title={`Orders (${total})`} />
      <input type="search" placeholder="Search by name, mobile, order ID, pincode…"
        value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearch}
        style={{ width:'100%', boxSizing:'border-box', padding:'10px 14px', borderRadius:10,
          border:'1.5px solid #e0d8cc', fontSize:'.88rem', marginBottom:12, outline:'none' }} />
      <div className="admin-filter-bar" style={{ marginBottom:16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => handleFilter(f)}
            style={{ padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer',
              fontSize:'.72rem', fontWeight:700,
              background: filter === f ? '#5C3D1E' : '#f0ede8',
              color: filter === f ? '#fff' : '#555' }}>
            {f === 'all' ? 'All' : f === 'auto_confirmed' ? 'Auto-confirmed' : f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <p style={{ color:'#888', fontSize:'.9rem' }}>Loading…</p> : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {orders.length === 0 && <p style={{ color:'#aaa', fontSize:'.88rem' }}>No orders found.</p>}
            {orders.map(o => (
              <OrderCard key={o.order_id} order={o}
                onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
            ))}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:20 }}>
            {page > 1 && (
              <button onClick={() => { const p = page-1; setPage(p); load(filter,search,p); }}
                style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #d0c8bc',
                  background:'#fff', cursor:'pointer', fontSize:'.82rem' }}>← Prev</button>
            )}
            <span style={{ padding:'8px 0', fontSize:'.82rem', color:'#888' }}>
              Page {page} · {total} orders
            </span>
            {orders.length === 50 && (
              <button onClick={() => { const p = page+1; setPage(p); load(filter,search,p); }}
                style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #d0c8bc',
                  background:'#fff', cursor:'pointer', fontSize:'.82rem' }}>Next →</button>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
