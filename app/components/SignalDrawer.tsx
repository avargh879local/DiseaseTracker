'use client';

import { useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Signal, Severity } from '@/app/types';

const SEV: Record<Severity, { color: string; bg: string; label: string }> = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  label: 'CRITICAL' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.09)', label: 'ELEVATED' },
  low:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  label: 'WATCH'    },
};

const SOURCE_COLOR: Record<string, string> = {
  CDC:       '#93c5fd',
  WHO:       '#c4b5fd',
  ProMED:    '#fdba74',
  ReliefWeb: '#5eead4',
  PAHO:      '#7dd3fc',
};

function safeTime(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
  catch { return '—'; }
}

interface Props {
  signal: Signal | null;
  onClose: () => void;
}

export default function SignalDrawer({ signal, onClose }: Props) {
  useEffect(() => {
    if (!signal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [signal, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: signal ? 1 : 0,
          pointerEvents: signal ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col overflow-y-auto"
        style={{
          background: 'linear-gradient(160deg,#080f1e,#0a1a30)',
          borderLeft: '1px solid #1a3352',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
          transform: signal ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
        aria-label="Signal details"
      >
        {signal && (
          <>
            {/* Top bar */}
            <div
              className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: `2px solid ${SEV[signal.severity].color}40` }}
            >
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Signal Detail</p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{signal.source} · {safeTime(signal.publishedAt)}</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-600 hover:text-cyan-400 transition-colors font-mono text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 px-5 py-5 space-y-5">
              {/* Severity badge */}
              <span
                className="inline-block px-3 py-1 rounded text-[10px] font-mono font-bold uppercase"
                style={{
                  color: SEV[signal.severity].color,
                  background: SEV[signal.severity].bg,
                  border: `1px solid ${SEV[signal.severity].color}40`,
                }}
              >
                {SEV[signal.severity].label}
              </span>

              {/* Disease + title */}
              <div>
                <p
                  className="font-mono text-2xl font-bold leading-tight mb-2"
                  style={{ color: SEV[signal.severity].color }}
                >
                  {signal.disease}
                </p>
                <p className="text-sm text-slate-300 leading-snug">{signal.title}</p>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Location', signal.location],
                  ['Region',   signal.region],
                  ['Source',   signal.source],
                  ['Published', safeTime(signal.publishedAt)],
                  ...(signal.caseCount  ? [['Cases',  String(signal.caseCount.toLocaleString())]]  : []),
                  ...(signal.deathCount ? [['Deaths', String(signal.deathCount.toLocaleString())]] : []),
                ] as [string, string][]).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded p-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a3352' }}
                  >
                    <p className="text-[9px] font-mono uppercase text-slate-600 mb-1">{label}</p>
                    <p
                      className="font-mono text-sm font-bold"
                      style={{ color: label === 'Source' ? SOURCE_COLOR[value] || '#e2e8f0' : '#e2e8f0' }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div
                className="rounded p-4"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a3352' }}
              >
                <p className="text-[9px] font-mono uppercase text-slate-600 mb-2">Full Description</p>
                <p className="text-sm text-slate-400 leading-relaxed">{signal.description}</p>
              </div>

              {/* Link */}
              <a
                href={signal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded font-mono text-sm font-bold uppercase tracking-wider transition-all duration-150 hover:scale-[1.02]"
                style={{
                  background: 'rgba(34,211,238,0.08)',
                  border: '1px solid rgba(34,211,238,0.30)',
                  color: '#22d3ee',
                }}
              >
                Read Source Report ↗
              </a>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
