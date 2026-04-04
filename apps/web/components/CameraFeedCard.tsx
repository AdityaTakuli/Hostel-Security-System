'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CameraStatusPayload } from '@hostel-monitor/types';
import { useCameraStore } from '@/stores/cameraStore';
import DetectionOverlay from './DetectionOverlay';
import { useDetectionStore } from '@/stores/detectionStore';

interface CameraFeedProps {
  camera: { id: string; label: string; description: string | null };
  track: MediaStreamTrack | null;
  hasAlert: boolean;
}

export default function CameraFeedCard({ camera, track, hasAlert }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isOnline = useCameraStore(state => state.onlineStatus.get(camera.id) ?? true);
  const surveillanceActive = useDetectionStore(state => state.surveillanceStatus.get(camera.id) ?? true);
  const setSurveillance = useDetectionStore(state => state.setSurveillance);

  const toggleSurveillance = useCallback(() => {
    const newState = !surveillanceActive;
    setSurveillance(camera.id, newState);

    // Emit SURVEILLANCE_TOGGLE via WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'SURVEILLANCE_TOGGLE',
          payload: { cameraId: camera.id, active: newState },
          timestamp: Date.now(),
        }));
        setTimeout(() => ws.close(), 500);
      };
    } catch (e) {
      console.error('[CameraFeedCard] Failed to send SURVEILLANCE_TOGGLE:', e);
    }
  }, [camera.id, surveillanceActive, setSurveillance]);

  useEffect(() => {
    if (videoRef.current) {
      if (track) {
        const stream = new MediaStream([track]);
        videoRef.current.srcObject = stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [track]);

  return (
    <div className={`camera-feed-card flex flex-col h-full bg-surface-elevated/50 ${hasAlert ? 'has-alert' : ''}`}>
      <div className={`relative flex-1 bg-black overflow-hidden flex items-center justify-center ${!surveillanceActive ? 'opacity-40' : ''}`}>
        {track ? (
          <>
            <div className="live-badge">LIVE</div>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {surveillanceActive && (
              <DetectionOverlay cameraId={camera.id} width={640} height={480} />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <svg className="w-8 h-8 text-text-secondary mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-mono text-text-secondary uppercase flex items-center gap-2">
              {!isOnline ? 'Offline' : (
                <>
                  <div className="w-3 h-3 border-2 border-text-secondary border-t-accent-blue rounded-full animate-spin" />
                  Connecting
                </>
              )}
            </span>
          </div>
        )}

        {/* SURVEILLANCE OFF badge */}
        {!surveillanceActive && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-black/80 border border-white/30 px-4 py-2">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/70">
                Surveillance Off
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex justify-between items-center bg-surface shrink-0">
        <div className="flex flex-col">
          <span className="text-sm font-mono font-bold text-white">{camera.label}</span>
          <span className="text-xs text-text-secondary truncate max-w-[200px]">{camera.description || 'No description'}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasAlert && <span className="w-2 h-2 rounded-full bg-alert-red animate-pulse" />}
          {/* Surveillance toggle chip */}
          <button
            onClick={toggleSurveillance}
            title={surveillanceActive ? 'Disable ML surveillance' : 'Enable ML surveillance'}
            className={`p-1.5 border transition-colors ${
              surveillanceActive
                ? 'border-online-green/40 text-online-green hover:bg-online-green/10'
                : 'border-white/20 text-white/40 hover:bg-white/10'
            }`}
          >
            {surveillanceActive ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
