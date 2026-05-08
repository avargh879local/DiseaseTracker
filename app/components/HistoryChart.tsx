'use client';

import { useEffect, useState } from 'react';
import { Signal } from '@/app/types';

const STORAGE_KEY = 'sentinel_history_v1';
const MAX_SNAPSHOTS = 48; // ~4 hours at 5-min interval

interface Snapshot {
  ts: number;
  high: number;
  med: number;
  low: number;
}

function loadSnapshots(): Snapshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveSnapshots(snaps: Snapshot[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snaps.slice(-MAX_SNAPSHOTS))); } catch {}
}

interface Props {
  signals: Signal[];
}

const W = 600;
const H = 120;
const PAD = { top: 12, right: 16, bottom: 24, left: 32 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

function polyline(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

export default function HistoryChart({ signals }: Props) {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);

  useEffect(() => {
    if (signals.length === 0) return;
    const current: Snapshot = {
      ts:   Date.now(),
      high: signals.filter(s => s.severity === 'high').length,
      med:  signals.filter(s => s.severity === 'medium').length,
      low:  signals.filter(s => s.severity === 'low').length,
    };
    const prev = loadSnapshots();
    // Don't add duplicate within 2 min
    const last = prev[prev.length - 1];
    const updated = last && Date.now() - last.ts < 2 * 60 * 1000
      ? [...prev.slice(0, -1), current]
      : [...prev, current];
    saveSnapshots(updated);
    setSnaps(updated);
  }, [signals]);

  if (snaps.length < 2) {
    return (
      <div
        className="rounded-md px-4 py-6 text-center"
        style={{ background: 'linear-gradient(135deg,#080f1e,#0a1628)', border: '1px solid #1a3352' }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mb-1">Signal History</p>
        <p className="text-[11px] font-mono text-slate-700">Collecting data — chart appears after 2+ refreshes</p>
      </div>
    );
  }

  const t0 = snaps[0].ts;
  const t1 = snaps[snaps.length - 1].ts;
  const tRange = t1 - t0 || 1;

  const maxVal = Math.max(
    ...snaps.map(s => Math.max(s.high, s.med, s.low)),
    1
  );

  const toX = (ts: number) => PAD.left + ((ts - t0) / tRange) * CW;
  const toY = (v: number)  => PAD.top  + CH - (v / maxVal) * CH;

  const lineData: { key: string; color: string; values: (s: Snapshot) => number }[] = [
    { key: 'high', color: '#ef4444', values: s => s.high },
    { key: 'med',  color: '#f59e0b', values: s => s.med  },
    { key: 'low',  color: '#22c55e', values: s => s.low  },
  ];

  // Y-axis ticks
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // X-axis: show first + last timestamps
  function fmtTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div
      className="rounded-md"
      style={{ background: 'linear-gradient(135deg,#080f1e,#0a1628)', border: '1px solid #1a3352' }}
    >
      <div className="px-4 py-3 border-b border-slate-800/70">
        <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Session Timeline</p>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-base font-bold uppercase text-cyan-300">Signal History</h2>
          <div className="flex items-center gap-4">
            {lineData.map(({ key, color }) => (
              <span key={key} className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-slate-600">
                <span className="w-5 h-[2px] rounded" style={{ background: color }} />
                {key}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          style={{ height: H }}
          aria-hidden="true"
        >
          {/* Grid lines */}
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={PAD.left} x2={W - PAD.right}
                y1={toY(v)}    y2={toY(v)}
                stroke="#1a3352" strokeWidth="1"
              />
              <text
                x={PAD.left - 5} y={toY(v) + 4}
                textAnchor="end"
                fill="#334155" fontSize="9" fontFamily="monospace"
              >{v}</text>
            </g>
          ))}

          {/* X axis ticks */}
          {[snaps[0], snaps[snaps.length - 1]].map((s, i) => (
            <text
              key={i}
              x={toX(s.ts)}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : 'end'}
              fill="#334155" fontSize="9" fontFamily="monospace"
            >{fmtTime(s.ts)}</text>
          ))}

          {/* Lines */}
          {lineData.map(({ key, color, values }) => {
            const points: [number, number][] = snaps.map(s => [toX(s.ts), toY(values(s))]);
            return (
              <g key={key}>
                {/* Area fill */}
                <polyline
                  points={[
                    ...points,
                    [toX(snaps[snaps.length - 1].ts), toY(0)],
                    [toX(snaps[0].ts), toY(0)],
                  ].map(([x, y]) => `${x},${y}`).join(' ')}
                  fill={color} fillOpacity="0.06"
                  stroke="none"
                />
                {/* Line */}
                <polyline
                  points={polyline(points)}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Dots for small datasets */}
                {snaps.length <= 12 && points.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="2" fill={color} fillOpacity="0.8" />
                ))}
              </g>
            );
          })}
        </svg>
        <p className="text-[9px] font-mono text-slate-800 mt-1">
          {snaps.length} snapshot{snaps.length !== 1 ? 's' : ''} · updates every 5 min
        </p>
      </div>
    </div>
  );
}
