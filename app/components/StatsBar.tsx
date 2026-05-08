interface StatItem {
  label: string;
  value: string | number;
  accent?: string;
}

export default function StatsBar({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md p-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #0d1f38 100%)',
            border: '1px solid #1a3352',
          }}
        >
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-600 mb-1.5">
            {item.label}
          </div>
          <div
            className="text-3xl font-mono font-bold leading-none"
            style={{ color: item.accent || '#22d3ee' }}
          >
            {item.value}
          </div>
          {/* Corner decoration */}
          <div
            className="absolute top-0 right-0 w-12 h-12 opacity-[0.04]"
            style={{
              background: `radial-gradient(circle at top right, ${item.accent || '#22d3ee'}, transparent)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
