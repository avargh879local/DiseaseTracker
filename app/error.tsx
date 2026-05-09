'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SENTINEL] Page error:', error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: '#030d1a', color: '#e2e8f0', fontFamily: 'monospace' }}
    >
      <div className="text-center space-y-3">
        <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#ef4444' }}>
          SENTINEL — System Fault
        </p>
        <h1 className="text-4xl font-bold" style={{ color: '#22d3ee' }}>
          FEED OFFLINE
        </h1>
        <p className="text-sm" style={{ color: '#475569' }}>
          An error occurred loading the intelligence feed.
        </p>
        {error.digest && (
          <p className="text-[10px]" style={{ color: '#1e3a52' }}>
            ref: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-5 py-2 rounded text-sm uppercase tracking-widest transition-all"
        style={{
          border: '1px solid rgba(34,211,238,0.3)',
          color: '#22d3ee',
          background: 'rgba(34,211,238,0.08)',
        }}
      >
        Retry
      </button>
    </div>
  );
}
