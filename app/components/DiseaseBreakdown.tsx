'use client';

import { useMemo } from 'react';
import { Signal, Severity } from '@/app/types';

const SEV_COLOR: Record<Severity, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#22c55e',
};

interface Props {
  signals: Signal[];
}

export default function DiseaseBreakdown({ signals }: Props) {
  const diseases = useMemo(() => {
    const map = new Map<string, { high: number; medium: number; low: number; total: number }>();

    for (const s of signals) {
      const entry = map.get(s.disease) ?? { high: 0, medium: 0, low: 0, total: 0 };
      entry[s.severity]++;
      entry.total++;
      map.set(s.disease, entry);
    }

    return Array.from(map.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [signals]);

  const max = diseases[0]?.total || 1;

  if (diseases.length === 0) return null;

  return (
    <div
      className="rounded-md"
      style={{ background: 'linear-gradient(135deg,#080f1e,#0a1628)', border: '1px solid #1a3352' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/70">
        <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">By Pathogen</p>
        <h2 className="font-mono text-base font-bold uppercase text-cyan-300">Disease Breakdown</h2>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800/40 px-4 py-2">
        {diseases.map(d => (
          <div key={d.name} className="py-2.5 flex items-center gap-3">
            {/* Name */}
            <span
              className="flex-shrink-0 w-36 text-[11px] font-mono text-slate-300 truncate"
              title={d.name}
            >
              {d.name}
            </span>

            {/* Stacked bar */}
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-slate-900/80 flex">
              {(['high', 'medium', 'low'] as Severity[]).map(sev => {
                const w = (d[sev] / max) * 100;
                return w > 0 ? (
                  <div
                    key={sev}
                    title={`${sev}: ${d[sev]}`}
                    style={{
                      width: `${w}%`,
                      background: SEV_COLOR[sev],
                      opacity: 0.8,
                    }}
                  />
                ) : null;
              })}
            </div>

            {/* Count */}
            <span className="flex-shrink-0 w-6 text-right text-[11px] font-mono font-bold text-slate-400">
              {d.total}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 pb-3 pt-1">
        {(['high', 'medium', 'low'] as Severity[]).map(sev => (
          <span key={sev} className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-slate-600">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SEV_COLOR[sev] }} />
            {sev}
          </span>
        ))}
      </div>
    </div>
  );
}
