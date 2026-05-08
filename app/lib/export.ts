import { Signal } from '@/app/types';

export function exportToCsv(signals: Signal[], filename = 'sentinel-signals.csv') {
  const headers = ['ID', 'Disease', 'Title', 'Location', 'Region', 'Severity', 'Source', 'Published', 'URL'];
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  const rows = signals.map(s => [
    s.id,
    escape(s.disease),
    escape(s.title),
    escape(s.location),
    s.region,
    s.severity,
    s.source,
    s.publishedAt,
    s.url,
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
