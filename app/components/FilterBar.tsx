'use client';

import { Source, Severity } from '@/app/types';

export interface Filters {
  source: Source | 'all';
  severity: Severity | 'all';
  search: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sourceStatus: Record<Source, 'ok' | 'error'>;
}

const SOURCES: (Source | 'all')[] = ['all', 'CDC', 'WHO', 'ProMED', 'ReliefWeb'];

const SEVERITIES: { value: Severity | 'all'; label: string; activeColor: string }[] = [
  { value: 'all', label: 'All', activeColor: '#22d3ee' },
  { value: 'high', label: 'High', activeColor: '#ef4444' },
  { value: 'medium', label: 'Med', activeColor: '#f59e0b' },
  { value: 'low', label: 'Low', activeColor: '#22c55e' },
];

export default function FilterBar({ filters, onChange, sourceStatus }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
      {/* Source filters */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mr-1">
          Source
        </span>
        {SOURCES.map((src) => {
          const active = filters.source === src;
          const hasError = src !== 'all' && sourceStatus[src as Source] === 'error';
          return (
            <button
              key={src}
              onClick={() => onChange({ ...filters, source: src })}
              className="px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider border transition-all duration-150"
              style={{
                background: active ? 'rgba(34, 211, 238, 0.12)' : 'transparent',
                borderColor: active ? 'rgba(34, 211, 238, 0.4)' : '#1a3352',
                color: active ? '#22d3ee' : hasError ? '#6b7280' : '#94a3b8',
              }}
            >
              {src}
              {hasError && <span className="ml-1 text-red-400">!</span>}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-5 bg-slate-800" />

      {/* Severity filters */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600 mr-1">
          Level
        </span>
        {SEVERITIES.map((sev) => {
          const active = filters.severity === sev.value;
          return (
            <button
              key={sev.value}
              onClick={() => onChange({ ...filters, severity: sev.value })}
              className="px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider border transition-all duration-150"
              style={{
                background: active ? `${sev.activeColor}18` : 'transparent',
                borderColor: active ? `${sev.activeColor}50` : '#1a3352',
                color: active ? sev.activeColor : '#94a3b8',
              }}
            >
              {sev.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-5 bg-slate-800" />

      {/* Search */}
      <div className="relative flex-1 min-w-0 sm:max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-[11px] font-mono select-none">
          &gt;_
        </span>
        <input
          type="text"
          placeholder="Search signals..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full rounded pl-8 pr-3 py-1.5 text-[12px] font-mono text-slate-300 placeholder-slate-700 outline-none transition-all duration-150"
          style={{
            background: '#0a1628',
            border: '1px solid #1a3352',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)';
            e.currentTarget.style.boxShadow = '0 0 0 1px rgba(34, 211, 238, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#1a3352';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>
    </div>
  );
}
