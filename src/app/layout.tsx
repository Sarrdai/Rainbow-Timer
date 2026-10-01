import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Self-hosted at build time: no runtime request to Google, works offline in the native app
const inter = Inter({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Rainbow Timer',
  description: 'A visual timer app with a rainbow dial.',
  manifest: '/manifest.json',
  robots: { index: false, follow: false },
  icons: {
    icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icon-512.png', type: 'image/png', sizes: '512x512' }
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8def8' },
    { media: '(prefers-color-scheme: dark)', color: '#15122a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  );
}
