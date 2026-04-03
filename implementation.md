# Step-by-Step Guide: Laptop Webcam Streaming via WebRTC

This guide explains exactly what files to update, the exact code to add, and how to physically test the video streaming across multiple laptops on the same network. This implementation exclusively handles **video streaming** (no audio) and does not rely on the database for physical cameras.

---

## Part 1: Required File Updates & Code

All of the following code modifications happen on the **Central Server Laptop** (the machine hosting your codebase).

### 1. Update Signaling Types
**File**: `packages/types/src/websocket.ts`

Add the broadcasting message types to your `WSMessageType` union and define their payload interfaces.

```typescript
// Add these to the existing WSMessageType union:
export type WSMessageType =
  // ... existing types
  | 'CREATE_SEND_TRANSPORT'
  | 'SEND_TRANSPORT_CREATED'
  | 'CONNECT_SEND_TRANSPORT'
  | 'SEND_TRANSPORT_CONNECTED'
  | 'PRODUCE'
  | 'PRODUCED';

// Add the corresponding payload interfaces:
export interface CreateSendTransportPayload {}

export interface SendTransportCreatedPayload {
  transportId: string;
  iceParameters: Record<string, unknown>;
  iceCandidates: Record<string, unknown>[];
  dtlsParameters: Record<string, unknown>;
}

export interface ConnectSendTransportPayload {
  transportId: string;
  dtlsParameters: Record<string, unknown>;
}

export interface SendTransportConnectedPayload {
  transportId: string;
}

export interface ProducePayload {
  transportId: string;
  kind: 'audio' | 'video'; // We will strictly enforce 'video' in the hook
  rtpParameters: Record<string, unknown>;
}

export interface ProducedPayload {
  id: string; // The generated producer ID
}
```

### 2. Add Backend WebRTC Transport Methods
**File**: `apps/media-server/src/mediasoup/transport.ts`

Append these methods to the bottom of the file to allow the server to ingest streams from web browsers.

```typescript
// Append to the bottom of transport.ts

export async function createSendTransport(
  clientId: string,
  workerIndex: number
) {
  const router = getRouter(workerIndex);
  const announcedIp = process.env.ANNOUNCED_IP || '127.0.0.1'; // Update to your local IP optionally

  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transportMap.set(transport.id, transport);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
      transportMap.delete(transport.id);
    }
  });

  return {
    transportId: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

export async function connectSendTransport(
  transportId: string,
  dtlsParameters: mediasoupTypes.DtlsParameters
): Promise<void> {
  const transport = transportMap.get(transportId);
  if (!transport) throw new Error(`Transport not found`);
  await transport.connect({ dtlsParameters });
}

export async function createProducer(
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: mediasoupTypes.RtpParameters
): Promise<mediasoupTypes.Producer> {
  const transport = transportMap.get(transportId);
  if (!transport) throw new Error(`Transport not found`);
  return await transport.produce({ kind, rtpParameters });
}
```

### 3. Update the WebSocket Signaling Server
**File**: `apps/media-server/src/signaling/ws-server.ts`

Add handler logic to answer the socket connections for dynamic WebRTC creation. Note that we generate `laptop_${client.clientId}` instead of fetching a database camera.

```typescript
// Inside handleProduce, we tie the new producer to the room
async function handleProduce(client: ClientState, msg: WSMessage): Promise<void> {
  const { transportId, kind, rtpParameters } = msg.payload as any;

  // Dynamically pseudo-id the laptop
  const cameraId = `laptop_${client.clientId}`;
  const producer = await createProducer(transportId, kind, rtpParameters);

  producerMap.set(cameraId, {
    producer,
    workerId: client.workerIndex || 0,
    transportId,
    transport: transportMap.get(transportId) as any,
    consumerCount: 0,
  });

  client.ws.send(createMessage('PRODUCED', { id: producer.id }, msg.id));

  // Flood the sector so viewers can instantly grab the feed
  for (const floorKey of client.subscribedFloors) {
    const parts = floorKey.split(':');
    if (parts.length === 3) {
      broadcastToFloor(parts[1], parseInt(parts[2], 10), createMessage('PRODUCER_ADDED', {
        producerId: producer.id,
        cameraId,
        cameraLabel: 'Laptop Camera',
        hostelId: parts[1],
        floorNumber: parseInt(parts[2], 10),
      }));
    }
  }
}
```

### 4. Create the WebRTC Producer Hook
**File**: `apps/web/hooks/useWebcamProducer.ts`

Create this new file to handle all browser-side Mediasoup handshake operations. **Notice `video: true, audio: false` enforces video-streaming only.**

```typescript
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Device } from 'mediasoup-client';
import { useSignaling } from './useSignaling';

export function useWebcamProducer() {
  const { request, connected } = useSignaling();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Storage Refs
  const deviceRef = useRef<Device | null>(null);
  const transportRef = useRef<any>(null);
  const producerRef = useRef<any>(null);

  const stopWebcam = useCallback(() => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (producerRef.current) producerRef.current.close();
    if (transportRef.current) transportRef.current.close();
    setStream(null); setIsPublishing(false);
  }, [stream]);

  const startWebcam = useCallback(async () => {
    if (!connected) return;
    try {
      // strictly video streaming
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(localStream);
      const videoTrack = localStream.getVideoTracks()[0];
      setIsPublishing(true);

      const { rtpCapabilities } = await request('GET_ROUTER_RTP_CAPABILITIES', {});
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities as any });
      
      const transportParams = await request('CREATE_SEND_TRANSPORT', {});
      const transport = device.createSendTransport(transportParams as any);
      transportRef.current = transport;

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await request('CONNECT_SEND_TRANSPORT', { transportId: transport.id, dtlsParameters });
          callback();
        } catch (err) { errback(err); }
      });

      transport.on('produce', async (parameters, callback, errback) => {
        try {
          const { kind, rtpParameters } = parameters;
          const { id } = await request('PRODUCE', { transportId: transport.id, kind, rtpParameters }) as any;
          callback({ id });
        } catch (err) { errback(err); }
      });

      const producer = await transport.produce({ track: videoTrack });
      producerRef.current = producer;
    } catch (err) {
      console.error(err);
      stopWebcam();
    }
  }, [connected, request, stopWebcam]);

  return { stream, isPublishing, startWebcam, stopWebcam };
}
```

### 5. UI Integration
**File**: `apps/web/app/dashboard/page.tsx`

Add a component into the dashboard so the user can physically broadcast the stream. Attach the `stream` to an internal `<video>` tag so they can see themselves.

```tsx
import { useWebcamProducer } from '@/hooks/useWebcamProducer';

function WebcamBroadcaster() {
  const { stream, isPublishing, startWebcam, stopWebcam } = useWebcamProducer();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="border border-white/20 p-5 bg-black">
      <span className="text-white font-bold mb-4 block">Broadcast Node</span>
      {isPublishing ? (
        <div className="flex flex-col gap-3">
          <div className="aspect-video bg-white/5 relative">
             <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
             <div className="absolute top-2 right-2 flex gap-2 text-red-500 font-bold bg-black/80 px-2 animate-pulse">
               REC
             </div>
          </div>
          <Button onClick={stopWebcam} variant="danger">Stop Broadcasting</Button>
        </div>
      ) : (
        <Button onClick={startWebcam} variant="primary">Initialize Webcam</Button>
      )}
    </div>
  );
}
```

---

## Part 2: How to Run and Test Across Multiple Laptops

To test the WebRTC streaming, you will need **all laptops to be connected to the exact same WiFi network**.

### Laptop 1: The Central Server
This is the machine containing your codebase where you just wrote the code above.

1. Open your terminal on Laptop 1.
2. Find your local IPv4 Address:
   - Multi-platform trick: Look in your network settings, it usually looks like `192.168.x.x` or `10.x.x.x`.
3. Inform the `media-server` of your IP address so Mediasoup knows where to negotiate WebRTC from:
   - For Linux/Mac: `export ANNOUNCED_IP=192.168.YOUR.IP`
   - For Windows (PowerShell): `$env:ANNOUNCED_IP="192.168.YOUR.IP"`
4. Start your development server:
   - Run `pnpm dev` or `npm run dev`.

### Laptop 2: The Broadcaster (Sender)
This laptop will activate its webcam and push the feed to Laptop 1.

1. Ensure Laptop 2 is on the same WiFi network as Laptop 1.
2. Open a web browser (Chrome/Edge ideally).
3. Navigate to `http://192.168.YOUR.IP:3000` (Replace with Laptop 1's actual IP).
4. Login and navigate to the **Dashboard**.
5. Locate the **"Broadcast Node"** module we added in step 5.
6. Click **"Initialize Webcam"**.
7. The browser will ask for Camera Permissions. Click **Allow**.
   - Note: *If it blocks camera access over `http`, you may need to go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `192.168.YOUR.IP:3000`, enable it, and relaunch Chrome.*
8. The video feed will appear and begin flashing **REC**. Laptop 2 is now actively broadcasting WebRTC packets to Laptop 1.

### Laptop 3: The Viewer (Receiver)
This laptop will act as the security guard viewing active streams.
*(Note: You can test this on Laptop 1 by simply opening another tab if you lack a third laptop).*

1. Open a web browser on Laptop 3.
2. Navigate to `http://192.168.YOUR.IP:3000`.
3. Login and navigate to a **Hostel / Floor** matching the one the Broadcaster is currently occupying. 
4. The Central Server will broadcast a `PRODUCER_ADDED` event. The React interface will execute `useSFU.ts` and fetch the available streams.
5. You will see Laptop 2's webcam feed playing live in Laptop 3's browser.
