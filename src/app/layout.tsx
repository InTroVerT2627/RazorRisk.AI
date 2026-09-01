import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RazorRisk.AI — Autonomous FinOps & Risk Operations',
  description: 'AI Finance Controller, AI Risk Manager, and AI Revenue Recovery closed-loop operations platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--rr-bg)] text-[var(--rr-text)] min-h-screen flex overflow-hidden antialiased" style={{ fontFamily: 'var(--font-inter), Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="page-enter">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
