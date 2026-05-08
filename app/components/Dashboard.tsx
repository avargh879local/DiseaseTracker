'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatDistanceToNow, parseISO, isAfter, subHours, subDays } from 'date-fns';
import { Signal, Source, SignalsResponse } from '@/app/types';
import AlertCard from './AlertCard';
import StatsBar from './StatsBar';
import FilterBar, { Filters } from './FilterBar';
import ThreatGauge from './ThreatGauge';
import SignalMap from './SignalMap';

const REFRESH_MS = 5 * 60 * 1000;

function computeThreat(signals: Signal[]): { level: string; score: number; color: string } {
  if (signals.length === 0) return { level: 'LOW', score: 0, color: '#22c55e' };
  const high = signals.filter((s) => s.severity === 'high').length;
  const med = signals.filter((s) => s.severity === 'medium').length;
  const low = signals.filter((s) => s.severity === 'low').length;
  const score = Math.min(
    100,
    Math.round(((high * 5 + med * 2 + low * 0.5) / (signals.length * 5)) * 100)
  );
  if (score < 25) return { level: 'LOW', score, color: '#22c55e' };
  if (score < 50) return { level: 'MODERATE', score, color: '#f59e0b' };
  if (score < 75) return { level: 'ELEVATED', score, color: '#f97316' };
  return { level: 'CRITICAL', score, color: '#ef4444' };
}

function SkeletonCard() {
  return (
    <div
      className="rounded-md p-4 animate-pulse"
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1f38 100%)',
        border: '1px solid #1a3352',
      }}
    >
      <div className="h-4 bg-slate-800 rounded w-full mb-2" />
      <div className="h-4 bg-slate-800 rounded w-4/5 mb-3" />
      <div className="h-3 bg-slate-900 rounded w-full mb-1.5" />
      <div className="h-3 bg-slate-900 rounded w-5/6 mb-4" />
      <div className="flex justify-between pt-2 border-t border-slate-800">
        <div className="h-5 bg-slate-800 rounded w-16" />
        <div className="h-5 bg-slate-800 rounded w-14" />
      </div>
    </div>
  );
}

export default function Dashboard({ initialData }: { initialData: SignalsResponse | null }) {
  const [data, setData] = useState<SignalsResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(initialData ? new Date() : null);
  const [filters, setFilters] = useState<Filters>({ source: 'all', severity: 'all', search: '' });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/signals');
      if (res.ok) {
        const json = (await res.json()) as SignalsResponse;
        setData(json);
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
    if (!initialData) {
      Promise.resolve().then(() => {
        if (active) void fetchData();
      });
    }
    const id = setInterval(fetchData, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [fetchData, initialData]);

  const filteredSignals = useMemo<Signal[]>(() => {
    if (!data) return [];
    return data.signals.filter((s) => {
      if (filters.source !== 'all' && s.source !== filters.source) return false;
      if (filters.severity !== 'all' && s.severity !== filters.severity) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, filters]);

  const stats = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const all = data.signals;

    const safeIsAfter = (iso: string, date: Date) => {
      try { return isAfter(parseISO(iso), date); } catch { return false; }
    };

    const last24h = all.filter((s) => safeIsAfter(s.publishedAt, subHours(now, 24))).length;
    const last7d = all.filter((s) => safeIsAfter(s.publishedAt, subDays(now, 7))).length;

    const regionCounts = all.reduce((acc, s) => {
      acc[s.region] = (acc[s.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topRegion = Object.entries(regionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '—';

    return { total: all.length, last24h, last7d, topRegion };
  }, [data]);

  const threat = useMemo(() => computeThreat(data?.signals ?? []), [data]);

  const lastUpdatedText = fetchedAt
    ? formatDistanceToNow(fetchedAt, { addSuffix: true })
    : '—';

  const failedSources = data
    ? (Object.entries(data.sourceStatus) as [Source, 'ok' | 'error'][]).filter(
        ([, v]) => v === 'error'
      )
    : [];

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: '#030d1a', color: '#e2e8f0' }}>
      {/* Scan line */}
      <div
        className="pointer-events-none fixed inset-x-0 h-px opacity-[0.06]"
        style={{
          background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)',
          animation: 'scan 10s linear infinite',
          top: 0,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ── Header ── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* Online indicator */}
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{
                    background: '#4ade80',
                    animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                  }}
                />
                <span
                  className="relative inline-flex rounded-full h-2.5 w-2.5"
                  style={{ background: '#4ade80' }}
                />
              </span>
              <span
                className="text-[10px] font-mono uppercase tracking-[0.2em]"
                style={{ color: '#4ade80', textShadow: '0 0 10px rgba(74,222,128,0.5)' }}
              >
                SENTINEL ONLINE
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-5xl font-mono font-bold leading-none"
              style={{
                color: '#22d3ee',
                textShadow:
                  '0 0 30px rgba(34,211,238,0.45), 0 0 80px rgba(34,211,238,0.15)',
              }}
            >
              SENTINEL
            </h1>
            <p className="text-[11px] font-mono text-slate-600 mt-1 tracking-wider uppercase">
              Community Disease Intelligence Network
            </p>
          </div>

          <div className="self-end text-right flex-shrink-0">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-slate-700 mb-0.5">
              Last Refreshed
            </div>
            <div className="text-[12px] font-mono text-slate-400">{lastUpdatedText}</div>
            <div className="text-[9px] font-mono text-slate-700 mt-1.5 flex items-center justify-end gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: '#22d3ee', animation: 'pulse 2s infinite' }}
              />
              Auto-refresh 5 min
            </div>
          </div>
        </header>

        {/* ── Source error notices ── */}
        {failedSources.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {failedSources.map(([src]) => (
              <span
                key={src}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#f87171',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {src} unavailable
              </span>
            ))}
          </div>
        )}

        {/* ── Threat Gauge ── */}
        <ThreatGauge level={threat.level} score={threat.score} color={threat.color} />

        {/* ── Stats Bar ── */}
        {stats ? (
          <StatsBar
            items={[
              { label: 'Active Signals', value: stats.total, accent: '#22d3ee' },
              { label: 'Last 24 Hours', value: stats.last24h, accent: '#a78bfa' },
              { label: 'Last 7 Days', value: stats.last7d, accent: '#60a5fa' },
              { label: 'Top Region', value: stats.topRegion, accent: '#4ade80' },
            ]}
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md p-4 animate-pulse"
                style={{
                  background: 'linear-gradient(135deg, #0a1628, #0d1f38)',
                  border: '1px solid #1a3352',
                }}
              >
                <div className="h-2.5 bg-slate-800 rounded w-2/3 mb-3" />
                <div className="h-7 bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* ── Filter Bar ── */}
        <div
          className="rounded-md p-3"
          style={{ background: '#060f20', border: '1px solid #1a3352' }}
        >
          <FilterBar
            filters={filters}
            onChange={setFilters}
            sourceStatus={
              data?.sourceStatus ?? {
                CDC: 'ok',
                WHO: 'ok',
                ProMED: 'ok',
                ReliefWeb: 'ok',
              }
            }
          />
        </div>

        {data && <SignalMap signals={filteredSignals} />}

        {/* ── Result count ── */}
        {data && (
          <div className="flex items-center gap-2">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-700">
              {filteredSignals.length} of {data.signals.length} signals
            </div>
            {filters.search || filters.source !== 'all' || filters.severity !== 'all' ? (
              <button
                onClick={() =>
                  setFilters({ source: 'all', severity: 'all', search: '' })
                }
                className="text-[9px] font-mono uppercase tracking-wider text-slate-600 hover:text-cyan-400 transition-colors"
              >
                [clear filters]
              </button>
            ) : null}
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredSignals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSignals.map((signal) => (
              <AlertCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="text-5xl font-mono mb-4"
              style={{ color: '#1a3352' }}
            >
              {'//'}
            </div>
            <div className="text-sm font-mono text-slate-600">
              {data ? 'No signals match current filters' : 'No signal data available'}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer
          className="pt-4 pb-2"
          style={{ borderTop: '1px solid #0d1f38' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-slate-800">
              SENTINEL v1.0 · Community Disease Intelligence Network
            </div>
            <div className="text-[9px] font-mono text-slate-800">
              CDC · WHO · ProMED · ReliefWeb
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
