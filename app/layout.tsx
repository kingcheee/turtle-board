import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '거북이 보드' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/MonadABXY/mona-font/web/mona.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
