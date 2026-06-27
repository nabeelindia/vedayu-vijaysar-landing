import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';

const BROWN = '#5C3D1E';

const LEVEL_COLOR = { fatal: '#C62828', error: '#E65100', warning: '#F9A825', info: '#1565C0' };

const STATUS_COLOR = {
  ok:       '#2E7D32',
  error:    '#C62828',
  missed:   '#E65100',
  timeout:  '#6A1B9A',
  active:   '#1565C0',
  disabled: '#9E9E9E',
};

function MonitorDot({ status }) {
  const color = STATUS_COLOR[status] || '#9E9E9E';
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10,
      borderRadius: '50%', background: color, marginRight: 6, flexShrink: 0,
    }} />
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)', ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: '.8rem', fontWeight: 700, color: BROWN,
      textTransform: 'uppercase', letterSpacing: '.8px', margin: '0 0 10px' }}>
      {children}
    </h2>
  );
}

export default function AdminMonitoring() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const org     = process.env.NEXT_PUBLIC_SENTRY_ORG;
  const project = process.env.NEXT_PUBLIC_SENTRY_PROJECT;
  const sentryBase = org && project
    ? `https://sentry.io/organizations/${org}/issues/?project=${project}`
    : 'https://sentry.io';

  useEffect(() => {
    fetch('/api/admin/sentry-stats')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const issues   = data?.issues   || [];
  const monitors = data?.monitors || [];

  // Build a simple 14-day error sparkline from stats
  const intervals = data?.stats?.intervals || [];
  const groups    = data?.stats?.groups    || [];
  const acceptedGroup = groups.find(g => g.by?.outcome === 'accepted');
  const counts = acceptedGroup?.totals?.['sum(quantity)'] != null
    ? intervals.map((_, i) => acceptedGroup.series?.['sum(quantity)']?.[i] ?? 0)
    : [];
  const maxCount = Math.max(...counts, 1);

  return (
    <AdminLayout title="Monitoring">
      <PageHeader title="Monitoring" />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <a href={sentryBase} target="_blank" rel="noreferrer"
          style={{ fontSize: '.8rem', color: BROWN, fontWeight: 600,
            textDecoration: 'none', border: `1px solid ${BROWN}`,
            borderRadius: 6, padding: '6px 14px', display: 'inline-block' }}>
          Open Sentry ↗
        </a>
      </div>

      {loading && <p style={{ color: '#888', fontSize: '.9rem' }}>Loading Sentry data…</p>}
      {error   && <p style={{ color: '#C62828', fontSize: '.9rem' }}>Error: {error}</p>}

      {data?.error && (
        <Card style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, color: '#C62828', fontSize: '.88rem' }}>
            {data.error === 'Sentry not configured'
              ? 'Sentry env vars missing — add SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT.'
              : data.error}
          </p>
        </Card>
      )}

      {!loading && !data?.error && (
        <>
          {/* ── Error sparkline ── */}
          {counts.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <SectionTitle>Errors — last 14 days</SectionTitle>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
                {counts.map((n, i) => (
                  <div key={i} title={`${intervals[i]?.split('T')[0]}: ${n} errors`}
                    style={{
                      flex: 1, borderRadius: 2,
                      height: `${Math.max(4, Math.round((n / maxCount) * 48))}px`,
                      background: n === 0 ? '#e0dbd4' : '#E65100',
                    }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: '.7rem', color: '#888', marginTop: 4 }}>
                <span>{intervals[0]?.split('T')[0]}</span>
                <span>{intervals[intervals.length - 1]?.split('T')[0]}</span>
              </div>
            </Card>
          )}

          {/* ── Cron monitors ── */}
          <Card style={{ marginBottom: 20 }}>
            <SectionTitle>Cron Monitors ({monitors.length})</SectionTitle>
            {monitors.length === 0
              ? <p style={{ margin: 0, color: '#888', fontSize: '.85rem' }}>No monitors yet — they register on first run.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {monitors.map(m => {
                    const lastEnv = m.environments?.[0];
                    const status  = lastEnv?.status ?? m.status ?? 'active';
                    const lastRun = lastEnv?.lastCheckIn
                      ? new Date(lastEnv.lastCheckIn).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                      : '—';
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', fontSize: '.85rem',
                        padding: '8px 0', borderBottom: '1px solid #f0ede8' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <MonitorDot status={status} />
                          <span style={{ fontWeight: 600 }}>{m.name || m.slug}</span>
                        </div>
                        <div style={{ textAlign: 'right', color: '#888', fontSize: '.78rem' }}>
                          <div style={{ color: STATUS_COLOR[status] || '#888',
                            fontWeight: 600, textTransform: 'uppercase', fontSize: '.7rem' }}>
                            {status}
                          </div>
                          <div>{lastRun}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </Card>

          {/* ── Recent issues ── */}
          <Card>
            <SectionTitle>Recent Unresolved Issues ({issues.length})</SectionTitle>
            {issues.length === 0
              ? <p style={{ margin: 0, color: '#2E7D32', fontSize: '.85rem' }}>No unresolved issues.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {issues.map(issue => {
                    const level = issue.level || 'error';
                    const seen  = new Date(issue.lastSeen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                    return (
                      <a key={issue.id} href={issue.permalink} target="_blank" rel="noreferrer"
                        style={{ display: 'block', textDecoration: 'none', color: 'inherit',
                          padding: '10px 0', borderBottom: '1px solid #f0ede8' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{
                            fontSize: '.65rem', fontWeight: 700, padding: '2px 5px',
                            borderRadius: 4, flexShrink: 0, marginTop: 2,
                            background: LEVEL_COLOR[level] + '20',
                            color: LEVEL_COLOR[level] || '#888',
                            textTransform: 'uppercase',
                          }}>{level}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '.85rem', fontWeight: 600,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {issue.title}
                            </div>
                            <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
                              {issue.culprit} · {issue.count} events · last {seen}
                            </div>
                          </div>
                          <span style={{ color: '#bbb', fontSize: '.8rem', flexShrink: 0 }}>↗</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
