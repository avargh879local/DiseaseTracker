'use client';

import { useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Signal } from '@/app/types';

const SOURCE_STYLES: Record<string, string> = {
  CDC: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  WHO: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  ProMED: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  ReliefWeb: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

const SEVERITY_CONFIG = {
  high: {
    borderColor: '#ef4444',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-500',
    label: 'HIGH',
    glow: 'rgba(239, 68, 68, 0.1)',
  },
  medium: {
    borderColor: '#f59e0b',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500',
    label: 'MED',
    glow: 'rgba(245, 158, 11, 0.08)',
  },
  low: {
    borderColor: '#22c55e',
    badge: 'bg-green-500/15 text-green-400 border-green-500/30',
    dot: 'bg-green-500',
    label: 'LOW',
    glow: 'rgba(34, 197, 94, 0.06)',
  },
};

export default function AlertCard({ signal }: { signal: Signal }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[signal.severity];
  const srcStyle = SOURCE_STYLES[signal.source] || SOURCE_STYLES.CDC;

  let timeAgo = 'Unknown';
  try {
    timeAgo = formatDistanceToNow(parseISO(signal.publishedAt), { addSuffix: true });
  } catch {}

  const desc = signal.description;
  const LIMIT = 220;
  const hasMore = desc.length > LIMIT;
  const displayText = expanded ? desc : desc.slice(0, LIMIT);

  return (
    <article
      className="relative rounded-md overflow-hidden transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1f38 100%)',
        border: '1px solid #1a3352',
        borderLeft: `3px solid ${sev.borderColor}`,
        boxShadow: `0 0 20px ${sev.glow}, 0 4px 12px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Top shimmer line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${sev.borderColor}40, transparent)`,
        }}
      />

      <div className="p-4 flex flex-col h-full">
        {/* Title */}
        <a
          href={signal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[13px] font-bold text-slate-100 hover:text-cyan-400 transition-colors leading-snug block mb-2 line-clamp-3"
          title={signal.title}
        >
          {signal.title}
        </a>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mb-3 flex-wrap">
          <span className="text-slate-400 font-semibold">{signal.region}</span>
          <span className="text-slate-700">·</span>
          <span>{timeAgo}</span>
        </div>

        {/* Description */}
        <div className="text-[12px] text-slate-400 leading-relaxed mb-4 flex-1">
          {displayText}
          {!expanded && hasMore && (
            <>
              {'... '}
              <button
                onClick={() => setExpanded(true)}
                className="text-cyan-500 hover:text-cyan-300 font-mono transition-colors"
              >
                [expand]
              </button>
            </>
          )}
          {expanded && hasMore && (
            <>
              {' '}
              <button
                onClick={() => setExpanded(false)}
                className="text-cyan-500 hover:text-cyan-300 font-mono transition-colors"
              >
                [collapse]
              </button>
            </>
          )}
        </div>

        {/* Footer badges */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${srcStyle}`}
          >
            {signal.source}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${sev.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
            {sev.label}
          </span>
        </div>
      </div>
    </article>
  );
}
