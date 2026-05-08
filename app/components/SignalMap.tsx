'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow, isAfter, parseISO, subHours } from 'date-fns';
import { Signal, Severity } from '@/app/types';

interface Cluster {
  id: string;
  disease: string;
  location: string;
  region: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  reportCount: number;
  recentCount: number;
  caseCount: number;
  deathCount: number;
  severity: Severity;
  pressure: number;
  size: number;
  color: string;
  glow: string;
  progress: string;
  sources: string[];
  latestAt: string;
  signals: Signal[];
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 18,
  medium: 9,
  low: 3,
};

const MAP_COLORS = {
  high: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.45)', progress: 'surging' },
  medium: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.42)', progress: 'rising' },
  low: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.34)', progress: 'watch' },
};

function project(lon: number, lat: number) {
  return {
    x: ((lon + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

function safeDate(iso: string) {
  try {
    return parseISO(iso);
  } catch {
    return new Date(0);
  }
}

function clusterSeverity(signals: Signal[]): Severity {
  if (signals.some((signal) => signal.severity === 'high')) return 'high';
  if (signals.some((signal) => signal.severity === 'medium')) return 'medium';
  return 'low';
}

function computePressure(signals: Signal[], recentCount: number, caseCount: number, deathCount: number) {
  const severityPressure = signals.reduce((sum, signal) => sum + SEVERITY_WEIGHT[signal.severity], 0);
  const reportPressure = signals.length * 5;
  const recentPressure = recentCount * 8;
  const casePressure = caseCount > 0 ? Math.log10(caseCount + 1) * 12 : 0;
  const deathPressure = deathCount > 0 ? Math.log10(deathCount + 1) * 18 : 0;

  return Math.round(severityPressure + reportPressure + recentPressure + casePressure + deathPressure);
}

function formatCount(value: number) {
  if (!value) return 'not reported';
  return Intl.NumberFormat('en', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value);
}

function buildClusters(signals: Signal[]): Cluster[] {
  const now = new Date();
  const groups = new Map<string, Signal[]>();

  for (const signal of signals) {
    const key = [
      signal.disease,
      signal.location,
      Math.round(signal.coordinates.lat * 10) / 10,
      Math.round(signal.coordinates.lon * 10) / 10,
    ].join('|');
    groups.set(key, [...(groups.get(key) || []), signal]);
  }

  const baseClusters = Array.from(groups.entries()).map(([id, items]) => {
    const representative = items[0];
    const severity = clusterSeverity(items);
    const recentCount = items.filter((signal) => isAfter(safeDate(signal.publishedAt), subHours(now, 24))).length;
    const caseCount = Math.max(0, ...items.map((signal) => signal.caseCount || 0));
    const deathCount = Math.max(0, ...items.map((signal) => signal.deathCount || 0));
    const pressure = computePressure(items, recentCount, caseCount, deathCount);
    const size = Math.min(58, 12 + Math.sqrt(pressure) * 3.4);
    const colorKey: Severity =
      severity === 'high' || deathCount > 0 || pressure >= 58
        ? 'high'
        : severity === 'medium' || items.length > 1 || caseCount >= 25 || pressure >= 30
          ? 'medium'
          : 'low';
    const projected = project(representative.coordinates.lon, representative.coordinates.lat);
    const latestAt = items
      .map((signal) => signal.publishedAt)
      .sort((a, b) => safeDate(b).getTime() - safeDate(a).getTime())[0];

    return {
      id,
      disease: representative.disease,
      location: representative.location,
      region: representative.region,
      lat: representative.coordinates.lat,
      lon: representative.coordinates.lon,
      x: projected.x,
      y: projected.y,
      reportCount: items.length,
      recentCount,
      caseCount,
      deathCount,
      severity: colorKey,
      pressure,
      size,
      color: MAP_COLORS[colorKey].color,
      glow: MAP_COLORS[colorKey].glow,
      progress: pressure >= 58 || recentCount >= 3 ? 'surging' : MAP_COLORS[colorKey].progress,
      sources: Array.from(new Set(items.map((signal) => signal.source))),
      latestAt,
      signals: items,
    };
  });

  const locationOffsets = new Map<string, number>();

  return baseClusters
    .sort((a, b) => b.pressure - a.pressure)
    .slice(0, 32)
    .map((cluster) => {
      const locationKey = `${Math.round(cluster.lat * 4) / 4}|${Math.round(cluster.lon * 4) / 4}`;
      const offsetIndex = locationOffsets.get(locationKey) || 0;
      locationOffsets.set(locationKey, offsetIndex + 1);

      if (offsetIndex === 0) return cluster;

      const angle = offsetIndex * 2.399963;
      const radius = Math.min(4.5, 1.5 + offsetIndex * 0.65);
      return {
        ...cluster,
        x: Math.max(4, Math.min(96, cluster.x + Math.cos(angle) * radius)),
        y: Math.max(7, Math.min(92, cluster.y + Math.sin(angle) * radius)),
      };
    });
}

function WorldMapShape() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 500" aria-hidden="true">
      <defs>
        <linearGradient id="mapLand" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#143554" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#0c2039" stopOpacity="0.78" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#12314f" strokeOpacity="0.48" strokeWidth="1">
        {Array.from({ length: 11 }).map((_, index) => (
          <line key={`v-${index}`} x1={index * 100} x2={index * 100} y1="0" y2="500" />
        ))}
        {Array.from({ length: 6 }).map((_, index) => (
          <line key={`h-${index}`} x1="0" x2="1000" y1={index * 100} y2={index * 100} />
        ))}
      </g>
      <g fill="url(#mapLand)" stroke="#1d5a7a" strokeOpacity="0.48" strokeWidth="1.2">
        <path d="M91 158 138 103 219 86 300 106 348 157 319 205 274 229 253 279 201 275 154 238 96 224 61 186Z" />
        <path d="M217 282 270 302 317 351 303 422 267 477 235 417 220 347Z" />
        <path d="M409 121 455 98 512 117 528 158 494 184 432 176 395 151Z" />
        <path d="M459 198 536 202 579 260 559 336 513 421 461 360 437 284Z" />
        <path d="M548 142 633 95 760 116 866 167 843 227 748 235 706 287 633 267 582 220 523 196Z" />
        <path d="M761 318 842 343 885 404 817 430 744 397Z" />
        <path d="M327 67 382 44 438 64 410 98 349 102Z" />
        <path d="M889 250 925 266 945 307 915 322 878 292Z" />
      </g>
      <path d="M0 250H1000" stroke="#22d3ee" strokeDasharray="4 10" strokeOpacity="0.12" />
    </svg>
  );
}

export default function SignalMap({ signals }: { signals: Signal[] }) {
  const clusters = useMemo(() => buildClusters(signals), [signals]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = clusters.find((cluster) => cluster.id === selectedId) || clusters[0];

  if (clusters.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div
        className="relative overflow-hidden rounded-md"
        style={{
          background: 'linear-gradient(135deg, rgba(6, 15, 32, 0.96), rgba(9, 25, 45, 0.94))',
          border: '1px solid #1a3352',
          boxShadow: '0 0 45px rgba(34, 211, 238, 0.08)',
        }}
      >
        <div className="flex flex-col gap-3 border-b border-slate-800/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[9px] font-mono uppercase text-slate-600">
              Geospatial signal field
            </div>
            <h2 className="font-mono text-lg font-bold uppercase text-cyan-300">
              World Disease Map
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" /> watch
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> rising
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> surging
            </span>
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden sm:min-h-[430px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.08),transparent_45%)]" />
          <WorldMapShape />

          {clusters.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              aria-label={`${cluster.disease} in ${cluster.location}: ${cluster.reportCount} ${cluster.reportCount === 1 ? 'report' : 'reports'}`}
              title={`${cluster.disease} / ${cluster.location}`}
              onClick={() => setSelectedId(cluster.id)}
              onMouseEnter={() => setSelectedId(cluster.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform duration-150 hover:z-20 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              style={{
                left: `${cluster.x}%`,
                top: `${cluster.y}%`,
                width: cluster.size,
                height: cluster.size,
                background: `${cluster.color}2b`,
                borderColor: cluster.color,
                boxShadow: `0 0 ${cluster.size}px ${cluster.glow}, inset 0 0 18px ${cluster.glow}`,
                zIndex: Math.min(50, Math.max(1, Math.round(cluster.pressure / 8))),
              }}
            >
              <span
                className="absolute inset-[-45%] rounded-full"
                style={{
                  border: `1px solid ${cluster.color}`,
                  opacity: cluster.progress === 'watch' ? 0.16 : 0.42,
                  animation: `map-pulse ${cluster.progress === 'surging' ? 1.4 : 2.6}s ease-out infinite`,
                }}
              />
              <span className="relative flex h-full w-full items-center justify-center rounded-full font-mono text-[10px] font-bold text-white">
                {cluster.reportCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside
        className="rounded-md p-4"
        style={{
          background: 'linear-gradient(135deg, #0a1628 0%, #0d1f38 100%)',
          border: '1px solid #1a3352',
        }}
      >
        {selected && (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-mono uppercase text-slate-600">
                  Selected cluster
                </div>
                <h3 className="mt-1 font-mono text-base font-bold uppercase leading-snug text-slate-100">
                  {selected.disease}
                </h3>
                <div className="mt-1 text-xs font-mono text-slate-500">
                  {selected.location} · {selected.region}
                </div>
              </div>
              <div
                className="rounded px-2 py-1 text-[10px] font-mono font-bold uppercase"
                style={{
                  color: selected.color,
                  background: `${selected.color}18`,
                  border: `1px solid ${selected.color}55`,
                }}
              >
                {selected.progress}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ['Reports', selected.reportCount],
                ['24h', selected.recentCount],
                ['Cases', formatCount(selected.caseCount)],
                ['Deaths', formatCount(selected.deathCount)],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-slate-800 bg-slate-950/35 p-3">
                  <div className="text-[9px] font-mono uppercase text-slate-600">{label}</div>
                  <div className="mt-1 font-mono text-lg font-bold text-slate-100">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-600">
                <span>Pressure</span>
                <span style={{ color: selected.color }}>{selected.pressure}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, selected.pressure)}%`,
                    background: `linear-gradient(90deg, #22c55e, #f59e0b, ${selected.color})`,
                    boxShadow: `0 0 14px ${selected.glow}`,
                  }}
                />
              </div>
              <div className="text-[11px] leading-relaxed text-slate-500">
                Reports · cases · deaths weighted
              </div>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="mb-2 text-[9px] font-mono uppercase text-slate-600">Source mix</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.sources.map((source) => (
                  <span
                    key={source}
                    className="rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-mono uppercase text-cyan-300"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="mb-2 text-[9px] font-mono uppercase text-slate-600">
                Latest report · {formatDistanceToNow(safeDate(selected.latestAt), { addSuffix: true })}
              </div>
              <div className="space-y-2">
                {selected.signals.slice(0, 3).map((signal) => (
                  <a
                    key={signal.id}
                    href={signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded border border-slate-800 bg-slate-950/35 p-2 text-[11px] leading-snug text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                  >
                    {signal.title}
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}
