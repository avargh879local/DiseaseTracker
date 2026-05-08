interface ThreatGaugeProps {
  level: string;
  score: number;
  color: string;
}

const LEVEL_DESCS: Record<string, string> = {
  LOW: 'Routine monitoring. No unusual disease activity detected.',
  MODERATE: 'Elevated vigilance required. Active disease events tracked.',
  ELEVATED: 'Significant threat activity. Multiple outbreak signals active.',
  CRITICAL: 'High-priority threat. Major outbreaks requiring immediate attention.',
};

const LEVEL_TEXT_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MODERATE: '#f59e0b',
  ELEVATED: '#f97316',
  CRITICAL: '#ef4444',
};

export default function ThreatGauge({ level, score, color }: ThreatGaugeProps) {
  const textColor = LEVEL_TEXT_COLORS[level] || '#94a3b8';
  const description = LEVEL_DESCS[level] || '';

  const segments = [
    { label: 'LOW', pct: 25, color: '#22c55e' },
    { label: 'MOD', pct: 25, color: '#f59e0b' },
    { label: 'ELEV', pct: 25, color: '#f97316' },
    { label: 'CRIT', pct: 25, color: '#ef4444' },
  ];

  return (
    <div
      className="rounded-md p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1f38 100%)',
        border: `1px solid ${color}30`,
        boxShadow: `0 0 30px ${color}12`,
      }}
    >
      {/* Corner glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 opacity-[0.06] pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${color}, transparent 70%)`,
        }}
      />

      <div className="flex items-start justify-between gap-4 relative">
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-600 mb-1">
            Global Threat Index
          </div>
          <div
            className="text-2xl font-mono font-bold mb-1 tracking-wide"
            style={{ color: textColor, textShadow: `0 0 20px ${textColor}60` }}
          >
            {level}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm">{description}</p>
        </div>

        <div className="text-right flex-shrink-0">
          <div
            className="text-4xl font-mono font-bold leading-none"
            style={{ color, textShadow: `0 0 20px ${color}60` }}
          >
            {score}
          </div>
          <div className="text-[10px] font-mono text-slate-700 mt-0.5">/100</div>
        </div>
      </div>

      {/* Progress bar with segments */}
      <div className="mt-4 space-y-1">
        <div className="flex h-2 rounded-full overflow-hidden gap-px bg-slate-900">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className="flex-1 relative"
              style={{ background: '#0d1f38' }}
            >
              <div
                className="absolute inset-0 rounded-sm transition-opacity duration-700"
                style={{
                  background: seg.color,
                  opacity: score >= segments.indexOf(seg) * 25 + 1 ? 0.8 : 0.08,
                  boxShadow: score >= segments.indexOf(seg) * 25 + 1
                    ? `0 0 6px ${seg.color}80`
                    : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Cursor indicator */}
        <div
          className="relative h-0"
          style={{ marginLeft: `calc(${Math.min(score, 99)}% - 4px)` }}
        >
          <div
            className="w-2 h-2 rounded-full absolute -top-3 -translate-x-1/2"
            style={{
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        </div>

        <div className="flex justify-between pt-1">
          {segments.map((seg) => (
            <span key={seg.label} className="text-[9px] font-mono" style={{ color: '#334155' }}>
              {seg.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
