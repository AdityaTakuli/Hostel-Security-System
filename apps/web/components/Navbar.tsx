'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useAlertStore } from '@/stores/alertStore';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const unreadCount = useAlertStore(state => state.unreadCount);
  const markAllRead = useAlertStore(state => state.markAllRead);

  return (
    <nav className="w-full h-[60px] border-b border-white/20 bg-black flex justify-between items-center px-6 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-xl tracking-tighter italic text-accent-violet">$h<span className="text-white">ms</span></span>
        </Link>
        
        {/* Main Navigation Links */}
        <div className="hidden sm:flex h-[60px] items-center text-[11px] uppercase tracking-widest font-mono font-bold">
          <Link 
            href="/dashboard" 
            className={`h-full px-6 flex items-center border-l border-white/20 transition-colors ${pathname === '/dashboard' ? 'bg-accent-violet text-black border-accent-violet' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
          >
            Grid
          </Link>
          <Link 
            href="/dashboard/heatmap" 
            className={`h-full px-6 flex items-center border-l border-white/20 transition-colors ${pathname === '/dashboard/heatmap' ? 'bg-accent-violet text-black border-accent-violet' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
          >
            Heatmap
          </Link>
          <Link 
            href="/dashboard/alerts" 
            className={`h-full px-6 flex items-center border-l border-white/20 transition-colors ${pathname === '/dashboard/alerts' ? 'bg-alert-red text-black border-alert-red' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
          >
            Alerts
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-6 font-mono">
        {session ? (
          <>
            <div
              onClick={() => { markAllRead(); router.push('/dashboard/alerts'); }}
              className="relative group cursor-pointer flex items-center h-[60px] px-4 border-l border-r border-white/20 hover:bg-white/5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="text-text-secondary group-hover:text-white transition-colors">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-3 right-2.5 min-w-[16px] h-[16px] flex items-center justify-center bg-alert-red text-black text-[8px] font-bold px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-[11px] font-bold text-white tracking-widest uppercase">{session.user?.name || 'Operator'}</span>
              </div>
              <div className="h-8 w-8 rounded-none border border-white/20 bg-white/5 flex items-center justify-center text-[12px] font-bold uppercase text-white shadow-none">
                {(session.user?.name || 'O').charAt(0)}
              </div>
            </div>

            <button onClick={() => signOut({ callbackUrl: '/' })} className="h-[60px] px-6 border-l border-white/20 hover:bg-alert-red hover:text-black group transition-colors flex items-center text-[11px] uppercase font-bold tracking-widest">
              Logout
            </button>
          </>
        ) : (
          <>
            <span className="hidden sm:inline-block tracking-wider text-[11px] uppercase font-bold text-text-secondary">connect fields!</span>
            <Link href="/login">
              <button className="px-6 h-[60px] border-l border-white/20 hover:bg-white hover:text-black transition-colors flex items-center text-[11px] uppercase font-bold tracking-widest text-white">
                beta access
              </button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
