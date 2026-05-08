'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { formatDistanceToNow, parseISO, isAfter, subHours, subDays } from 'date-fns';
import { Signal, Source, Severity, SignalsResponse } from '@/app/types';
import StatsBar from './StatsBar';
import FilterBar, { Filters } from './FilterBar';
import ThreatGauge from './ThreatGauge';
import SignalMap from './SignalMap';
import SignalFeed from './SignalFeed';
import SignalDrawer from './SignalDrawer';
import DiseaseBreakdown from './DiseaseBreakdown';
import HistoryChart from './HistoryChart';
import { exportToCsv } from '@/app/lib/export';
import { playAlertTone } from '@/app/lib/audio';

const REFRESH_MS = 5 * 60 * 1000;

function computeThreat(signals: Signal[]): { level: string; score: number; color: string } {
  if (signals.length === 0) return { level: 'LOW', score: 0, color: '#22c55e' };
  const high = signals.filter(s => s.severity === 'high').length;
  const med  = signals.filter(s => s.severity === 'medium').length;
  const low  = signals.filter(s => s.severity === 'low').length;
  const score = Math.min(100, Math.round(((high * 5 + med * 2 + low * 0.5) / (signals.length * 5)) * 100));
  if (score < 25) return { level: 'LOW',      score, color: '#22c55e' };
  if (score < 50) return { level: 'MODERATE', score, color: '#f59e0b' };
  if (score < 75) return { level: 'ELEVATED', score, color: '#f97316' };
  return              { level: 'CRITICAL',  score, color: '#ef4444' };
}

function TopThreatCard({ signal, rank }: { signal: Signal; rank: number }) {
  const sevColors = {
    high:   { border: '#ef4444', bg: 'rgba(239,68,68,0.08)',   text: '#f87171', label: 'CRITICAL' },
    medium: { border: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  text: '#fbbf24', label: 'ELEVATED' },
    low:    { border: '#22c55e', bg: 'rgba(34,197,94,0.06)',   text: '#4ade80', label: 'WATCH'    },
  };
  const c = sevColors[signal.severity];
  let timeAgo = '—';
  try { timeAgo = formatDistanceToNow(parseISO(signal.publishedAt), { addSuffix: true }); } catch {}

  return (
    <a
      href={signal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md p-4 transition-all duration-200 hover:scale-[1.015] group"
      style={{
        background: 'linear-gradient(135deg, #0a1628, #0d1f38)',
        border: `1px solid ${c.border}40`,
        borderLeft: `3px solid ${c.border}`,
        boxShadow: `0 0 25px ${c.bg}, 0 4px 14px rgba(0,0,0,0.4)`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">#{rank} Active Incident</span>
        <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded"
          style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}40` }}>
          {c.label}
        </span>
      </div>
      <p className="font-mono text-base font-bold mb-1 leading-tight group-hover:underline" style={{ color: c.text }}>
        {signal.disease}
      </p>
      <p className="text-[12px] font-mono text-slate-400 mb-2">{signal.location} &middot; {signal.region}</p>
      <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{signal.description}</p>
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-[10px] font-mono text-slate-600">{timeAgo}</span>
        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border"
          style={{
            color: signal.source === 'CDC' ? '#93c5fd' : signal.source === 'WHO' ? '#c4b5fd'
              : signal.source === 'ProMED' ? '#fdba74' : '#5eead4',
            background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)',
          }}>
          {signal.source}
        </span>
      </div>
    </a>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-800/40 animate-pulse">
      <span className="w-2 h-2 rounded-full bg-slate-800 flex-shrink-0" />
      <span className="w-28 h-3 bg-slate-800 rounded flex-shrink-0" />
      <span className="flex-1 h-3 bg-slate-800/60 rounded hidden sm:block" />
      <span className="w-16 h-3 bg-slate-800/40 rounded hidden sm:block" />
      <span className="w-14 h-4 bg-slate-800 rounded" />
    </div>
  );
}

// Icon buttons for header actions
function HeaderBtn({ onClick, title, active, children }: {
  onClick: () => void; title: string; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[10px] uppercase transition-all"
      style={{
        background: active ? 'rgba(34,211,238,0.12)' : 'transparent',
        border: `1px solid ${active ? 'rgba(34,211,238,0.35)' : '#1a3352'}`,
        color: active ? '#22d3ee' : '#475569',
      }}
    >
      {children}
    </button>
  );
}

export default function Dashboard({ initialData }: { initialData: SignalsResponse | null }) {
  const [data,         setData]         = useState<SignalsResponse | null>(initialData);
  const [loading,      setLoading]      = useState(!initialData);
  const [fetchedAt,    setFetchedAt]    = useState<Date | null>(initialData ? new Date() : null);
  const [filters,      setFilters]      = useState<Filters>({ source: 'all', severity: 'all', search: '' });
  const [drawerSignal, setDrawerSignal] = useState<Signal | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [newSignalIds, setNewSignalIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetch = useRef(true);

  // Load prefs + parse URL filters on mount
  useEffect(() => {
    try {
      setAudioEnabled(localStorage.getItem('sentinel_audio') === 'true');
      setNotifEnabled(
        localStorage.getItem('sentinel_notif') === 'true' &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      );
    } catch {}

    try {
      const params = new URLSearchParams(window.location.search);
      const src = params.get('source');
      const sev = params.get('severity');
      const q   = params.get('q') || '';
      const validSources = ['CDC', 'WHO', 'ProMED', 'ReliefWeb', 'PAHO'];
      const validSeverities = ['high', 'medium', 'low'];
      setFilters({
        source:   (src && validSources.includes(src))    ? src as Source   : 'all',
        severity: (sev && validSeverities.includes(sev)) ? sev as Severity : 'all',
        search: q,
      });
    } catch {}

    // Seed prevIds from initial data so we don't trigger alerts on first load
    if (initialData) {
      prevIdsRef.current = new Set(initialData.signals.map(s => s.id));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filters → URL (no page reload)
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (filters.source   !== 'all') params.set('source', filters.source);
      if (filters.severity !== 'all') params.set('severity', filters.severity);
      if (filters.search) params.set('q', filters.search);
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    } catch {}
  }, [filters]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/signals');
      if (res.ok) {
        const next = await res.json() as SignalsResponse;

        if (!isFirstFetch.current) {
          const newHigh = next.signals.filter(
            s => s.severity === 'high' && !prevIdsRef.current.has(s.id)
          );
          if (newHigh.length > 0) {
            try { if (localStorage.getItem('sentinel_audio') === 'true') playAlertTone('high'); } catch {}
            try {
              if (
                typeof Notification !== 'undefined' &&
                Notification.permission === 'granted' &&
                localStorage.getItem('sentinel_notif') === 'true'
              ) {
                new Notification(
                  `SENTINEL: ${newHigh.length} new high-severity alert${newHigh.length > 1 ? 's' : ''}`,
                  { body: newHigh.map(s => `${s.disease} — ${s.location}`).join('\n') }
                );
              }
            } catch {}
          }
        }

        isFirstFetch.current = false;
        prevIdsRef.current = new Set(next.signals.map(s => s.id));
        setData(next);
        setFetchedAt(new Date());
      }
    } catch (e) {
      console.error('[SENTINEL] Polling error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!initialData) { Promise.resolve().then(() => { if (active) void fetchData(); }); }
    const id = setInterval(fetchData, REFRESH_MS);
    return () => { active = false; clearInterval(id); };
  }, [fetchData, initialData]);

  // Track new signals (newer than last visit)
  useEffect(() => {
    if (!data) return;
    try {
      const lastVisitStr = localStorage.getItem('sentinel_last_visit');
      const cutoff = lastVisitStr ? new Date(lastVisitStr) : new Date(0);
      const ids = new Set(
        data.signals
          .filter(s => { try { return new Date(s.publishedAt) > cutoff; } catch { return false; } })
          .map(s => s.id)
      );
      setNewSignalIds(ids);
      localStorage.setItem('sentinel_last_visit', new Date().toISOString());
    } catch {}
  }, [data]);

  const toggleNotif = useCallback(async () => {
    if (!notifEnabled) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setNotifEnabled(true);
          localStorage.setItem('sentinel_notif', 'true');
        }
      } catch {}
    } else {
      setNotifEnabled(false);
      try { localStorage.setItem('sentinel_notif', 'false'); } catch {}
    }
  }, [notifEnabled]);

  const toggleAudio = useCallback(() => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    try { localStorage.setItem('sentinel_audio', next ? 'true' : 'false'); } catch {}
    if (next) { playAlertTone('medium'); }
  }, [audioEnabled]);

  // Filtered signal list
  const filtered = useMemo<Signal[]>(() => {
    if (!data) return [];
    return data.signals.filter(s => {
      if (filters.source   !== 'all' && s.source   !== filters.source)   return false;
      if (filters.severity !== 'all' && s.severity !== filters.severity) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return s.title.toLowerCase().includes(q) ||
               s.description.toLowerCase().includes(q) ||
               s.region.toLowerCase().includes(q) ||
               s.disease.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, filters]);

  const topThreats = useMemo<Signal[]>(() => {
    if (!data) return [];
    return [...data.signals]
      .sort((a, b) => {
        const w = { high: 2, medium: 1, low: 0 };
        if (w[b.severity] !== w[a.severity]) return w[b.severity] - w[a.severity];
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, 3);
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const all = data.signals;
    const safe = (iso: string, d: Date) => { try { return isAfter(parseISO(iso), d); } catch { return false; } };
    const last24h = all.filter(s => safe(s.publishedAt, subHours(now, 24))).length;
    const last7d  = all.filter(s => safe(s.publishedAt, subDays(now, 7))).length;
    const regionCounts = all.reduce((acc, s) => ({ ...acc, [s.region]: (acc[s.region] || 0) + 1 }), {} as Record<string, number>);
    const topRegion = Object.entries(regionCounts).sort(([,a],[,b]) => b - a)[0]?.[0] || '—';
    const bySev = (sev: Severity) => all.filter(s => s.severity === sev).length;
    return { total: all.length, last24h, last7d, topRegion, high: bySev('high'), med: bySev('medium') };
  }, [data]);

  const threat = useMemo(() => computeThreat(data?.signals ?? []), [data]);

  const failedSources = data
    ? (Object.entries(data.sourceStatus) as [Source, 'ok' | 'error'][]).filter(([,v]) => v === 'error')
    : [];

  const lastUpdatedText = fetchedAt ? formatDistanceToNow(fetchedAt, { addSuffix: true }) : '—';

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: '#030d1a', color: '#e2e8f0' }}>
      {/* Scan line */}
      <div
        className="pointer-events-none fixed inset-x-0 h-px opacity-[0.06]"
        style={{ background: 'linear-gradient(90deg,transparent,#22d3ee,transparent)', animation: 'scan 10s linear infinite', top: 0 }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Header ── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: '#4ade80', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#4ade80' }} />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em]"
                style={{ color: '#4ade80', textShadow: '0 0 10px rgba(74,222,128,0.5)' }}>
                SENTINEL ONLINE
              </span>
            </div>
            <h1 className="text-5xl font-mono font-bold leading-none"
              style={{ color: '#22d3ee', textShadow: '0 0 30px rgba(34,211,238,0.45),0 0 80px rgba(34,211,238,0.15)' }}>
              SENTINEL
            </h1>
            <p className="text-[11px] font-mono text-slate-600 mt-1 uppercase tracking-wider">
              Community Disease Intelligence Network
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Action buttons */}
            <div className="flex items-center flex-wrap gap-2 justify-end">
              <HeaderBtn onClick={toggleAudio} title="Toggle audio alerts" active={audioEnabled}>
                {audioEnabled ? '🔔' : '🔕'} Audio
              </HeaderBtn>
              <HeaderBtn onClick={toggleNotif} title="Toggle browser notifications" active={notifEnabled}>
                {notifEnabled ? '📣' : '📵'} Alerts
              </HeaderBtn>
              <HeaderBtn onClick={() => exportToCsv(filtered)} title="Export current signals to CSV" active={false}>
                ↓ Export CSV
              </HeaderBtn>
            </div>

            <div className="text-right">
              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-700 mb-0.5">Last Refreshed</p>
              <p className="text-[12px] font-mono text-slate-400">{lastUpdatedText}</p>
              <p className="text-[9px] font-mono text-slate-700 mt-1.5 flex items-center justify-end gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: '#22d3ee', animation: 'pulse 2s infinite' }} />
                Auto-refresh 5 min
                {newSignalIds.size > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold"
                    style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
                    {newSignalIds.size} NEW
                  </span>
                )}
              </p>
            </div>
          </div>
        </header>

        {/* Source errors */}
        {failedSources.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {failedSources.map(([src]) => (
              <span key={src} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{src} unavailable
              </span>
            ))}
          </div>
        )}

        {/* ── Threat gauge ── */}
        <ThreatGauge level={threat.level} score={threat.score} color={threat.color} />

        {/* ── Stats bar ── */}
        {stats ? (
          <StatsBar items={[
            { label: 'Active Signals', value: stats.total,     accent: '#22d3ee' },
            { label: 'High Severity',  value: stats.high,      accent: '#ef4444' },
            { label: 'Last 24 Hours',  value: stats.last24h,   accent: '#a78bfa' },
            { label: 'Top Region',     value: stats.topRegion, accent: '#4ade80' },
          ]} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md p-4 animate-pulse"
                style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f38)', border: '1px solid #1a3352' }}>
                <div className="h-2.5 bg-slate-800 rounded w-2/3 mb-3" />
                <div className="h-7 bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* ── Top Active Incidents ── */}
        {topThreats.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-slate-800" />
              <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-600">Top Active Incidents</h2>
              <div className="h-px flex-1 bg-slate-800" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topThreats.map((sig, i) => (
                <TopThreatCard key={sig.id} signal={sig} rank={i + 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── World Map ── */}
        {data && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-slate-800" />
              <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-600">Geographic Distribution</h2>
              <div className="h-px flex-1 bg-slate-800" />
            </div>
            <SignalMap signals={data.signals} />
          </div>
        )}

        {/* ── Disease Breakdown + History Chart ── */}
        {data && data.signals.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-slate-800" />
              <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-600">Analysis</h2>
              <div className="h-px flex-1 bg-slate-800" />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <DiseaseBreakdown signals={data.signals} />
              <HistoryChart signals={data.signals} />
            </div>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="rounded-md p-3" style={{ background: '#060f20', border: '1px solid #1a3352' }}>
          <FilterBar
            filters={filters}
            onChange={setFilters}
            sourceStatus={data?.sourceStatus ?? { CDC: 'ok', WHO: 'ok', ProMED: 'ok', ReliefWeb: 'ok', PAHO: 'ok', OutbreakNews: 'ok' }}
          />
        </div>

        {/* Result count + clear */}
        {data && (
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-700">
              {filtered.length} of {data.signals.length} signals
            </span>
            {(filters.search || filters.source !== 'all' || filters.severity !== 'all') && (
              <button
                onClick={() => setFilters({ source: 'all', severity: 'all', search: '' })}
                className="text-[9px] font-mono uppercase text-slate-600 hover:text-cyan-400 transition-colors"
              >
                [clear filters]
              </button>
            )}
          </div>
        )}

        {/* ── Signal Feed ── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-600">Intelligence Feed</h2>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {loading ? (
            <div className="rounded-md overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#080f1e,#0a1628)', border: '1px solid #1a3352' }}>
              <div className="px-4 py-3 border-b border-slate-800/70">
                <div className="h-3 bg-slate-800 rounded w-32 animate-pulse" />
              </div>
              <div>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            </div>
          ) : (
            <SignalFeed
              signals={filtered}
              title="All Signals"
              newSignalIds={newSignalIds}
              onSignalClick={setDrawerSignal}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="pt-4 pb-2" style={{ borderTop: '1px solid #0d1f38' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-800">
              SENTINEL v3.0 · Community Disease Intelligence Network
            </span>
            <span className="text-[9px] font-mono text-slate-800">
              CDC · WHO · PAHO · ProMED · ReliefWeb · OutbreakNews
            </span>
          </div>
        </footer>
      </div>

      {/* ── Signal Drawer ── */}
      <SignalDrawer signal={drawerSignal} onClose={() => setDrawerSignal(null)} />
    </div>
  );
}
