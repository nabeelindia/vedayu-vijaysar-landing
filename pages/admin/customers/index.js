import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

export default function CustomersList() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);

  const load = (s = '') => {
    setLoading(true);
    const params = new URLSearchParams({ page: 1 });
    if (s) params.set('search', s);
    fetch(`/api/admin/customers?${params}`).then(r => r.json()).then(d => {
      setCustomers(d.data || []);
      setTotal(d.total || 0);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout title="Customers">
      <PageHeader title={`Customers (${total})`} />
      <input type="search" placeholder="Search by name, mobile, city…"
        value={search} onChange={e => setSearch(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && load(search)}
        style={{ width:'100%', boxSizing:'border-box', padding:'10px 14px', borderRadius:10,
          border:'1.5px solid #e0d8cc', fontSize:'.88rem', marginBottom:14, outline:'none' }} />
      {loading ? <p style={{ color:'#888', fontSize:'.9rem' }}>Loading…</p> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {customers.length === 0 && <p style={{ color:'#aaa', fontSize:'.88rem' }}>No customers found.</p>}
          {customers.map(c => (
            <div key={c.mobile} onClick={() => router.push(`/admin/customers/${c.mobile}`)}
              style={{ background:'#fff', borderRadius:12, padding:'14px 16px',
                boxShadow:'0 1px 3px rgba(0,0,0,.07)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'.9rem', color:'#1a1a1a' }}>{c.name}</div>
                <div style={{ fontSize:'.78rem', color:'#888', marginTop:3 }}>
                  {c.mobile} · {c.city}, {c.state}
                </div>
              </div>
              <div style={{ fontSize:'.82rem', fontWeight:700, color:'#5C3D1E', flexShrink:0 }}>
                {c.orderCount} orders
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
