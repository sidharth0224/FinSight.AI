import type { Metadata } from 'next';
import './globals.css';
import './editorial.css';
import { Providers } from '@/components/providers';
export const metadata: Metadata = {
  title: 'FinSight AI — Finance, in focus.',
  description:
    'Ask your finance data. Get answers you can trust. Your intelligent finance and accounting copilot.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
