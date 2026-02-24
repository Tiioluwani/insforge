import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InsForge Analytics Dashboard',
  description:
    'AI-first analytics dashboard built with InsForge — realtime Postgres, AI Model Gateway, and live WebSocket updates.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
