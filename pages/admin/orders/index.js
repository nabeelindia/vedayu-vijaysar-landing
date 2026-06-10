import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import OrderCard from '../../../components/admin/OrderCard';
import PageHeader from '../../../components/admin/PageHeader';

function getDateParams(range) {
  if (!range) return {};
  const toIST = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = new Date();
  const yyyymmdd = (d) => toIST(d);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  if (range === 'today') {
    const d = yyyymmdd(today);
    return { date_from: d, date_to: d };
  }
  if (range === 'yesterday') {
    const d = yyyymmdd(addDays(today, -1));
    return { date_from: d, date_to: d };
  }
  if (range === 'last7')  return { date_from: yyyymmdd(addDays(today, -6)),  date_to: yyyymmdd(today) };
  if (range === 'last15') return { date_from: yyyymmdd(addDays(today, -14)), date_to: yyyymmdd(today) };
  if (range === 'last30') return { date_from: yyyymmdd(addDays(today, -29)), date_to: yyyymmdd(today) };
  if (range === 'thisMonth') {
    const d = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    return { date_from: yyyymmdd(first), date_to: yyyymmdd(today) };
  }
  if (range === 'lastMonth') {
    const d = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const firstThisMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastOfLastMonth = new Date(firstThisMonth - 1);
    const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1);
    return { date_from: yyyymmdd(firstOfLastMonth), date_to: yyyymmdd(lastOfLastMonth) };
  }
  return {};
}

const FILTERS = ['all','cod','prepaid','pending','confirmed','auto_confirmed','sent','delivered','cancelled','archived'];

export default function OrdersList() {
  const router = useRouter();
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected,    setSelected]    = useState(new Set());
  const [bulkStatus,  setBulkStatus]  = useState('confirmed');
  const [bulking,     setBulking]     = useState(false);
  const [dateRange, setDateRange] = useState('');

  const load = (f = filter, s = search, p = page, dr = dateRange) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p });
    if (f === 'archived') {
      params.set('archived', 'true');
    } else {
      params.set('archived', 'false');
      if (['cod', 'prepaid'].includes(f)) params.set('method', f);
      else if (f !== 'all') params.set('status', f);
    }
    if (s) params.set('search', s);
    const { date_from, date_to } = getDateParams(dr);
    if (date_from) params.set('date_from', date_from);
    if (date_to)   params.set('date_to', date_to);
    fetch(`/api/admin/orders?${params}`).then(r => r.json()).then(d => {
      setOrders(d.data || []);
      setTotal(d.total || 0);
      setLoading(false);
    });
  };

  useEffect(() => { load(filter, search, page, dateRange); }, []);

  const handleFilter = (f) => { setSelected(new Set()); setFilter(f); setPage(1); load(f, search, 1, dateRange); };
  const handleDateRange = (dr) => { setSelected(new Set()); setDateRange(dr); setPage(1); load(filter, search, 1, dr); };
  const handleSearch = (e) => {
    if (e.key === 'Enter') { setSelected(new Set()); setPage(1); load(filter, e.target.value, 1, dateRange); }
  };

  const toggleSelect  = (id) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const selectAll     = () => setSelected(new Set(orders.map(o => o.order_id)));
  const deselectAll   = () => setSelected(new Set());

  const bulkUpdate = async () => {
    if (!selected.size) return;
    if (!confirm(`Update ${selected.size} order(s)?`)) return;
    setBulking(true);

    const body = { orderIds: [...selected] };
    if (bulkStatus === '__archive__')        { body.action = 'archive'; }
    else if (bulkStatus === '__unarchive__') { body.action = 'unarchive'; }
    else { body.status = bulkStatus; }

    await fetch('/api/admin/orders/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSelected(new Set());
    load();
    setBulking(false);
  };

  const exportCSV = () => {
    const rows = selected.size ? orders.filter(o => selected.has(o.order_id)) : orders;
    const header = ['Order ID','Date','Name','Mobile','Email','Address','City','State','Pincode','Pack','Qty','Amount','Method','Status','AWB','Courier'];
    const lines  = rows.map(o => [
      o.order_id,
      new Date(o.created_at).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata' }),
      o.name, o.mobile, o.email || '',
      `"${(o.address || '').replace(/"/g,'""')}"`,
      o.city, o.state, o.pincode,
      o.pack, o.qty, o.price,
      o.method, o.status, o.awb || '', o.courier || '',
    ].join(','));
    const csv  = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `vedayu-orders-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Orders">
      <PageHeader title={`Orders (${total})`} />
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
        <input type="search" placeholder="Search by name, mobile, order ID, pincode…"
          value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearch}
          style={{ flex:1, padding:'10px 14px', borderRadius:10,
            border:'1.5px solid #e0d8cc', fontSize:'.88rem', outline:'none' }} />
        <select value={dateRange} onChange={e => handleDateRange(e.target.value)}
          style={{ padding:'10px 12px', borderRadius:10, border:'1.5px solid #e0d8cc',
            fontSize:'.82rem', background:'#fff', color: dateRange ? '#5C3D1E' : '#888',
            fontWeight: dateRange ? 700 : 400, cursor:'pointer', outline:'none', flexShrink:0 }}>
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 days</option>
          <option value="last15">Last 15 days</option>
          <option value="last30">Last 30 days</option>
          <option value="thisMonth">This month</option>
          <option value="lastMonth">Last month</option>
        </select>
      </div>
      {/* Bulk action bar */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
        <button onClick={selected.size === orders.length ? deselectAll : selectAll}
          style={{ padding:'5px 10px', fontSize:'.72rem', fontWeight:700, borderRadius:6,
            border:'1.5px solid #d0c8bc', background:'#fff', cursor:'pointer' }}>
          {selected.size === orders.length && orders.length > 0 ? 'Deselect all' : `Select all ${orders.length}`}
        </button>
        {selected.size > 0 && (
          <>
            <span style={{ fontSize:'.75rem', color:'#555' }}>{selected.size} selected</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
              style={{ padding:'5px 8px', borderRadius:6, border:'1.5px solid #d0c8bc', fontSize:'.75rem' }}>
              <option value="confirmed">Confirmed</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="__archive__">🗂 Archive</option>
              <option value="__unarchive__">📤 Unarchive</option>
            </select>
            <button onClick={bulkUpdate} disabled={bulking}
              style={{ padding:'5px 12px', background:'#5C3D1E', color:'#fff',
                border:'none', borderRadius:6, fontSize:'.75rem', fontWeight:700, cursor:'pointer' }}>
              {bulking ? '…' : 'Update'}
            </button>
          </>
        )}
        <button onClick={exportCSV}
          style={{ padding:'5px 12px', background:'#f0ede8', color:'#5C3D1E',
            border:'none', borderRadius:6, fontSize:'.72rem', fontWeight:700,
            cursor:'pointer', marginLeft:'auto' }}>
          ⬇ Export CSV{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
      </div>
      <div className="admin-filter-bar" style={{ marginBottom:16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => handleFilter(f)}
            style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer',
              fontSize:'.75rem', fontWeight:700,
              background: filter === f ? '#5C3D1E' : '#f0ede8',
              color: filter === f ? '#fff' : '#555' }}>
            {f === 'all' ? 'All'
              : f === 'auto_confirmed' ? 'Auto-confirmed'
              : f === 'archived' ? '🗂 Archived'
              : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <p style={{ color:'#888', fontSize:'.9rem' }}>Loading…</p> : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {orders.length === 0 && <p style={{ color:'#aaa', fontSize:'.88rem' }}>No orders found.</p>}
            {orders.map(o => (
              <div key={o.order_id} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <input type="checkbox" checked={selected.has(o.order_id)}
                  onChange={() => toggleSelect(o.order_id)}
                  style={{ marginTop:14, width:16, height:16, cursor:'pointer', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <OrderCard order={o} onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:20 }}>
            {page > 1 && (
              <button onClick={() => { const p = page-1; setPage(p); load(filter,search,p,dateRange); }}
                style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #d0c8bc',
                  background:'#fff', cursor:'pointer', fontSize:'.82rem' }}>← Prev</button>
            )}
            <span style={{ padding:'8px 0', fontSize:'.82rem', color:'#888' }}>
              Page {page} · {total} orders
            </span>
            {orders.length === 50 && (
              <button onClick={() => { const p = page+1; setPage(p); load(filter,search,p,dateRange); }}
                style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #d0c8bc',
                  background:'#fff', cursor:'pointer', fontSize:'.82rem' }}>Next →</button>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
