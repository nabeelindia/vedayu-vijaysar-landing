/**
 * /track — Public order tracking page
 * Supports: AWB number, Order ID, Phone number, Email
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';

const STATUS_CONFIG = {
  pending:   { label: 'Order Placed',        icon: '📦', color: '#C9A84C', done: true  },
  picked:    { label: 'Picked Up',           icon: '🚚', color: '#C9A84C', done: true  },
  transit:   { label: 'In Transit',          icon: '🛣️',  color: '#C9A84C', done: true  },
  out:       { label: 'Out for Delivery',    icon: '🏠', color: '#4A7C59', done: true  },
  delivered: { label: 'Delivered',           icon: '✅', color: '#4A7C59', done: true  },
  failed:    { label: 'Delivery Attempted',  icon: '⚠️', color: '#e67e22', done: false },
  rto:       { label: 'Returning to Origin', icon: '↩️', color: '#c0392b', done: false },
};

const STEPS = ['pending', 'picked', 'transit', 'out', 'delivered'];

export default function TrackPage() {
  const router = useRouter();
  const [query, setQuery]         = useState('');
  const [queryType, setQueryType] = useState('order'); // order | awb | phone | email
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [results, setResults]     = useState(null);

  // Pre-fill from URL params: /track?order=VED-COD-XXX or ?awb=XXX
  useEffect(() => {
    const { awb, order, phone, email } = router.query;
    if (awb)   { setQueryType('awb');   setQuery(awb);   handleSearch(null, 'awb',   awb);   }
    if (order) { setQueryType('order'); setQuery(order); handleSearch(null, 'order', order); }
    if (phone) { setQueryType('phone'); setQuery(phone); handleSearch(null, 'phone', phone); }
    if (email) { setQueryType('email'); setQuery(email); handleSearch(null, 'email', email); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query]);

  async function handleSearch(e, overrideType, overrideQuery) {
    if (e) e.preventDefault();
    const type  = overrideType  || queryType;
    const value = (overrideQuery || query).trim();
    if (!value) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const params = new URLSearchParams({ [type]: value });
      const res    = await fetch(`/api/track-order?${params}`);
      const data   = await res.json();

      if (!data.success) {
        setError(data.error || 'No shipment found. Please check your details and try again.');
      } else {
        setResults(data.results);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Track Your Order — Vedayu</title>
        <meta name="description" content="Track your Vedayu Vijaysar Wooden Glass order by Order ID, AWB number, phone, or email." />
      </Head>

      <div className="track-page">
        {/* Header */}
        <header className="track-header">
          <Link href="/" className="track-logo">
            <span className="track-logo-leaf">🌿</span> Vedayu
          </Link>
          <p className="track-tagline">Track Your Order</p>
        </header>

        {/* Search Card */}
        <main className="track-main">
          <div className="track-card">
            <h1 className="track-title">Where is my order?</h1>
            <p className="track-subtitle">Enter any of the following to track your shipment</p>

            {/* Type Selector */}
            <div className="track-type-tabs">
              {[
                { value: 'order', label: '📋 Order ID'    },
                { value: 'awb',   label: '🏷️ AWB Number'  },
                { value: 'phone', label: '📱 Phone'        },
                { value: 'email', label: '✉️ Email'        },
              ].map(tab => (
                <button
                  key={tab.value}
                  className={`track-tab${queryType === tab.value ? ' active' : ''}`}
                  onClick={() => { setQueryType(tab.value); setQuery(''); setResults(null); setError(''); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form className="track-form" onSubmit={handleSearch}>
              <input
                className="track-input"
                type={queryType === 'email' ? 'email' : 'text'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={PLACEHOLDERS[queryType]}
                inputMode={queryType === 'phone' ? 'numeric' : 'text'}
                autoCapitalize={queryType === 'order' || queryType === 'awb' ? 'characters' : 'none'}
                required
              />
              <button className="track-btn" type="submit" disabled={loading}>
                {loading ? 'Tracking…' : 'Track Order →'}
              </button>
            </form>

            {/* Error */}
            {error && (
              <div className="track-error">
                <span>⚠️</span> {error}
              </div>
            )}
          </div>

          {/* Results */}
          {results && results.map((result, idx) => (
            <TrackingResult key={idx} result={result} />
          ))}

          {/* Help */}
          <div className="track-help">
            <p>
              Need help?{' '}
              <a
                href={`https://wa.me/91${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''}?text=Hi%20Vedayu!%20I%20need%20help%20tracking%20my%20order.`}
                className="track-wa-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 Chat on WhatsApp
              </a>
            </p>
          </div>
        </main>
      </div>

      <style jsx>{`
        .track-page { min-height: 100vh; background: #FDF6EC; font-family: sans-serif; }

        .track-header {
          background: #3D2610;
          padding: 16px 24px;
          display: flex; align-items: center; gap: 16px;
        }
        .track-logo {
          color: #C9A84C; font-size: 1.2rem; font-weight: 800;
          text-decoration: none; letter-spacing: 1px;
        }
        .track-logo-leaf { margin-right: 4px; }
        .track-tagline { color: rgba(255,255,255,.5); font-size: .85rem; margin: 0; }

        .track-main {
          max-width: 680px; margin: 0 auto; padding: 32px 16px 64px;
        }

        .track-card {
          background: #fff;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 2px 16px rgba(61,38,16,.08);
          margin-bottom: 24px;
        }

        .track-title { font-size: 1.5rem; color: #2C1810; margin: 0 0 6px; font-family: Georgia, serif; }
        .track-subtitle { color: #888; font-size: .9rem; margin: 0 0 24px; }

        .track-type-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .track-tab {
          padding: 8px 14px; border-radius: 50px;
          border: 1px solid #D4B896; background: #fff;
          font-size: .82rem; color: #5C3D1E; cursor: pointer;
          transition: all .2s;
        }
        .track-tab.active { background: #5C3D1E; color: #fff; border-color: #5C3D1E; }

        .track-form { display: flex; gap: 10px; }
        .track-input {
          flex: 1; padding: 13px 16px;
          border: 1.5px solid #D4B896; border-radius: 10px;
          font-size: .95rem; color: #2C1810; outline: none;
          transition: border-color .2s;
        }
        .track-input:focus { border-color: #5C3D1E; }
        .track-btn {
          background: #5C3D1E; color: #fff;
          border: none; border-radius: 10px;
          padding: 13px 22px; font-size: .9rem; font-weight: 700;
          cursor: pointer; white-space: nowrap;
          transition: background .2s;
        }
        .track-btn:hover:not(:disabled) { background: #3D2610; }
        .track-btn:disabled { opacity: .6; cursor: default; }

        .track-error {
          margin-top: 16px; padding: 12px 16px;
          background: #FFF3CD; border: 1px solid #e67e22;
          border-radius: 8px; color: #6D4C00; font-size: .88rem;
        }

        .track-help {
          text-align: center; color: #888; font-size: .88rem; margin-top: 24px;
        }
        .track-wa-link { color: #25D366; font-weight: 700; text-decoration: none; }

        @media (max-width: 480px) {
          .track-card { padding: 24px 16px; }
          .track-form { flex-direction: column; }
          .track-btn { width: 100%; }
        }
      `}</style>
    </>
  );
}

const PLACEHOLDERS = {
  order: 'e.g. VED-COD-1748123456789',
  awb:   'e.g. 1234567890123',
  phone: 'e.g. 9876543210',
  email: 'e.g. you@example.com',
};

// ─── Tracking Result Component ────────────────────────────────────────────────

function TrackingResult({ result }) {
  const { orderId, awb, courierName, status, statusCode, eta, scans } = result;
  const cfg         = STATUS_CONFIG[statusCode] || STATUS_CONFIG.pending;
  const currentStep = STEPS.indexOf(statusCode);

  return (
    <div className="result-card">
      {/* Status Header */}
      <div className="result-header" style={{ background: cfg.color }}>
        <div className="result-status-icon">{cfg.icon}</div>
        <div>
          <div className="result-status-label">{cfg.label}</div>
          {courierName && <div className="result-courier">via {courierName}</div>}
        </div>
        {eta && <div className="result-eta">ETA: {formatDate(eta)}</div>}
      </div>

      <div className="result-body">
        {/* Order & AWB info */}
        <div className="result-meta">
          {orderId && <span className="result-meta-item"><strong>Order:</strong> {orderId}</span>}
          {awb     && <span className="result-meta-item"><strong>AWB:</strong> {awb}</span>}
        </div>

        {/* Progress Bar */}
        {statusCode !== 'rto' && statusCode !== 'failed' && (
          <div className="result-progress">
            {STEPS.map((step, idx) => {
              const stepCfg = STATUS_CONFIG[step];
              const done    = idx <= currentStep;
              return (
                <div key={step} className={`progress-step${done ? ' done' : ''}`}>
                  <div className="progress-dot" style={done ? { background: cfg.color } : {}}>
                    {done ? '✓' : ''}
                  </div>
                  <div className="progress-label">{stepCfg.label}</div>
                  {idx < STEPS.length - 1 && (
                    <div className={`progress-line${done && idx < currentStep ? ' done' : ''}`}
                         style={done && idx < currentStep ? { background: cfg.color } : {}} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Scan History */}
        {scans && scans.length > 0 && (
          <div className="scan-history">
            <h3 className="scan-title">Tracking History</h3>
            <div className="scan-list">
              {scans.map((scan, idx) => (
                <div key={idx} className="scan-item">
                  <div className="scan-dot" />
                  <div className="scan-content">
                    <div className="scan-status">{scan.status}</div>
                    {scan.location  && <div className="scan-location">📍 {scan.location}</div>}
                    {scan.remark    && <div className="scan-remark">{scan.remark}</div>}
                    {scan.timestamp && <div className="scan-time">{formatDateTime(scan.timestamp)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NDR notice */}
        {statusCode === 'failed' && (
          <div className="result-notice warning">
            ⚠️ Delivery was attempted but unsuccessful. Our team will retry. You may also call the delivery partner directly.
          </div>
        )}

        {statusCode === 'rto' && (
          <div className="result-notice error">
            ↩️ Your shipment is being returned. Please contact us on WhatsApp to arrange a re-delivery.
          </div>
        )}
      </div>

      <style jsx>{`
        .result-card {
          background: #fff; border-radius: 16px;
          box-shadow: 0 2px 16px rgba(61,38,16,.08);
          overflow: hidden; margin-bottom: 20px;
        }

        .result-header {
          padding: 20px 24px; display: flex;
          align-items: center; gap: 16px; color: #fff;
        }
        .result-status-icon { font-size: 2rem; }
        .result-status-label { font-size: 1.15rem; font-weight: 700; }
        .result-courier { font-size: .82rem; opacity: .85; margin-top: 2px; }
        .result-eta { margin-left: auto; font-size: .85rem; opacity: .9; white-space: nowrap; }

        .result-body { padding: 24px; }

        .result-meta { display: flex; gap: 24px; font-size: .82rem; color: #666; margin-bottom: 24px; flex-wrap: wrap; }
        .result-meta-item strong { color: #3D2610; }

        .result-progress {
          display: flex; align-items: flex-start;
          gap: 0; margin-bottom: 28px; overflow-x: auto;
          padding-bottom: 4px;
        }
        .progress-step {
          display: flex; flex-direction: column; align-items: center;
          flex: 1; min-width: 60px; position: relative;
        }
        .progress-dot {
          width: 28px; height: 28px; border-radius: 50%;
          background: #ddd; display: flex; align-items: center;
          justify-content: center; font-size: .7rem; color: #fff;
          font-weight: 700; z-index: 1; flex-shrink: 0;
          border: 2px solid #eee; transition: all .3s;
        }
        .progress-step.done .progress-dot { border-color: transparent; }
        .progress-label { font-size: .68rem; color: #888; text-align: center; margin-top: 6px; line-height: 1.3; }
        .progress-step.done .progress-label { color: #3D2610; font-weight: 600; }
        .progress-line {
          position: absolute; top: 14px; left: 50%;
          width: 100%; height: 2px; background: #eee;
          transition: background .3s;
        }

        .scan-history { border-top: 1px solid #f0e8d8; padding-top: 20px; }
        .scan-title { font-size: .9rem; font-weight: 700; color: #3D2610; margin: 0 0 16px; }
        .scan-list { display: flex; flex-direction: column; gap: 0; }
        .scan-item {
          display: flex; gap: 12px; padding-bottom: 16px;
          border-left: 2px solid #f0e8d8; margin-left: 6px; padding-left: 16px;
          position: relative;
        }
        .scan-item:last-child { border-left-color: transparent; padding-bottom: 0; }
        .scan-dot {
          position: absolute; left: -5px; top: 3px;
          width: 8px; height: 8px; border-radius: 50%;
          background: #C9A84C; flex-shrink: 0;
        }
        .scan-content { flex: 1; }
        .scan-status { font-size: .88rem; font-weight: 600; color: #2C1810; }
        .scan-location { font-size: .8rem; color: #666; margin-top: 2px; }
        .scan-remark { font-size: .8rem; color: #888; margin-top: 2px; font-style: italic; }
        .scan-time { font-size: .75rem; color: #aaa; margin-top: 4px; }

        .result-notice {
          border-radius: 8px; padding: 12px 16px;
          font-size: .85rem; margin-top: 16px;
        }
        .result-notice.warning { background: #FFF3CD; border: 1px solid #e67e22; color: #6D4C00; }
        .result-notice.error   { background: #FDECEA; border: 1px solid #c0392b; color: #7b1c1c; }
      `}</style>
    </div>
  );
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateTime(dateStr) {
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}
