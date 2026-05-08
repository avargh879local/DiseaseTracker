import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  serverExternalPackages: ['rss-parser'],
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
