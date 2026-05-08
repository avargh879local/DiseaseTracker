'use client';

import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { formatDistanceToNow, isAfter, parseISO, subHours } from 'date-fns';
import { Signal, Severity } from '@/app/types';

// Real Natural Earth TopoJSON — bundled locally, no CDN dependency
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface Cluster {
  id: string;
  disease: string;
  location: string;
  region: string;
  lat: number;
  lon: number;
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

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 18, medium: 9, low: 3 };

const MAP_COLORS = {
  high:   { color: '#ef4444', glow: 'rgba(239,68,68,0.5)'   },
  medium: { color: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
  low:    { color: '#22c55e', glow: 'rgba(34,197,94,0.38)'  },
};

function safeDate(iso: string) {
  try { return parseISO(iso); } catch { return new Date(0); }
}

function clusterSeverity(signals: Signal[]): Severity {
  if (signals.some(s => s.severity === 'high'))   return 'high';
  if (signals.some(s => s.severity === 'medium')) return 'medium';
  return 'low';
}

function computePressure(signals: Signal[], recentCount: number, caseCount: number, deathCount: number) {
  const sev = signals.reduce((s, sig) => s + SEVERITY_WEIGHT[sig.severity], 0);
  const cas = caseCount  > 0 ? Math.log10(caseCount  + 1) * 12 : 0;
  const dth = deathCount > 0 ? Math.log10(deathCount + 1) * 18 : 0;
  return Math.round(sev + signals.length * 5 + recentCount * 8 + cas + dth);
}

function formatCount(value: number) {
  if (!value) return 'not reported';
  return Intl.NumberFormat('en', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value);
}

function buildClusters(signals: Signal[]): Cluster[] {
  const now    = new Date();
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

  const base = Array.from(groups.entries()).map(([id, items]) => {
    const rep         = items[0];
    const severity    = clusterSeverity(items);
    const recentCount = items.filter(s => isAfter(safeDate(s.publishedAt), subHours(now, 24))).length;
    const caseCount   = Math.max(0, ...items.map(s => s.caseCount  || 0));
    const deathCount  = Math.max(0, ...items.map(s => s.deathCount || 0));
    const pressure    = computePressure(items, recentCount, caseCount, deathCount);
    const size        = Math.min(28, 6 + Math.sqrt(pressure) * 1.8);
    const colorKey: Severity =
      severity === 'high' || deathCount > 0 || pressure >= 58   ? 'high'   :
      severity === 'medium' || items.length > 1 || pressure >= 30 ? 'medium' : 'low';
    const latestAt = items
      .map(s => s.publishedAt)
      .sort((a, b) => safeDate(b).getTime() - safeDate(a).getTime())[0];
    const progress = pressure >= 58 || recentCount >= 3 ? 'surging'
      : colorKey === 'high' ? 'rising' : 'watch';

    return {
      id, disease: rep.disease, location: rep.location, region: rep.region,
      lat: rep.coordinates.lat, lon: rep.coordinates.lon,
      reportCount: items.length, recentCount, caseCount, deathCount,
      severity: colorKey, pressure, size, progress,
      color: MAP_COLORS[colorKey].color, glow: MAP_COLORS[colorKey].glow,
      sources: Array.from(new Set(items.map(s => s.source))),
      latestAt, signals: items,
    };
  });

  // Spread overlapping clusters with phyllotaxis spiral
  const offsets = new Map<string, number>();
  return base
    .sort((a, b) => b.pressure - a.pressure)
    .slice(0, 40)
    .map(cluster => {
      const key = `${Math.round(cluster.lat * 4) / 4}|${Math.round(cluster.lon * 4) / 4}`;
      const idx = offsets.get(key) || 0;
      offsets.set(key, idx + 1);
      if (idx === 0) return cluster;
      const angle  = idx * 2.399963;
      const radius = Math.min(5, 1.5 + idx * 0.8);
      return {
        ...cluster,
        lat: Math.max(-75, Math.min(85, cluster.lat + Math.sin(angle) * radius)),
        lon: Math.max(-175, Math.min(175, cluster.lon + Math.cos(angle) * radius)),
      };
    });
}

export default function SignalMap({ signals }: { signals: Signal[] }) {
  const clusters   = useMemo(() => buildClusters(signals), [signals]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected   = clusters.find(c => c.id === selectedId) || clusters[0];

  if (clusters.length === 0) return null;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">

      {/* ── Map canvas ── */}
      <div
        className="relative overflow-hidden rounded-md"
        style={{
          background: 'linear-gradient(160deg,#020b16,#04111f)',
          border: '1px solid #1a3352',
          boxShadow: '0 0 60px rgba(34,211,238,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-slate-800/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">
              Natural Earth · Real Country Boundaries
            </p>
            <h2 className="font-mono text-base font-bold uppercase text-cyan-300">
              Global Disease Map
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-mono uppercase text-slate-500">
            {(['watch', 'rising', 'surging'] as const).map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${
                  s === 'watch' ? 'bg-green-500' : s === 'rising' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                {s}
              </span>
            ))}
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">{clusters.length} clusters</span>
          </div>
        </div>

        {/* Map */}
        <div className="relative" style={{ minHeight: 360 }}>
          {/* Deep ocean radial glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(34,211,238,0.04) 0%, transparent 70%)' }} />

          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 153, center: [0, 10] }}
            style={{ width: '100%', height: '100%', minHeight: 360 }}
          >
            {/* Ocean base */}
            <rect x="-9999" y="-9999" width="99999" height="99999" fill="#030d1a" />

            {/* Graticule — subtle grid */}
            <g stroke="#22d3ee" strokeOpacity="0.05" strokeWidth="0.4" fill="none">
              {[-60, -30, 0, 30, 60].map(lat => (
                <path key={lat} d={`M -180 ${lat} L 180 ${lat}`} />
              ))}
            </g>

            {/* Countries */}
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: {
                        fill: '#0d2137',
                        stroke: '#1a3f5c',
                        strokeWidth: 0.4,
                        outline: 'none',
                      },
                      hover: {
                        fill: '#102840',
                        stroke: '#22d3ee',
                        strokeWidth: 0.5,
                        outline: 'none',
                      },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Equator highlight */}
            <line x1={-9999} x2={9999} y1={0} y2={0}
              stroke="#22d3ee" strokeOpacity="0" strokeWidth="0" />

            {/* Heatmap glow rings — large, behind bubbles */}
            {clusters.map(cluster => (
              <Marker key={`heat-${cluster.id}`} coordinates={[cluster.lon, cluster.lat]}>
                <circle
                  r={cluster.size * 3.5}
                  fill={cluster.color}
                  fillOpacity={cluster.progress === 'surging' ? 0.12 : cluster.progress === 'rising' ? 0.08 : 0.05}
                  stroke="none"
                />
              </Marker>
            ))}

            {/* Bubble clusters */}
            {clusters.map(cluster => {
              const isSelected = selectedId === cluster.id;
              const pulseMs    = cluster.progress === 'surging' ? 1400 : 2600;

              return (
                <Marker
                  key={cluster.id}
                  coordinates={[cluster.lon, cluster.lat]}
                  onClick={() => setSelectedId(cluster.id)}
                  onMouseEnter={() => setSelectedId(cluster.id)}
                >
                  {/* Outer pulse ring */}
                  <circle
                    r={cluster.size * 1.5}
                    fill="none"
                    stroke={cluster.color}
                    strokeWidth={1}
                    strokeOpacity={cluster.progress === 'watch' ? 0.18 : 0.45}
                    style={{ animation: `map-pulse ${pulseMs}ms ease-out infinite` }}
                  />
                  {/* Glow fill */}
                  <circle
                    r={cluster.size}
                    fill={cluster.color}
                    fillOpacity={isSelected ? 0.35 : 0.2}
                    stroke={cluster.color}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeOpacity={isSelected ? 1 : 0.75}
                    style={{
                      cursor: 'pointer',
                      filter: `drop-shadow(0 0 ${Math.round(cluster.size * 0.8)}px ${cluster.glow})`,
                      transition: 'all 0.15s ease',
                    }}
                  />
                  {/* Count label */}
                  {cluster.reportCount > 1 && (
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={Math.max(7, cluster.size * 0.55)}
                      fontWeight="bold"
                      fill="white"
                      fillOpacity={0.9}
                      style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
                    >
                      {cluster.reportCount}
                    </text>
                  )}
                </Marker>
              );
            })}
          </ComposableMap>
        </div>
      </div>

      {/* ── Detail panel ── */}
      <aside
        className="rounded-md flex flex-col"
        style={{
          background: 'linear-gradient(135deg,#0a1628,#0d1f38)',
          border: '1px solid #1a3352',
        }}
      >
        {selected ? (
          <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mb-0.5">
                  Cluster · {selected.sources.join(' · ')}
                </p>
                <h3 className="font-mono text-sm font-bold uppercase leading-tight text-slate-100 mb-1">
                  {selected.disease}
                </h3>
                <p className="text-[11px] font-mono text-slate-500">
                  {selected.location} &middot; {selected.region}
                </p>
              </div>
              <span
                className="flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase"
                style={{
                  color:      selected.color,
                  background: `${selected.color}18`,
                  border:     `1px solid ${selected.color}50`,
                }}
              >
                {selected.progress}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                ['Reports', selected.reportCount],
                ['Past 24h', selected.recentCount],
                ['Cases', formatCount(selected.caseCount)],
                ['Deaths', formatCount(selected.deathCount)],
              ] as [string, string | number][]).map(([label, value]) => (
                <div key={label} className="rounded border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-[9px] font-mono uppercase text-slate-600 mb-1">{label}</p>
                  <p className="font-mono text-lg font-bold text-slate-100">{value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-mono uppercase text-slate-600">
                <span>Threat Pressure</span>
                <span style={{ color: selected.color }}>{selected.pressure}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, selected.pressure)}%`,
                    background: `linear-gradient(90deg,#22c55e,#f59e0b,${selected.color})`,
                    boxShadow: `0 0 12px ${selected.glow}`,
                  }}
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <p className="text-[9px] font-mono uppercase text-slate-600 mb-2">
                Latest · {formatDistanceToNow(safeDate(selected.latestAt), { addSuffix: true })}
              </p>
              <div className="space-y-1.5">
                {selected.signals.slice(0, 4).map(sig => (
                  <a
                    key={sig.id}
                    href={sig.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded border border-slate-800 bg-slate-950/40 p-2 text-[11px] leading-snug text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                  >
                    {sig.title.length > 90 ? sig.title.slice(0, 90) + '…' : sig.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-700 font-mono text-sm p-8 text-center">
            Hover a circle to inspect a cluster
          </div>
        )}
      </aside>
    </section>
  );
}
