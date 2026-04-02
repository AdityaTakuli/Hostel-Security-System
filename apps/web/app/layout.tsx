import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AlertProvider from '@/components/providers/AlertProvider';

import AuthProvider from '@/components/providers/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hostel Monitoring System',
  description: 'Production-grade SFU monitoring system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="absolute inset-0 bg-background overflow-y-auto">
          <div className="scanline-overlay pointer-events-none" />
          <AuthProvider>
            <AlertProvider>
              {children}
            </AlertProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
