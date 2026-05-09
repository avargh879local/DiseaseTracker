import { ImageResponse } from 'next/og';

export const alt = 'SENTINEL — Global Disease Intelligence Dashboard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          background: 'linear-gradient(135deg, #020b16 0%, #030d1a 50%, #04111f 100%)',
          padding: '64px 72px',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            display: 'flex',
          }}
        />

        {/* Top-right corner decoration */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 72,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#4ade80',
              boxShadow: '0 0 12px rgba(74,222,128,0.8)',
            }}
          />
          <span
            style={{
              fontSize: 13,
              color: '#4ade80',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            SENTINEL ONLINE
          </span>
        </div>

        {/* Source pills */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 40,
          }}
        >
          {['CDC', 'WHO', 'PAHO', 'ProMED', 'ReliefWeb'].map((src) => (
            <div
              key={src}
              style={{
                padding: '4px 12px',
                border: '1px solid rgba(34,211,238,0.25)',
                borderRadius: 4,
                fontSize: 12,
                color: '#64748b',
                letterSpacing: '0.1em',
                background: 'rgba(34,211,238,0.05)',
              }}
            >
              {src}
            </div>
          ))}
        </div>

        {/* Main title */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: '#22d3ee',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            textShadow: '0 0 60px rgba(34,211,238,0.5)',
            marginBottom: 20,
            display: 'flex',
          }}
        >
          SENTINEL
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            color: '#475569',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 48,
            display: 'flex',
          }}
        >
          Global Disease Intelligence Network
        </div>

        {/* Bottom description */}
        <div
          style={{
            fontSize: 18,
            color: '#334155',
            lineHeight: 1.5,
            maxWidth: 700,
            display: 'flex',
          }}
        >
          Live outbreak alerts mapped and ranked by severity. Updated every 5 minutes.
        </div>

        {/* Bottom-right URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            right: 72,
            fontSize: 14,
            color: '#1e3a52',
            letterSpacing: '0.05em',
            display: 'flex',
          }}
        >
          sentinel-watch.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
