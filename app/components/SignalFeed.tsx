'use client';

import { useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Signal, Severity } from '@/app/types';

const SEV_DOT: Record<Severity, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-green-500',
};

const SEV_TEXT: Record<Severity, string> = {
  high:   'text-red-400',
  medium: 'text-amber-400',
  low:    'text-green-400',
};

const SEV_BORDER: Record<Severity, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#22c55e',
};

const SOURCE_COLOR: Record<string, string> = {
  CDC:       'text-blue-300   bg-blue-500/10   border-blue-500/25',
  WHO:       'text-purple-300 bg-purple-500/10 border-purple-500/25',
  ProMED:    'text-orange-300 bg-orange-500/10 border-orange-500/25',
  ReliefWeb: 'text-teal-300   bg-teal-500/10   border-teal-500/25',
  PAHO:      'text-sky-300    bg-sky-500/10    border-sky-500/25',
};

function safeTime(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
  catch { return '—'; }
}

function Row({ signal, isNew, onSignalClick }: {
  signal: Signal;
  isNew?: boolean;
  onSignalClick?: (s: Signal) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (onSignalClick) { onSignalClick(signal); }
    else { setOpen(o => !o); }
  };

  return (
    <div
      className="transition-colors duration-100"
      style={{
        borderLeft: `2px solid ${SEV_BORDER[signal.severity]}`,
        background: open ? 'rgba(34,211,238,0.03)' : undefined,
      }}
    >
      {/* Main row */}
      <button
        onClick={handleClick}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        {/* Severity dot */}
        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${SEV_DOT[signal.severity]}`} />

        {/* NEW badge */}
        {isNew && (
          <span className="flex-shrink-0 px-1 py-px rounded text-[8px] font-mono font-bold uppercase"
            style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)' }}>
            NEW
          </span>
        )}

        {/* Disease name */}
        <span
          className="flex-shrink-0 w-32 font-mono text-[11px] font-bold text-slate-200 truncate"
          title={signal.disease}
        >
          {signal.disease}
        </span>

        {/* Title preview */}
        <span className="flex-1 min-w-0 text-[12px] text-slate-400 truncate hidden sm:block">
          {signal.title}
        </span>

        {/* Location */}
        <span className="flex-shrink-0 w-24 text-[11px] font-mono text-slate-500 truncate hidden md:block text-right">
          {signal.location}
        </span>

        {/* Region */}
        <span className="flex-shrink-0 w-20 text-[10px] font-mono text-slate-600 hidden lg:block">
          {signal.region}
        </span>

        {/* Time */}
        <span className="flex-shrink-0 w-20 text-[10px] font-mono text-slate-600 text-right hidden sm:block">
          {safeTime(signal.publishedAt)}
        </span>

        {/* Source badge */}
        <span
          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
            SOURCE_COLOR[signal.source] || 'text-slate-400 bg-slate-800 border-slate-700'
          }`}
        >
          {signal.source}
        </span>

        {/* Severity badge */}
        <span className={`flex-shrink-0 text-[9px] font-mono font-bold uppercase w-8 text-right ${SEV_TEXT[signal.severity]}`}>
          {signal.severity === 'high' ? 'HIGH' : signal.severity === 'medium' ? 'MED' : 'LOW'}
        </span>

        {/* Chevron */}
        <span className="flex-shrink-0 text-slate-700 text-[10px] font-mono ml-1">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded row */}
      {open && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-[11px] font-mono text-slate-300 mb-1.5 line-clamp-1">
            {signal.title}
          </p>
          <p className="text-[12px] text-slate-400 leading-relaxed mb-2">
            {signal.description.length > 400
              ? signal.description.slice(0, 400) + '…'
              : signal.description}
          </p>
          <div className="flex items-center gap-3">
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-cyan-500 hover:text-cyan-300 transition-colors"
            >
              Read source ↗
            </a>
            <span className="text-slate-700 text-[10px]">·</span>
            <span className="text-[10px] font-mono text-slate-600">
              {signal.region} · {safeTime(signal.publishedAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface SignalFeedProps {
  signals: Signal[];
  title?: string;
  newSignalIds?: Set<string>;
  onSignalClick?: (signal: Signal) => void;
}

export default function SignalFeed({ signals, title = 'Signal Feed', newSignalIds, onSignalClick }: SignalFeedProps) {
  const [sort, setSort] = useState<'time' | 'severity'>('time');

  const sorted = [...signals].sort((a, b) => {
    if (sort === 'severity') {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ background: 'linear-gradient(135deg,#080f1e,#0a1628)', border: '1px solid #1a3352' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/70">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Live Intelligence</p>
          <h2 className="font-mono text-base font-bold uppercase text-cyan-300">{title}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono uppercase text-slate-600 mr-1">Sort:</span>
          {(['time', 'severity'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-2 py-0.5 rounded text-[9px] font-mono uppercase border transition-all"
              style={{
                background: sort === s ? 'rgba(34,211,238,0.12)' : 'transparent',
                borderColor: sort === s ? 'rgba(34,211,238,0.35)' : '#1a3352',
                color: sort === s ? '#22d3ee' : '#475569',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-950/40 border-b border-slate-800/40">
        <span className="w-2 flex-shrink-0" />
        <span className="w-32 flex-shrink-0 text-[9px] font-mono uppercase text-slate-600">Disease</span>
        <span className="flex-1 text-[9px] font-mono uppercase text-slate-600 hidden sm:block">Alert Title</span>
        <span className="w-24 flex-shrink-0 text-[9px] font-mono uppercase text-slate-600 hidden md:block text-right">Location</span>
        <span className="w-20 flex-shrink-0 text-[9px] font-mono uppercase text-slate-600 hidden lg:block">Region</span>
        <span className="w-20 flex-shrink-0 text-[9px] font-mono uppercase text-slate-600 text-right hidden sm:block">When</span>
        <span className="flex-shrink-0 text-[9px] font-mono uppercase text-slate-600 w-16">Source</span>
        <span className="flex-shrink-0 text-[9px] font-mono uppercase text-slate-600 w-8 text-right">Lvl</span>
        <span className="w-4 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800/40">
        {sorted.map(signal => (
          <Row
            key={signal.id}
            signal={signal}
            isNew={newSignalIds?.has(signal.id)}
            onSignalClick={onSignalClick}
          />
        ))}
      </div>

      {signals.length === 0 && (
        <div className="py-12 text-center font-mono text-sm text-slate-700">
          No signals match current filters
        </div>
      )}
    </div>
  );
}
