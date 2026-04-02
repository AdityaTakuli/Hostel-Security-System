'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import { Card, Badge, StatusDot, Button } from '@hostel-monitor/ui';
import { useAlertStore } from '@/stores/alertStore';
import { ALERT_TYPE_EMOJI, ALERT_TYPE_LABEL, SEVERITY_COLOR } from '@hostel-monitor/types';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [hostels, setHostels] = useState<any[]>([]);
  const { alerts, unreadCount, markAllRead, resolveAlert } = useAlertStore();
  const [isResolving, setIsResolving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hostels')
      .then(res => res.json())
      .then(data => setHostels(Array.isArray(data) ? data : []));

    // Mark alerts as read when viewing dashboard
    return () => markAllRead();
  }, [markAllRead]);

  const handleResolve = async (alertId: string) => {
    setIsResolving(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}/resolve`, { method: 'PATCH' });
      if (res.ok) {
        resolveAlert(alertId);
      }
    } finally {
      setIsResolving(null);
    }
  };

  const totalCameras = hostels.reduce((acc, h) => acc + h.onlineCameras, 0);
  const totalAlerts = hostels.reduce((acc, h) => acc + h.activeAlerts, 0);

  return (
    <div className="min-h-screen flex flex-col z-10 relative">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-border bg-surface-elevated/50 backdrop-blur flex justify-between items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold tracking-tight text-lg">HMS<span className="text-accent-blue">.SYS</span></span>
          <div className="h-4 w-px bg-border mx-2" />
          <span className="text-text-secondary text-sm font-mono uppercase tracking-widest hidden sm:inline-block">Command Center</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary hover:text-white transition-colors cursor-pointer">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-alert-red text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-medium">{session?.user?.name || 'Operator'}</span>
              <span className="text-xs text-text-secondary font-mono bg-border/50 px-1.5 rounded">{session?.user?.role || 'Guest'}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-accent-blue to-purple-600 flex items-center justify-center text-white font-mono font-bold text-sm">
              {(session?.user?.name || 'O').charAt(0)}
            </div>
          </div>

          <button onClick={() => signOut({ callbackUrl: '/' })} className="text-text-secondary hover:text-alert-red transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-64px)] overflow-hidden">

        {/* Left Col: Hostels */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <h2 className="text-sm font-mono text-text-secondary uppercase mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
            Sectors Overview
          </h2>

          <div className="flex flex-col gap-3 overflow-y-auto pr-2 pb-4 scrollbar-thin">
            {hostels.map(hostel => (
              <Link key={hostel.id} href={`/hostel/${hostel.id}`}>
                <Card className="p-4 hover:border-accent-blue/50 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-8 rounded-sm" style={{ backgroundColor: hostel.color }} />
                      <div>
                        <h3 className="font-mono font-bold group-hover:text-white transition-colors">{hostel.name}</h3>
                        <p className="text-xs text-text-secondary">{hostel.floors} Floors</p>
                      </div>
                    </div>
                    <Badge variant={hostel.activeAlerts > 0 ? 'danger' : 'success'} pulse={hostel.activeAlerts > 0}>
                      {hostel.activeAlerts > 0 ? `${hostel.activeAlerts} Alerts` : 'Clear'}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Center Col: Live Feed */}
        <div className="lg:col-span-6 flex flex-col h-full bg-surface-elevated/30 rounded-xl border border-border overflow-hidden relative">
          <div className="p-4 border-b border-border bg-surface-elevated flex justify-between items-center z-10">
            <h2 className="text-sm font-mono text-text-secondary uppercase flex items-center gap-2">
              <StatusDot status="warning" pulse />
              Live Incident Feed
            </h2>
            <span className="text-xs font-mono bg-border px-2 py-1 rounded text-text-secondary">
              {alerts.length} Records
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50">
                <svg className="w-12 h-12 mb-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-mono">No active incidents detected.</p>
              </div>
            ) : (
              <AnimatePresence>
                {alerts.map(alert => (
                  <motion.div
                    key={alert.alertId}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                  >
                    <Card className="overflow-hidden border-border bg-surface">
                      <div className="flex">
                        <div className="w-1 shrink-0" style={{ backgroundColor: SEVERITY_COLOR[alert.severity] }} />
                        <div className="flex-1 p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{ALERT_TYPE_EMOJI[alert.alertType]}</span>
                              <span className="font-bold text-white">{ALERT_TYPE_LABEL[alert.alertType]}</span>
                            </div>
                            <span className="text-xs text-text-secondary font-mono">
                              {/* Fake timestamp for demo since payload timestamp isn't explicitly defined, using Date.now() locally is fine or format hook */}
                              Just now
                            </span>
                          </div>

                          <p className="text-sm text-text-secondary mb-3">{alert.description}</p>

                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <Badge variant="default">{alert.cameraLabel}</Badge>
                              <span className="text-text-secondary">Floor {alert.floorNumber}</span>
                            </div>

                            <div className="flex gap-2">
                              <Link href={`/hostel/${alert.hostelId}/floor/${alert.floorNumber}`}>
                                <Button size="sm" variant="secondary" className="h-7 text-xs">View Cam</Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs hover:text-online-green"
                                onClick={() => handleResolve(alert.alertId)}
                                loading={isResolving === alert.alertId}
                              >
                                Resolve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-surface-elevated to-transparent pointer-events-none" />
        </div>

        {/* Right Col: System Health */}
        <div className="lg:col-span-3 flex flex-col h-full gap-4">
          <h2 className="text-sm font-mono text-text-secondary uppercase mb-0 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            System Diagnostics
          </h2>

          <Card className="p-5 flex flex-col justify-center gap-1 glow-blue border-accent-blue/20 bg-accent-blue/5">
            <span className="text-text-secondary text-xs font-mono uppercase">Global Connect Rate</span>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white font-mono">{totalCameras}</span>
              <span className="text-sm text-accent-blue mb-1">/ 189 Nodes</span>
            </div>
            <div className="w-full h-1 bg-surface-elevated rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-accent-blue" style={{ width: `${(totalCameras / 189) * 100}%` }} />
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-center gap-1 border-border">
            <span className="text-text-secondary text-xs font-mono uppercase">Total Active Subsystems</span>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white font-mono">4</span>
              <span className="text-sm text-text-secondary mb-1">Hostels</span>
            </div>
          </Card>

          <Card className="px-4 py-3 flex items-center justify-between border-border bg-surface text-sm">
            <span className="text-text-secondary">WebSocket Uplink</span>
            <StatusDot status="online" />
          </Card>

          <Card className="px-4 py-3 flex items-center justify-between border-border bg-surface text-sm">
            <span className="text-text-secondary">ML Inference Engine</span>
            <StatusDot status="online" />
          </Card>
        </div>

      </main>
    </div>
  );
}
