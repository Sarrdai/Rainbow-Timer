import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { THEME_COLORS, themeInitScript } from '@/lib/theme';
import { assetPath } from '@/lib/utils';

// Self-hosted at build time: no runtime request to Google, works offline in the native app
const inter = Inter({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Rainbow Timer',
  description: 'A visual timer app with a rainbow dial.',
  manifest: assetPath('/manifest.json'),
  robots: { index: false, follow: false },
  icons: {
    icon: [
        { url: assetPath('/favicon.ico'), sizes: 'any' },
        { url: assetPath('/icon-192.png'), type: 'image/png', sizes: '192x192' },
        { url: assetPath('/icon-512.png'), type: 'image/png', sizes: '512x512' }
    ],
    apple: assetPath('/apple-touch-icon.png'),
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set by the init script before hydration
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  );
}
