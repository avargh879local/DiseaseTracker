import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const SECURITY_HEADERS = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // jsdelivr: world atlas TopoJSON; sentry: client-side error reporting
      "connect-src 'self' https://cdn.jsdelivr.net https://*.sentry.io",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['rss-parser'],
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
  // Only upload source maps when DSN is configured
  sourcemaps: { disable: !process.env.NEXT_PUBLIC_SENTRY_DSN },
  autoInstrumentServerFunctions: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
