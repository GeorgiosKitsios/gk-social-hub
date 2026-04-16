DATEI: app/layout.tsx
// ============================================================
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Topbar from '@/components/layout/Topbar';
import Sidebar from '@/components/layout/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GK Social Hub',
  description: 'Multi-Brand Social Media Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-white antialiased`}>
        <Topbar />
        <div className="flex h-[calc(100vh-3.5rem)]">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-neutral-900">{children}</main>
        </div>
      </body>
    </html>
  );
}
