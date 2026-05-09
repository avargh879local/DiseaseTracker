import type { Metadata } from 'next';
import { Space_Mono, DM_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  variable: '--font-space-mono',
  subsets: ['latin'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

const BASE_URL = 'https://sentinel-watch.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'SENTINEL — Global Disease Intelligence Dashboard',
    template: '%s | SENTINEL',
  },
  description:
    'Real-time global disease outbreak tracking. Live alerts from CDC, PAHO, ECDC and more — mapped, filtered, and ranked by severity.',
  keywords: [
    'disease outbreak tracker',
    'epidemic surveillance',
    'global health alerts',
    'CDC disease alerts',
    'WHO outbreak news',
    'infectious disease map',
    'pandemic tracker 2026',
    'real-time disease monitoring',
    'public health intelligence',
    'PAHO alerts',
  ],
  authors: [{ name: 'SENTINEL', url: BASE_URL }],
  creator: 'SENTINEL',
  openGraph: {
    type: 'website',
    url: BASE_URL,
    siteName: 'SENTINEL',
    title: 'SENTINEL — Global Disease Intelligence Dashboard',
    description:
      'Live disease outbreak alerts from CDC, PAHO, WHO and more. Interactive global map, severity rankings, and signal feed updated every 5 minutes.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SENTINEL — Global Disease Intelligence',
    description: 'Live disease outbreak alerts mapped and ranked in real time.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${dmSans.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
