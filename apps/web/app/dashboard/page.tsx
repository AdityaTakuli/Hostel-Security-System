'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import { Card, Badge, StatusDot, Button } from '@hostel-monitor/ui';
import { useAlertStore } from '@/stores/alertStore';
import { ALERT_TYPE_EMOJI, ALERT_TYPE_LABEL, SEVERITY_COLOR } from '@hostel-monitor/types';
import { useWebcamProducer } from '@/hooks/useWebcamProducer';
import { useSFU } from '@/hooks/useSFU';
import DetectionOverlay from '@/components/DetectionOverlay';

export const dynamic = 'force-dynamic';

function WebcamBroadcaster() {
  const { stream, isPublishing, error, startWebcam, stopWebcam } = useWebcamProducer();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="border border-white/20 p-5 bg-black">
      <span className="text-text-secondary text-[9px] uppercase tracking-[0.3em] font-bold block mb-4">Broadcast Node</span>
      {error && <div className="text-accent-red text-[10px] mb-2">{error}</div>}
      
      {isPublishing ? (
        <div className="flex flex-col gap-3">
          <div className="relative aspect-video bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
             <video 
               ref={videoRef} 
               autoPlay 
               playsInline 
               muted 
               className="w-full h-full object-cover" 
             />
             <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/80 px-2 py-1 border border-accent-red/50 text-[9px] text-accent-red font-bold tracking-widest">
               <div className="w-1.5 h-1.5 rounded-none bg-accent-red" /> REC
             </div>
          </div>
          <Button variant="danger" size="sm" onClick={stopWebcam} className="w-full">
            Stop Broadcasting
          </Button>
        </div>
      ) : (
        <Button variant="primary" size="sm" onClick={startWebcam} className="w-full">
          Initialize Webcam
        </Button>
      )}
    </div>
  );
}

function VideoTile({ track, cameraId, index }: { track: MediaStreamTrack | null; cameraId: string; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  useEffect(() => {
    if (videoRef.current && track) {
      const stream = new MediaStream([track]);
      videoRef.current.srcObject = stream;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
    }
  }, [track]);

  const label = cameraId.startsWith('laptop_') 
    ? `Node ${cameraId.split('_').pop()?.slice(0, 6).toUpperCase() || index + 1}` 
    : cameraId.slice(0, 8).toUpperCase();

  return (
    <div className="relative group bg-[#0a0a0a] border border-white/10 hover:border-accent-violet/60 transition-all duration-300 flex flex-col overflow-hidden">
      
      {/* Video Container */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        {track ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover" 
            />
            {/* Scanline overlay for brutalist feel */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.1) 1px, rgba(255,255,255,0.1) 2px)',
              backgroundSize: '100% 2px'
            }} />
            <DetectionOverlay cameraId={cameraId} width={640} height={480} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 opacity-30">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
              <path d="M23 7l-7 5 7 5V7z"/>
              <rect x="1" y="5" width="15" height="14" rx="0" ry="0"/>
            </svg>
            <span className="text-[9px] text-text-secondary uppercase tracking-[0.2em] font-bold">Connecting...</span>
          </div>
        )}

        {/* Live indicator badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/80 backdrop-blur-sm px-2 py-1 border border-white/10">
          <div className={`w-1.5 h-1.5 ${isPlaying ? 'bg-accent-red animate-pulse' : 'bg-white/30'}`} />
          <span className={`text-[8px] font-bold tracking-[0.2em] uppercase ${isPlaying ? 'text-accent-red' : 'text-white/30'}`}>
            {isPlaying ? 'LIVE' : 'IDLE'}
          </span>
        </div>

        {/* Signal quality indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/80 backdrop-blur-sm px-2 py-1 border border-white/10">
          <div className="flex items-end gap-[2px] h-3">
            {[1, 2, 3, 4].map(bar => (
              <div 
                key={bar} 
                className={`w-[3px] ${isPlaying ? 'bg-accent-cyan' : 'bg-white/20'}`} 
                style={{ height: `${bar * 25}%` }} 
              />
            ))}
          </div>
          <span className="text-[8px] text-accent-cyan font-bold tracking-wider ml-1">RX</span>
        </div>

        {/* Participant label overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Avatar placeholder */}
              <div className="w-6 h-6 bg-accent-violet/30 border border-accent-violet/50 flex items-center justify-center">
                <span className="text-[8px] text-accent-violet font-bold">{(index + 1).toString().padStart(2, '0')}</span>
              </div>
              <div>
                <span className="text-[10px] text-white font-bold tracking-widest uppercase block leading-tight">{label}</span>
                <span className="text-[8px] text-text-secondary tracking-wider uppercase">Cam Feed</span>
              </div>
            </div>
            {isPlaying && (
              <div className="flex items-center gap-1">
                {/* Audio-level-style bars (fake, for visual) */}
                {[3, 5, 2, 6, 4, 3, 5].map((h, i) => (
                  <div
                    key={i}
                    className="w-[2px] bg-accent-cyan/70"
                    style={{ 
                      height: `${h * 2}px`,
                      animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyVideoTile({ index }: { index: number }) {
  return (
    <div className="relative bg-[#0a0a0a] border border-dashed border-white/10 flex flex-col overflow-hidden">
      <div className="relative aspect-video flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 opacity-20">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="0" ry="0"/>
            <line x1="1" y1="1" x2="23" y2="23" strokeWidth="1.5"/>
          </svg>
          <span className="text-[8px] uppercase tracking-[0.3em] text-text-secondary font-bold">
            Slot {(index + 1).toString().padStart(2, '0')} — Awaiting
          </span>
        </div>
        
        {/* Corner markers */}
        <div className="absolute top-2 left-2 w-3 h-3 border-l border-t border-white/10" />
        <div className="absolute top-2 right-2 w-3 h-3 border-r border-t border-white/10" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-l border-b border-white/10" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-r border-b border-white/10" />
      </div>
    </div>
  );
}

function GlobalViewer() {
  const { activeCameraIds, getVideoTrack, connectionStatus } = useSFU({ hostelId: 'global', floorNumber: 0 });

  const totalSlots = Math.max(activeCameraIds.length, 4); // min 4 slots shown
  const emptySlots = totalSlots - activeCameraIds.length;

  // Responsive grid: 1 → full, 2 → 2col, 3-4 → 2x2, 5-6 → 3x2, etc. (like Zoom)
  const gridClass = totalSlots === 1 
    ? 'grid-cols-1 max-w-2xl mx-auto' 
    : totalSlots === 2 
    ? 'grid-cols-2' 
    : totalSlots <= 4 
    ? 'grid-cols-2' 
    : totalSlots <= 6 
    ? 'grid-cols-3'
    : 'grid-cols-3 lg:grid-cols-4';

  return (
    <div className="w-full mb-6 relative">
      {/* Header bar */}
      <div className="px-1 mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-accent-cyan flex flex-row items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold">
            <span className="w-2 h-2 bg-accent-cyan animate-pulse" /> LIVE NODE MATRIX
          </span>
          <div className="h-3 w-px bg-white/20" />
          <span className={`text-[9px] uppercase tracking-widest font-bold ${
            connectionStatus === 'connected' ? 'text-accent-cyan' : 
            connectionStatus === 'connecting' ? 'text-yellow-500' : 
            'text-accent-red'
          }`}>
            {connectionStatus === 'connected' ? '● Connected' : 
             connectionStatus === 'connecting' ? '◌ Connecting...' : 
             '○ Offline'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-[9px] bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20">
            {activeCameraIds.length} LIVE
          </Badge>
          <Badge variant="default" className="text-[9px] bg-white/5 text-text-secondary border-white/10">
            {emptySlots} IDLE
          </Badge>
        </div>
      </div>

      {/* Zoom-call-style video grid */}
      <div className={`grid gap-2 ${gridClass}`}>
        {activeCameraIds.map((cameraId, i) => (
          <VideoTile key={cameraId} track={getVideoTrack(cameraId)} cameraId={cameraId} index={i} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptyVideoTile key={`empty-${i}`} index={activeCameraIds.length + i} />
        ))}
      </div>

      {/* Bottom status bar */}
      <div className="mt-3 flex items-center justify-between px-1 py-2 border-t border-white/10">
        <div className="flex items-center gap-4 text-[8px] uppercase tracking-[0.2em] text-text-secondary font-bold">
          <span>Protocol: WebRTC/SFU</span>
          <span className="text-white/10">|</span>
          <span>Codec: VP8/H264</span>
          <span className="text-white/10">|</span>
          <span>Mode: Receive-Only</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 ${connectionStatus === 'connected' ? 'bg-accent-cyan' : 'bg-white/20'}`} />
          <span className="text-[8px] text-text-secondary uppercase tracking-widest font-bold">
            SFU Tunnel {connectionStatus === 'connected' ? 'Active' : 'Standby'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [hostels, setHostels] = useState<any[]>([]);
  const { alerts, unreadCount, markAllRead, resolveAlert } = useAlertStore();
  const [isResolving, setIsResolving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hostels')
      .then(res => res.json())
      .then(data => setHostels(Array.isArray(data) ? data : []));

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
    <div className="min-h-[100dvh] flex flex-col relative bg-black overflow-hidden text-white font-mono selection:bg-accent-violet selection:text-white">
      
      {/* ── Marquee Separator ────────────────────── */}
      <div className="w-full border-b border-white/20 bg-black overflow-hidden py-1 z-20 flex">
        <div className="flex w-max animate-marquee text-[9px] text-text-secondary uppercase tracking-[0.3em] whitespace-nowrap">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="px-4 flex items-center gap-6 font-bold">
              system actively monitoring all linked sectors
            </span>
          ))}
        </div>
      </div>

      {/* ── Main Layout Matrix ─────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-85px)] overflow-hidden">

        {/* Left Col: Hostels / Sectors */}
        <div className="lg:col-span-3 flex flex-col h-full border-r border-white/20 bg-black/50">
          <div className="p-4 border-b border-white/20 bg-white/[0.02]">
            <h2 className="text-[10px] text-accent-violet uppercase tracking-[0.3em] font-bold">
              Active Sectors ({hostels.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto w-full">
            {hostels.map((hostel, i) => (
              <Link key={hostel.id} href={`/hostel/${hostel.id}`} className="block border-b border-white/10 hover:bg-white/5 transition-colors group">
                <div className="p-5 flex justify-between items-start relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-violet opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div>
                    <h3 className="font-bold text-[14px] text-white tracking-widest uppercase mb-2">{hostel.name}</h3>
                    <div className="flex items-center gap-2">
                       <StatusDot status={hostel.activeAlerts > 0 ? "critical" : "online"} size="sm" pulse={false} />
                       <p className="text-[10px] text-text-secondary uppercase tracking-widest">{hostel.floors} Nodes</p>
                    </div>
                  </div>
                  <div>
                    {hostel.activeAlerts > 0 ? (
                         <Badge variant="danger" pulse className="text-[9px]">
                           {hostel.activeAlerts} Critical
                         </Badge>
                    ) : (
                         <Badge variant="success" className="text-[9px]">
                           Clear
                         </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Center Col: Live Feed */}
        <div className="lg:col-span-6 flex flex-col h-full bg-black border-r border-white/20">
          
          <div className="p-6 border-b border-white/20 bg-white/[0.02] flex justify-between items-center">
            <h2 className="text-[14px] font-bold tracking-widest uppercase text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-accent-cyan animate-pulse" /> Live Incident Feed
            </h2>
            <Badge variant="default" className="text-[10px]">
              {alerts.length} Pending Actions
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            
            {/* ── Global Live Zoom Matrix ── */}
            <GlobalViewer />

            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-text-secondary border border-dashed border-white/20">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter" className="mb-4">
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  <path d="M14 14.004V14"/>
                  <circle cx="16" cy="6" r="4"/>
                </svg>
                <p className="text-[11px] uppercase tracking-[0.2em] font-bold">No active incidents</p>
              </div>
            ) : (
              <AnimatePresence>
                {alerts.map((alert) => (
                  <motion.div
                    key={alert.alertId}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="relative border border-white/20 bg-black hover:border-white/50 transition-colors p-6">
                      {/* Brutalist structural line */}
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: SEVERITY_COLOR[alert.severity] }} />
                      
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{ALERT_TYPE_EMOJI[alert.alertType]}</span>
                          <span className="font-bold text-white text-[13px] tracking-widest uppercase">{ALERT_TYPE_LABEL[alert.alertType]}</span>
                        </div>
                        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-[0.2em]">Just now</span>
                      </div>

                      <p className="text-[12px] text-text-secondary leading-[1.8] mb-6 max-w-lg">{alert.description}</p>

                      <div className="flex items-center justify-between border-t border-white/10 pt-4">
                        <div className="flex gap-4 text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                          <span>SOURCE: <span className="text-white">{alert.cameraLabel}</span></span>
                          <span>LOC: <span className="text-white">SEC {alert.hostelId}</span></span>
                        </div>

                        <div className="flex gap-2">
                          <Link href={`/hostel/${alert.hostelId}/floor/${alert.floorNumber}`}>
                            <Button variant="secondary" size="sm">Examine</Button>
                          </Link>
                          <Button 
                            variant="primary" 
                            size="sm"
                            onClick={() => handleResolve(alert.alertId)}
                            loading={isResolving === alert.alertId}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Right Col: Diagnostics */}
        <div className="lg:col-span-3 flex flex-col h-full bg-black/50">
          <div className="p-4 border-b border-white/20 bg-white/[0.02]">
            <h2 className="text-[10px] text-white/50 uppercase tracking-[0.3em] font-bold">System Diagnostics</h2>
          </div>

          <div className="p-6 flex flex-col gap-6 w-full">
            
            {/* Metric Box 1 */}
            <div className="border border-white/20 p-5 bg-black">
              <span className="text-text-secondary text-[9px] uppercase tracking-[0.3em] font-bold block mb-4">Linked Nodes</span>
              <div className="flex items-end gap-3 mb-4">
                <span className="text-4xl font-bold text-white leading-none tracking-[-0.05em]">{totalCameras}</span>
                <span className="text-[10px] text-accent-cyan uppercase font-bold tracking-widest mb-1">/ 189 Live</span>
              </div>
              <div className="w-full h-1 bg-white/10">
                <div className="h-full bg-accent-cyan" style={{ width: `${(totalCameras / 189) * 100}%` }} />
              </div>
            </div>

            {/* Metric Box 2 */}
            <div className="border border-white/20 p-5 bg-black">
              <span className="text-text-secondary text-[9px] uppercase tracking-[0.3em] font-bold block mb-4">Active Grids</span>
              <div className="flex items-end gap-3 mb-1">
                <span className="text-4xl font-bold text-white leading-none tracking-[-0.05em]">4</span>
                <span className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mb-1">Sectors</span>
              </div>
            </div>

            {/* Webcam Broadcaster */}
            <WebcamBroadcaster />

            {/* Status indicators */}
            <div className="border border-white/20 p-5 bg-black">
              <span className="text-text-secondary text-[9px] uppercase tracking-[0.3em] font-bold block mb-4">Service Status</span>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-[10px] uppercase tracking-widest text-[#B0B0B0] font-bold">WebRTC Tunnels</span>
                  <StatusDot status="online" size="sm" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#B0B0B0] font-bold">Inference Matrix</span>
                  <StatusDot status="online" size="sm" />
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Global overrides for brutalist look */}
      <style dangerouslySetInnerHTML={{__html:`
        * { border-radius: 0 !important; }
      `}} />
    </div>
  );
}
