'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import { useSignaling } from './useSignaling';
import type { Transport, Consumer, RtpParameters } from 'mediasoup-client/types';
import type { ProducerAddedPayload, ConsumedPayload } from '@hostel-monitor/types';

interface SFUOptions {
  hostelId: string | undefined;
  floorNumber: number | undefined;
}

interface SFUResult {
  getVideoTrack: (cameraId: string) => MediaStreamTrack | null;
  activeCameraIds: string[];
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export function useSFU({ hostelId, floorNumber }: SFUOptions): SFUResult {
  const { request, sendMessage, subscribe, connected } = useSignaling();
  const [connectionStatus, setConnectionStatus] = useState<SFUResult['connectionStatus']>('disconnected');

  // Use refs to keep track of WebRTC state without triggering re-renders
  const deviceRef = useRef<Device | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());

  // This state maps cameraId -> MediaStreamTrack, causing re-renders when tracks change
  const [tracks, setTracks] = useState<Map<string, MediaStreamTrack>>(new Map());
  const [activeCameraIds, setActiveCameraIds] = useState<string[]>([]);

  // Main connection flow
  useEffect(() => {
    if (!hostelId || floorNumber == null || !connected) {
      return;
    }

    let isSubscribed = true;
    setConnectionStatus('connecting');

    const initSFU = async () => {
      try {
        console.log('[sfu] Starting initialization flow...');

        // Step 2: Load mediasoup Device
        const { rtpCapabilities } = await request('GET_ROUTER_RTP_CAPABILITIES', {});
        console.log('[sfu] Received router capabilities');

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        deviceRef.current = device;
        console.log('[sfu] Device loaded');

        // Step 3: Create receive transport
        const transportParams = await request('CREATE_RECV_TRANSPORT', {});
        console.log('[sfu] Received transport parameters:', transportParams);

        const transport = device.createRecvTransport(transportParams);
        transportRef.current = transport;

        transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            console.log('[sfu] Transport connect event triggered');
            await request('CONNECT_RECV_TRANSPORT', {
              transportId: transport.id,
              dtlsParameters
            });
            callback();
          } catch (error: any) {
            console.error('[sfu] Failed to connect transport:', error);
            errback(error);
          }
        });

        transport.on('connectionstatechange', (state) => {
          console.log(`[sfu] Transport state changed to: ${state}`);
          if (state === 'connected') {
            setConnectionStatus('connected');
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            if (isSubscribed) setConnectionStatus(state === 'failed' ? 'error' : 'disconnected');
          }
        });

        // Step 4: Subscribe to floor
        sendMessage('JOIN_FLOOR', { hostelId, floorNumber });
        console.log(`[sfu] Joined floor ${floorNumber} in hostel ${hostelId}`);

      } catch (error) {
        console.error('[sfu] Initialisation error:', error);
        if (isSubscribed) setConnectionStatus('error');
      }
    };

    initSFU();

    return () => {
      console.log(`[sfu] Cleaning up resources for floor ${floorNumber}`);
      isSubscribed = false;

      // Cleanup on unmount
      sendMessage('LEAVE_FLOOR', { hostelId, floorNumber });

      consumersRef.current.forEach(consumer => consumer.close());
      consumersRef.current.clear();

      if (transportRef.current && !transportRef.current.closed) {
        transportRef.current.close();
      }

      setTracks(new Map());
      deviceRef.current = null;
      transportRef.current = null;
    };
  }, [hostelId, floorNumber, connected, request, sendMessage]);

  // Listener for PRODUCER_ADDED (Step 5)
  useEffect(() => {
    if (!hostelId || floorNumber == null) return;

    const handleProducerAdded = async (payload: ProducerAddedPayload) => {
      // Validate this is for our floor
      if (payload.hostelId !== hostelId || payload.floorNumber !== floorNumber) return;

      const device = deviceRef.current;
      const transport = transportRef.current;

      if (!device || !transport) {
        console.warn('[sfu] Producer added, but device/transport not ready');
        return;
      }

      try {
        console.log(`[sfu] Consuming producer ${payload.producerId} for camera ${payload.cameraId}`);

        const params: ConsumedPayload = await request('CONSUME', {
          producerId: payload.producerId,
          transportId: transport.id,
          rtpCapabilities: device.rtpCapabilities
        });

        // Consume locally
        const consumer = await transport.consume({
          id: params.consumerId,
          producerId: params.producerId,
          kind: params.kind, // 'video'
          rtpParameters: params.rtpParameters as RtpParameters,
        });

        consumersRef.current.set(payload.cameraId, consumer);

        // Add track to state
        setTracks(prev => {
          const next = new Map(prev);
          next.set(payload.cameraId, consumer.track);
          return next;
        });
        setActiveCameraIds(prev => Array.from(new Set([...prev, payload.cameraId])));

        // Resume consumer server-side
        sendMessage('RESUME_CONSUMER', { consumerId: params.consumerId });
        console.log(`[sfu] Consumer for camera ${payload.cameraId} resumed and ready`);

      } catch (error) {
        console.error('[sfu] Error consuming producer:', error);
      }
    };

    const unsubscribe = subscribe('PRODUCER_ADDED', handleProducerAdded);
    return () => unsubscribe();
  }, [hostelId, floorNumber, request, sendMessage, subscribe]);

  // Listener for PRODUCER_REMOVED (Step 6)
  useEffect(() => {
    const handleProducerRemoved = (payload: { cameraId: string, producerId: string }) => {
      console.log(`[sfu] Producer removed for camera ${payload.cameraId}`);

      const consumer = consumersRef.current.get(payload.cameraId);
      if (consumer) {
        consumer.close();
        consumersRef.current.delete(payload.cameraId);
      }

      setTracks(prev => {
        const next = new Map(prev);
        next.delete(payload.cameraId);
        return next;
      });
      setActiveCameraIds(prev => prev.filter(id => id !== payload.cameraId));
    };

    const unsubscribe = subscribe('PRODUCER_REMOVED', handleProducerRemoved);
    return () => unsubscribe();
  }, [subscribe]);

  const getVideoTrack = useCallback((cameraId: string): MediaStreamTrack | null => {
    return tracks.get(cameraId) || null;
  }, [tracks]);

  return {
    getVideoTrack,
    activeCameraIds,
    connectionStatus
  };
}
