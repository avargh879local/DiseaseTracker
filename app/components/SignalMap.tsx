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

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 18, medium: 9, low: 3 };

const MAP_COLORS = {
  high:   { color: '#ef4444', glow: 'rgba(239,68,68,0.45)',   progress: 'surging' },
  medium: { color: '#f59e0b', glow: 'rgba(245,158,11,0.42)',  progress: 'rising'  },
  low:    { color: '#22c55e', glow: 'rgba(34,197,94,0.34)',   progress: 'watch'   },
};

// Equirectangular: x = (lon+180)/360 * W,  y = (90-lat)/180 * H
// SVG viewBox is 1000 × 500 so scale factor = 10 for x, 500/180 ≈ 2.778 for y
function project(lon: number, lat: number) {
  return {
    x: ((lon + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

// Same projection scaled to SVG viewBox 1000×500
function svgPt(lon: number, lat: number): string {
  const x = Math.round(((lon + 180) / 360) * 1000);
  const y = Math.round(((90 - lat) / 180) * 500);
  return `${x},${y}`;
}

function pts(...pairs: [number, number][]): string {
  return 'M' + pairs.map(([lo, la]) => svgPt(lo, la)).join(' L') + ' Z';
}

function safeDate(iso: string) {
  try { return parseISO(iso); } catch { return new Date(0); }
}

function clusterSeverity(signals: Signal[]): Severity {
  if (signals.some(s => s.severity === 'high')) return 'high';
  if (signals.some(s => s.severity === 'medium')) return 'medium';
  return 'low';
}

function computePressure(signals: Signal[], recentCount: number, caseCount: number, deathCount: number) {
  const sev  = signals.reduce((s, sig) => s + SEVERITY_WEIGHT[sig.severity], 0);
  const rep  = signals.length * 5;
  const rec  = recentCount * 8;
  const cas  = caseCount  > 0 ? Math.log10(caseCount  + 1) * 12 : 0;
  const dth  = deathCount > 0 ? Math.log10(deathCount + 1) * 18 : 0;
  return Math.round(sev + rep + rec + cas + dth);
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
    const rep        = items[0];
    const severity   = clusterSeverity(items);
    const recentCount = items.filter(s => isAfter(safeDate(s.publishedAt), subHours(now, 24))).length;
    const caseCount  = Math.max(0, ...items.map(s => s.caseCount  || 0));
    const deathCount = Math.max(0, ...items.map(s => s.deathCount || 0));
    const pressure   = computePressure(items, recentCount, caseCount, deathCount);
    const size       = Math.min(58, 12 + Math.sqrt(pressure) * 3.4);
    const colorKey: Severity =
      severity === 'high' || deathCount > 0 || pressure >= 58   ? 'high'   :
      severity === 'medium' || items.length > 1 || pressure >= 30 ? 'medium' : 'low';
    const proj    = project(rep.coordinates.lon, rep.coordinates.lat);
    const latestAt = items.map(s => s.publishedAt).sort((a, b) => safeDate(b).getTime() - safeDate(a).getTime())[0];

    return {
      id, disease: rep.disease, location: rep.location, region: rep.region,
      lat: rep.coordinates.lat, lon: rep.coordinates.lon,
      x: proj.x, y: proj.y,
      reportCount: items.length, recentCount, caseCount, deathCount,
      severity: colorKey, pressure, size,
      color: MAP_COLORS[colorKey].color, glow: MAP_COLORS[colorKey].glow,
      progress: pressure >= 58 || recentCount >= 3 ? 'surging' : MAP_COLORS[colorKey].progress,
      sources: Array.from(new Set(items.map(s => s.source))),
      latestAt, signals: items,
    };
  });

  const offsets = new Map<string, number>();
  return base
    .sort((a, b) => b.pressure - a.pressure)
    .slice(0, 35)
    .map(cluster => {
      const key   = `${Math.round(cluster.lat * 4) / 4}|${Math.round(cluster.lon * 4) / 4}`;
      const idx   = offsets.get(key) || 0;
      offsets.set(key, idx + 1);
      if (idx === 0) return cluster;
      const angle  = idx * 2.399963;
      const radius = Math.min(4.5, 1.5 + idx * 0.65);
      return {
        ...cluster,
        x: Math.max(3, Math.min(97, cluster.x + Math.cos(angle) * radius)),
        y: Math.max(6, Math.min(93, cluster.y + Math.sin(angle) * radius)),
      };
    });
}

// ── Geographically accurate landmass paths in equirectangular projection ──
// All paths derived from (lon, lat) → x=(lon+180)/360*1000, y=(90-lat)/180*500
function WorldMapShape() {
  const northAmerica = pts(
    [-170,68],[-168,56],[-155,58],[-140,59],[-130,52],[-125,48],
    [-124,43],[-117,32],[-110,22],[-87,15], [-79,8], [-76,15],
    [-80,25], [-74,41],[-68,45], [-52,47], [-54,60],[-64,64],
    [-90,68], [-120,70],[-141,71]
  );

  const southAmerica = pts(
    [-80,12],[-77,7], [-73,2], [-70,-5],[-72,-15],[-75,-28],
    [-72,-42],[-68,-55],[-63,-55],[-56,-40],[-50,-28],[-40,-20],
    [-35,-8], [-38,0], [-50,5], [-60,10],[-72,12]
  );

  // Eurasia: Europe → Russia → Central/South/East Asia → SE Asia → back
  const eurasia = pts(
    [-10,36],[2,51], [10,54],[18,55],[29,62],[29,70],[30,72],
    [40,68], [60,68],[80,73],[105,77],[140,73],[141,68],[145,63],
    [140,55],[135,48],[132,44],[130,32],[131,13],[124,-3],[117,-8],
    [110,-8],[100,1], [97,8], [85,20],[80,14],[77,8], [73,22],
    [60,22], [50,26],[38,27],[38,37],[26,40],[10,37],[-6,36]
  );

  const africa = pts(
    [-18,34],[-6,36],[10,37],[20,30],[32,30],[43,11],[51,12],
    [50,2],  [42,-12],[38,-25],[32,-34],[18,-35],[13,-29],[12,-18],
    [12,-5], [10,4],  [3,6],  [-1,5], [-5,5], [-10,7],[-17,14]
  );

  const australia = pts(
    [114,-22],[123,-15],[135,-14],[148,-18],[153,-24],
    [151,-33],[138,-36],[130,-32],[117,-36],[115,-31]
  );

  const greenland = pts(
    [-50,60],[-28,60],[-18,75],[-30,83],[-50,83],[-60,75]
  );

  // Continent label positions [lon, lat, label]
  const labels: [number, number, string][] = [
    [-100, 48,  'N. AMERICA'],
    [-60,  -20, 'S. AMERICA'],
    [20,   52,  'EUROPE'],
    [20,   5,   'AFRICA'],
    [90,   45,  'ASIA'],
    [134,  -28, 'AUSTRALIA'],
  ];

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 500" aria-hidden="true">
      <defs>
        <linearGradient id="landGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="#0e2a45" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#081929" stopOpacity="0.9" />
        </linearGradient>
        <filter id="landGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Graticule grid */}
      <g stroke="#22d3ee" strokeOpacity="0.06" strokeWidth="0.7">
        {[-60,-30,0,30,60].map(lat => (
          <line key={lat}
            x1="0" x2="1000"
            y1={((90 - lat) / 180) * 500}
            y2={((90 - lat) / 180) * 500}
          />
        ))}
        {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lon => (
          <line key={lon}
            x1={((lon + 180) / 360) * 1000} x2={((lon + 180) / 360) * 1000}
            y1="0" y2="500"
          />
        ))}
      </g>

      {/* Equator highlight */}
      <line x1="0" x2="1000" y1="250" y2="250"
        stroke="#22d3ee" strokeOpacity="0.15" strokeDasharray="6 10" strokeWidth="1" />

      {/* Landmasses */}
      <g fill="url(#landGrad)" stroke="#1e4d6b" strokeOpacity="0.6" strokeWidth="1" filter="url(#landGlow)">
        <path d={northAmerica} />
        <path d={southAmerica} />
        <path d={eurasia} />
        <path d={africa} />
        <path d={australia} />
        <path d={greenland} />
      </g>

      {/* Continent labels */}
      {labels.map(([lon, lat, label]) => {
        const x = ((lon + 180) / 360) * 1000;
        const y = ((90 - lat)  / 180) * 500;
        return (
          <text key={label} x={x} y={y} textAnchor="middle"
            fill="#22d3ee" fillOpacity="0.18" fontSize="13"
            fontFamily="monospace" letterSpacing="2" fontWeight="bold"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function SignalMap({ signals }: { signals: Signal[] }) {
  const clusters  = useMemo(() => buildClusters(signals), [signals]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected  = clusters.find(c => c.id === selectedId) || clusters[0];

  if (clusters.length === 0) return null;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Map canvas ── */}
      <div
        className="relative overflow-hidden rounded-md"
        style={{
          background: 'linear-gradient(135deg,rgba(5,15,30,0.97),rgba(8,22,42,0.95))',
          border: '1px solid #1a3352',
          boxShadow: '0 0 50px rgba(34,211,238,0.07)',
        }}
      >
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-slate-800/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">
              Geospatial Signal Field · Equirectangular
            </p>
            <h2 className="font-mono text-base font-bold uppercase text-cyan-300">
              Global Disease Map
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-mono uppercase text-slate-500">
            {(['watch','rising','surging'] as const).map(s => (
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

        {/* Map area */}
        <div className="relative" style={{ minHeight: 380, height: '100%' }}>
          {/* Ocean radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(34,211,238,0.06),transparent)]" />

          <WorldMapShape />

          {/* Heatmap glow layer — large radial glows behind bubbles, overlapping creates density heat */}
          {clusters.map(cluster => (
            <div
              key={`heat-${cluster.id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                left:   `${cluster.x}%`,
                top:    `${cluster.y}%`,
                width:  cluster.size * 5,
                height: cluster.size * 5,
                background: `radial-gradient(circle, ${cluster.glow} 0%, transparent 70%)`,
                opacity: cluster.progress === 'surging' ? 0.55 : cluster.progress === 'rising' ? 0.38 : 0.22,
                zIndex: 1,
              }}
            />
          ))}

          {clusters.map(cluster => (
            <button
              key={cluster.id}
              type="button"
              aria-label={`${cluster.disease} in ${cluster.location}`}
              onClick={() => setSelectedId(cluster.id)}
              onMouseEnter={() => setSelectedId(cluster.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-150 hover:z-20 hover:scale-110 focus:outline-none"
              style={{
                left: `${cluster.x}%`,
                top:  `${cluster.y}%`,
                width:  cluster.size,
                height: cluster.size,
                background:  `${cluster.color}25`,
                borderColor: cluster.color,
                borderWidth: selectedId === cluster.id ? 2 : 1,
                boxShadow: `0 0 ${Math.round(cluster.size * 0.9)}px ${cluster.glow}, inset 0 0 16px ${cluster.glow}`,
                zIndex: selectedId === cluster.id ? 30 : Math.min(20, Math.max(1, Math.round(cluster.pressure / 10))),
              }}
            >
              {/* Pulse ring */}
              <span
                className="absolute rounded-full"
                style={{
                  inset: '-40%',
                  border: `1px solid ${cluster.color}`,
                  opacity: cluster.progress === 'watch' ? 0.14 : 0.38,
                  animation: `map-pulse ${cluster.progress === 'surging' ? 1.4 : 2.6}s ease-out infinite`,
                }}
              />
              {/* Report count */}
              <span className="relative flex h-full w-full items-center justify-center font-mono text-[10px] font-bold text-white">
                {cluster.reportCount}
              </span>
            </button>
          ))}
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
            {/* Header */}
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

            {/* Stats grid */}
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

            {/* Pressure bar */}
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

            {/* Latest signals */}
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
