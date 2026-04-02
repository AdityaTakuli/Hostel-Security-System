/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { useSFU } from '@/hooks/useSFU';
import { useAlertStore } from '@/stores/alertStore';
import CameraFeedCard from '@/components/CameraFeedCard';
import CameraModal from '@/components/CameraModal';
import { Button } from '@hostel-monitor/ui';

interface FloorData {
    id: string;
    label: string;
    posX: number;
    posY: number;
    isOnline: boolean;
    description: string | null;
    unresolvedAlertsCount: number;
}

export default function FloorMapPage({ params }: { params: { hostelId: string, floorNumber: string } }) {
  const { hostelId, floorNumber } = params;
  const num = parseInt(floorNumber, 10);
  
  const [cameras, setCameras] = useState<FloorData[]>([]);
  const [selectedCam, setSelectedCam] = useState<string | null>(null);
  const [cameraDetail, setCameraDetail] = useState<any>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Setup mediasoup SFU connection for this floor
  const { getVideoTrack, connectionStatus } = useSFU({ 
    hostelId, 
    floorNumber: num 
  });

  // Zustand stores for reactive UI
  const alerts = useAlertStore(state => state.alerts);
  const activeAlertCamIds = React.useMemo(() => {
     return new Set(alerts.filter(a => a.hostelId === hostelId && a.floorNumber === num).map(a => a.cameraId));
  }, [alerts, hostelId, num]);

  useEffect(() => {
    fetch(`/api/hostels/${hostelId}/floors/${num}/cameras`)
      .then(res => res.json())
      .then(data => setCameras(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  }, [hostelId, num]);

  // Fetch full details when camera is selected
  useEffect(() => {
      if (selectedCam) {
          fetch(`/api/cameras/${selectedCam}`)
            .then(res => res.json())
            .then(data => setCameraDetail(data));
      } else {
          setCameraDetail(null);
      }
  }, [selectedCam]);

  const handleResolve = async (alertId: string) => {
     setResolvingId(alertId);
     try {
         const res = await fetch(`/api/alerts/${alertId}/resolve`, { method: 'PATCH' });
         if (res.ok) {
             // Refresh camera detail
             fetch(`/api/cameras/${selectedCam}`).then(r => r.json()).then(setCameraDetail);
             // Inform store
             useAlertStore.getState().resolveAlert(alertId);
         }
     } finally {
         setResolvingId(null);
     }
  };

  return (
    <div className="min-h-screen p-6 relative z-10 flex flex-col h-screen overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-2 text-sm font-mono text-text-secondary">
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <span>/</span>
              <Link href={`/hostel/${hostelId}`} className="hover:text-white transition-colors">Hostel {hostelId}</Link>
              <span>/</span>
              <span className="text-white font-bold px-2 py-1 bg-surface-elevated rounded border border-border">Floor {num}</span>
          </div>

          <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-1">
              <Link href={`/hostel/${hostelId}/floor/${num - 1}`}>
                 <Button variant="ghost" size="sm" className="h-8" disabled={num <= 1}>
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                     Down
                 </Button>
              </Link>
              <div className="w-px h-6 bg-border mx-1" />
              <Link href={`/hostel/${hostelId}/floor/${num + 1}`}>
                 <Button variant="ghost" size="sm" className="h-8" disabled={num >= 16 /* Assuming max */}>
                     Up
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                 </Button>
              </Link>
          </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
         
         {/* Map View */}
         <div className="lg:col-span-2 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
             
             {/* Map Container */}
             <div className="w-full bg-surface-elevated border border-border rounded-xl p-4">
                 <div className="flex justify-between items-center mb-4">
                     <h2 className="text-sm font-mono text-text-secondary">TACTICAL MAP</h2>
                     <div className="flex items-center gap-4 text-xs font-mono">
                         <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-online-green" /> Online</div>
                         <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-alert-red" /> Alert</div>
                         <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-offline-gray" /> Offline</div>
                         <div className="flex items-center gap-2 ml-4">
                             <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-online-green animate-pulse' : connectionStatus === 'connecting' ? 'bg-warning-amber' : 'bg-alert-red'}`} />
                             SFU {connectionStatus}
                         </div>
                     </div>
                 </div>

                 <div className="floor-map-container">
                     {/* Placeholder map image */}
                     <Image 
                        src={`/maps/hostel-${hostelId}-floor-map.png`} 
                        alt="Floor Plan" 
                        fill 
                        style={{ objectFit: 'contain' }}
                        className="opacity-70"
                        priority
                     />
                     
                     {/* SVG Overlay for camera nodes */}
                     <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                         {cameras.map(cam => {
                             const hasAlert = activeAlertCamIds.has(cam.id) || cam.unresolvedAlertsCount > 0;
                             const isOnline = cam.isOnline; // To do: integrate with live status store
                             
                             const colorClass = hasAlert ? 'text-alert-red' : (isOnline ? 'text-online-green' : 'text-offline-gray');
                             
                             return (
                                 <g 
                                     key={cam.id} 
                                     transform={`translate(${cam.posX}, ${cam.posY})`} 
                                     className="cursor-pointer pointer-events-auto group"
                                     onClick={() => setSelectedCam(cam.id)}
                                 >
                                     {hasAlert && (
                                         <circle r="4" fill="currentColor" className={`${colorClass} animate-ping opacity-75`} />
                                     )}
                                     <circle r="1.5" fill="currentColor" className={colorClass} />
                                     <circle r="2" fill="none" strokeWidth="0.3" stroke="currentColor" className={`${colorClass} opacity-50`} />
                                     <text 
                                        y="-3" 
                                        textAnchor="middle" 
                                        className="text-[2px] font-mono fill-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ textShadow: '0 0 2px black' }}
                                     >
                                        {cam.label}
                                     </text>
                                 </g>
                             );
                         })}
                     </svg>
                 </div>
             </div>

             {/* Live Grid */}
             <div className="mt-2 flex-1">
                 <h2 className="text-sm font-mono text-text-secondary uppercase mb-3">Live Feed Grid</h2>
                 
                 {/* Shared PeerConnection — all tracks multiplexed over one DTLS transport */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                     {cameras.map(cam => (
                         <div key={cam.id} className="aspect-video" onClick={() => setSelectedCam(cam.id)}>
                             <CameraFeedCard 
                                 camera={cam} 
                                 track={getVideoTrack(cam.id)} 
                                 hasAlert={activeAlertCamIds.has(cam.id) || cam.unresolvedAlertsCount > 0} 
                             />
                         </div>
                     ))}
                 </div>
             </div>
         </div>
         
         <div className="bg-surface-elevated border border-border rounded-xl">
            {/* Keeping right pillar structured for later alerts integration here */}
            <div className="p-4 border-b border-border">
                <h2 className="text-sm font-mono text-text-secondary uppercase">Local Events</h2>
            </div>
            <div className="p-4 flex flex-col items-center justify-center h-48 opacity-50 text-sm font-mono text-center">
                Select a camera feed to view event history and initiate protocols.
            </div>
         </div>

      </div>

      {/* Modal */}
      <AnimatePresence>
          {selectedCam && cameraDetail && (
              <CameraModal 
                  camera={cameraDetail}
                  track={getVideoTrack(selectedCam)}
                  alerts={cameraDetail.alerts}
                  onClose={() => setSelectedCam(null)}
                  onResolve={handleResolve}
                  resolvingAlertId={resolvingId}
              />
          )}
      </AnimatePresence>
    </div>
  );
}
