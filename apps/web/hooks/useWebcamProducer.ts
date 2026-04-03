'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Device } from 'mediasoup-client';
import { useSignaling } from './useSignaling';
import type { Transport, Producer } from 'mediasoup-client/types';

export function useWebcamProducer() {
  const { request, connected } = useSignaling();
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }
    if (transportRef.current) {
      transportRef.current.close();
      transportRef.current = null;
    }
    deviceRef.current = null;
    setIsPublishing(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  const startWebcam = useCallback(async () => {
    if (!connected) {
      setError('Signaling server not connected');
      return;
    }

    try {
      setError(null);
      
      // 1. Get webcam stream (Video only, per requirements)
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = localStream;
      setStream(localStream);
      const videoTrack = localStream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error('No video track found');
      }

      setIsPublishing(true);

      // 2. Load device
      const { rtpCapabilities } = await request('GET_ROUTER_RTP_CAPABILITIES', {});
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities as any });
      deviceRef.current = device;

      // 3. Create Send Transport
      const transportParams = await request('CREATE_SEND_TRANSPORT', {});
      const transport = device.createSendTransport(transportParams as any);
      transportRef.current = transport;

      // 4. Handle Transport Connect
      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await request('CONNECT_SEND_TRANSPORT', {
            transportId: transport.id,
            dtlsParameters
          });
          callback();
        } catch (err: any) {
          errback(err);
        }
      });

      // 5. Handle Transport Produce
      transport.on('produce', async (parameters, callback, errback) => {
        try {
          const { kind, rtpParameters } = parameters;
          const { id } = await request('PRODUCE', {
            transportId: transport.id,
            kind,
            rtpParameters
          }) as { id: string };
          
          callback({ id });
        } catch (err: any) {
          errback(err);
        }
      });

      // 6. Produce the track
      const producer = await transport.produce({ track: videoTrack });
      producerRef.current = producer;

      producer.on('trackended', () => {
        stopWebcam();
      });

      producer.on('transportclose', () => {
        stopWebcam();
      });

    } catch (err: any) {
      console.error('[Webcam] Failed to start broadcasting:', err);
      setError(err.message || 'Failed to start webcam');
      stopWebcam();
    }
  }, [connected, request, stopWebcam]);

  return {
    stream,
    isPublishing,
    error,
    startWebcam,
    stopWebcam
  };
}
