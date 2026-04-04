import type { Metadata } from 'next';
import { Inter, Syne, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AlertProvider from '@/components/providers/AlertProvider';

import AuthProvider from '@/components/providers/AuthProvider';
import Navbar from '@/components/Navbar';
import AlarmControl from '@/components/AlarmControl';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'HMS.SYS / Interface',
  description: 'Production-grade SFU monitoring system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${syne.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased text-text-primary bg-background">
        <div className="absolute inset-0 bg-background overflow-y-auto flex flex-col">
          <AuthProvider>
            <AlertProvider>
              <Navbar />
              <AlarmControl />
              <div className="flex-1 w-full">
                {children}
              </div>
            </AlertProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
