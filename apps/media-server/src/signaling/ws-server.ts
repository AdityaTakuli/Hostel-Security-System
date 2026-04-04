// ============================================
// WebSocket Signaling Server
// ============================================
// Handles the complete mediasoup SFU signaling flow:
// 1. Client connects → gets clientId
// 2. Client requests router capabilities → loads Device
// 3. Client creates recv transport → negotiates DTLS
// 4. Client joins floor → receives PRODUCER_ADDED for active streams
// 5. Client consumes producers → receives video tracks
// 6. On disconnect → cleanup resources
// ============================================

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { WSMessage, WSMessageType, AlertPayload } from '@hostel-monitor/types';
import { db } from '@hostel-monitor/db';
import { getDefaultRouter } from '../mediasoup/workers';
import {
  createRecvTransport,
  connectRecvTransport,
  consumeProducer,
  resumeConsumer,
  closeTransport,
  cleanupClientConsumers,
  createSendTransport,
  connectSendTransport,
  createProducer,
  transportMap,
} from '../mediasoup/transport';
import {
  producerMap,
  startCameraIngest,
  incrementConsumerCount,
  decrementConsumerCount,
  getProducerWorkerId,
} from '../mediasoup/ingest';

// ── Client State ────────────────────────────

interface ClientState {
  ws: WebSocket;
  clientId: string;
  transportId?: string;
  sendTransportId?: string;
  workerIndex?: number;
  subscribedFloors: Set<string>; // "floor:{hostelId}:{floorNumber}"
  subscribedHostels: Set<string>;
  consumerIds: Set<string>;
}

const clientMap = new Map<string, ClientState>();

// ── Camera Assignment State ─────────────────
interface CameraAssignment {
  id: string;
  hostelId: string;
  floorNumber: number;
  label: string;
}

let cameraAssignmentQueue: CameraAssignment[] = [];
let nextCameraSlot = 0;
let isQueueLoaded = false;
const laptopToCameraAssignment = new Map<string, CameraAssignment & { cameraId: string }>();

async function ensureCameraQueueLoaded() {
  if (isQueueLoaded) return;
  await db.connectDB();
  const hostels = await db.Hostel.find({}).sort({ _id: 1 });
  for (const hostel of hostels) {
    const floors = await db.Floor.find({ hostelId: hostel._id }).sort({ number: 1 });
    for (const floor of floors) {
      const cameras = await db.Camera.find({ floorId: floor._id }).sort({ label: 1 });
      for (const camera of cameras) {
        cameraAssignmentQueue.push({
          id: camera.id,
          hostelId: (hostel._id as any).toString(),
          floorNumber: floor.number,
          label: camera.label
        });
      }
    }
  }
  console.info(`[ws] Loaded ${cameraAssignmentQueue.length} system cameras for stream assignment`);
  isQueueLoaded = true;
}

// ── Helpers ─────────────────────────────────

function createMessage<T>(type: WSMessageType, payload: T, id?: string): string {
  const msg: WSMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
    ...(id && { id }),
  };
  return JSON.stringify(msg);
}

function parseMessage(data: string): WSMessage | null {
  try {
    return JSON.parse(data) as WSMessage;
  } catch {
    return null;
  }
}

function floorKey(hostelId: string, floorNumber: number): string {
  return `floor:${hostelId}:${floorNumber}`;
}

// ── Room Broadcast ──────────────────────────

export function broadcastToFloor(hostelId: string, floorNumber: number, message: string): void {
  const key = floorKey(hostelId, floorNumber);
  for (const [, client] of clientMap) {
    if (client.subscribedFloors.has(key) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastToHostel(hostelId: string, message: string): void {
  for (const [, client] of clientMap) {
    if (client.subscribedHostels.has(hostelId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastToAll(message: string): void {
  for (const [, client] of clientMap) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

// ── Message Handlers ────────────────────────

async function handleJoinFloor(client: ClientState, msg: WSMessage): Promise<void> {
  const { hostelId, floorNumber } = msg.payload as { hostelId: string; floorNumber: number };
  const key = floorKey(hostelId, floorNumber);

  client.subscribedFloors.add(key);
  client.subscribedHostels.add(hostelId);

  console.info(`[ws] Client ${client.clientId} joined ${key}`);

  // Artificial global pool for dashboard broadcasts, skip DB lookup
  if (hostelId === 'global') {
    for (const [cameraId, entry] of producerMap.entries()) {
      if (cameraId.startsWith('laptop_')) {
        client.ws.send(
          createMessage('PRODUCER_ADDED', {
            producerId: entry.producer.id,
            cameraId,
            cameraLabel: 'Laptop Camera',
            hostelId: 'global',
            floorNumber: 0,
          })
        );
      }
    }
    return;
  }

  // Look up cameras on this floor
  await db.connectDB();
  const floor = await db.Floor.findOne({ hostelId, number: floorNumber }).populate('cameras');

  if (!floor) {
    client.ws.send(createMessage('ERROR', { message: `Floor ${hostelId}:${floorNumber} not found` }, msg.id));
    return;
  }

  // For each camera, notify of active producers and start inactive ones
  for (const camera of floor.cameras || []) {
    const existing = producerMap.get(camera.id);

    if (existing) {
      // Producer already active — notify client
      client.ws.send(
        createMessage('PRODUCER_ADDED', {
          producerId: existing.producer.id,
          cameraId: camera.id,
          cameraLabel: camera.label,
          hostelId,
          floorNumber,
        })
      );
    } else {
      // Start on-demand ingest
      const entry = await startCameraIngest({
        id: camera.id,
        label: camera.label,
        rtspUrl: camera.rtspUrl,
        floorId: camera.floorId,
      });

      if (entry) {
        // Broadcast PRODUCER_ADDED to all clients on this floor
        broadcastToFloor(
          hostelId,
          floorNumber,
          createMessage('PRODUCER_ADDED', {
            producerId: entry.producer.id,
            cameraId: camera.id,
            cameraLabel: camera.label,
            hostelId,
            floorNumber,
          })
        );
      }
    }
  }
}

async function handleLeaveFloor(client: ClientState, msg: WSMessage): Promise<void> {
  const { hostelId, floorNumber } = msg.payload as { hostelId: string; floorNumber: number };
  const key = floorKey(hostelId, floorNumber);
  client.subscribedFloors.delete(key);
  console.info(`[ws] Client ${client.clientId} left ${key}`);

  // Decrement consumer counts for cameras on this floor
  // The auto-stop timer will handle cleanup
}

async function handleGetRouterCapabilities(client: ClientState, msg: WSMessage): Promise<void> {
  const router = getDefaultRouter();
  client.ws.send(
    createMessage(
      'ROUTER_RTP_CAPABILITIES',
      { rtpCapabilities: router.rtpCapabilities },
      msg.id
    )
  );
}

async function handleCreateRecvTransport(client: ClientState, msg: WSMessage): Promise<void> {
  // Use worker 0 by default for viewers
  const workerIndex = 0;
  client.workerIndex = workerIndex;

  const params = await createRecvTransport(client.clientId, workerIndex);
  client.transportId = params.id;

  client.ws.send(createMessage('RECV_TRANSPORT_CREATED', params, msg.id));
}

async function handleConnectRecvTransport(client: ClientState, msg: WSMessage): Promise<void> {
  const { transportId, dtlsParameters } = msg.payload as {
    transportId: string;
    dtlsParameters: any;
  };

  await connectRecvTransport(transportId, dtlsParameters);
  client.ws.send(createMessage('RECV_TRANSPORT_CONNECTED', { transportId }, msg.id));
}

async function handleConsume(client: ClientState, msg: WSMessage): Promise<void> {
  const { producerId, transportId, rtpCapabilities } = msg.payload as {
    producerId: string;
    transportId: string;
    rtpCapabilities: any;
  };

  // Find cameraId for this producer
  let cameraId = '';
  for (const [camId, entry] of producerMap.entries()) {
    if (entry.producer.id === producerId) {
      cameraId = camId;
      break;
    }
  }

  const workerIndex = getProducerWorkerId(cameraId) ?? client.workerIndex ?? 0;

  const result = await consumeProducer(
    transportId,
    producerId,
    rtpCapabilities,
    cameraId,
    workerIndex
  );

  client.consumerIds.add(result.consumerId);
  incrementConsumerCount(cameraId);

  client.ws.send(
    createMessage('CONSUMED', { ...result, cameraId }, msg.id)
  );
}

async function handleResumeConsumer(client: ClientState, msg: WSMessage): Promise<void> {
  const { consumerId } = msg.payload as { consumerId: string };
  await resumeConsumer(consumerId);
}

async function handleCreateSendTransport(client: ClientState, msg: WSMessage): Promise<void> {
  const workerIndex = 0;
  client.workerIndex = workerIndex;

  const params = await createSendTransport(client.clientId, workerIndex);
  client.sendTransportId = params.id;

  client.ws.send(createMessage('SEND_TRANSPORT_CREATED', params, msg.id));
}

async function handleConnectSendTransport(client: ClientState, msg: WSMessage): Promise<void> {
  const { transportId, dtlsParameters } = msg.payload as {
    transportId: string;
    dtlsParameters: any;
  };

  await connectSendTransport(transportId, dtlsParameters);
  client.ws.send(createMessage('SEND_TRANSPORT_CONNECTED', { transportId }, msg.id));
}

async function handleProduce(client: ClientState, msg: WSMessage): Promise<void> {
  const { transportId, kind, rtpParameters } = msg.payload as {
    transportId: string;
    kind: 'audio' | 'video';
    rtpParameters: any;
  };

  const laptopCameraId = `laptop_${client.clientId}`;
  const producer = await createProducer(transportId, kind, rtpParameters);

  producerMap.set(laptopCameraId, {
    producer,
    workerId: client.workerIndex || 0,
    transportId,
    transport: transportMap.get(transportId) as any,
    consumerCount: 0,
  });

  client.ws.send(createMessage('PRODUCED', { id: producer.id }, msg.id));

  // Artificially broadcast to global pool so dashboard viewers can see the streams
  broadcastToFloor(
    'global',
    0,
    createMessage('PRODUCER_ADDED', {
      producerId: producer.id,
      cameraId: laptopCameraId,
      cameraLabel: 'Laptop Camera',
      hostelId: 'global',
      floorNumber: 0,
    })
  );

  // Broadcast to all subscribed floors
  for (const floorKey of client.subscribedFloors) {
    const parts = floorKey.split(':');
    if (parts.length === 3) {
      const hostelId = parts[1];
      const floorNumber = parseInt(parts[2], 10);
      broadcastToFloor(
        hostelId,
        floorNumber,
        createMessage('PRODUCER_ADDED', {
          producerId: producer.id,
          cameraId: laptopCameraId,
          cameraLabel: 'Laptop Camera',
          hostelId,
          floorNumber,
        })
      );
    }
  }

  // Assign this laptop stream to a physical camera in the database dynamically
  await ensureCameraQueueLoaded();
  if (cameraAssignmentQueue.length > 0) {
    const assignedCam = cameraAssignmentQueue[nextCameraSlot % cameraAssignmentQueue.length];
    nextCameraSlot++;

    laptopToCameraAssignment.set(client.clientId, {
        ...assignedCam,
        cameraId: assignedCam.id
    });
    
    // Register the producer again under the physical camera's ID
    producerMap.set(assignedCam.id, {
      producer,
      workerId: client.workerIndex || 0,
      transportId,
      transport: transportMap.get(transportId) as any,
      consumerCount: 0,
    });

    console.info(`[ws] Mapped ${laptopCameraId} to physical camera ${assignedCam.label} (${assignedCam.id}) on Floor ${assignedCam.floorNumber}`);

    // Broadcast the physical camera PRODUCER_ADDED to its floor globally using the exact same connection
    broadcastToFloor(
      assignedCam.hostelId,
      assignedCam.floorNumber,
      createMessage('PRODUCER_ADDED', {
        producerId: producer.id,
        cameraId: assignedCam.id,
        cameraLabel: assignedCam.label,
        hostelId: assignedCam.hostelId,
        floorNumber: assignedCam.floorNumber
      })
    );
  }
}

// ── Disconnect Cleanup ──────────────────────

function handleDisconnect(client: ClientState): void {
  console.info(`[ws] Client ${client.clientId} disconnected`);

  // Close transport
  if (client.transportId) {
    closeTransport(client.transportId);
  }

  // Close send transport
  if (client.sendTransportId) {
    closeTransport(client.sendTransportId);

    const laptopCameraId = `laptop_${client.clientId}`;
    if (producerMap.has(laptopCameraId)) {
      const entry = producerMap.get(laptopCameraId);
      if (entry) {
        try {
          entry.producer.close();
        } catch (e) {
          console.error(`[ws] Error closing producer for laptop ${laptopCameraId}:`, e);
        }
      }
      producerMap.delete(laptopCameraId);
    }

    // Cleanup mapped physical camera
    const assignment = laptopToCameraAssignment.get(client.clientId);
    if (assignment) {
        if (producerMap.has(assignment.cameraId)) {
           producerMap.delete(assignment.cameraId);
        }
        laptopToCameraAssignment.delete(client.clientId);
        
        console.info(`[ws] Cleaned up physical camera mapping for ${laptopCameraId} -> ${assignment.cameraId}`);
        
        // Notify floor clients that the producer is removed
        broadcastToFloor(
            assignment.hostelId,
            assignment.floorNumber,
            createMessage('PRODUCER_REMOVED', {
                producerId: '',
                cameraId: assignment.cameraId
            })
        );
    }
  }

  // Clean up consumers and decrement camera counts
  if (client.consumerIds.size > 0) {
    const decrements = cleanupClientConsumers(Array.from(client.consumerIds));
    for (const [cameraId, count] of decrements) {
      for (let i = 0; i < count; i++) {
        decrementConsumerCount(cameraId);
      }
    }
  }

  clientMap.delete(client.clientId);
}

// ── WebSocket Server ────────────────────────

export function createSignalingServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  console.info(`[ws] Signaling server listening on port ${port}`);

  wss.on('connection', (ws: WebSocket) => {
    const clientId = uuidv4();
    const client: ClientState = {
      ws,
      clientId,
      subscribedFloors: new Set(),
      subscribedHostels: new Set(),
      consumerIds: new Set(),
    };
    clientMap.set(clientId, client);

    console.info(`[ws] Client ${clientId} connected (total: ${clientMap.size})`);

    ws.on('message', async (raw: Buffer) => {
      const msg = parseMessage(raw.toString());
      if (!msg) {
        ws.send(createMessage('ERROR', { message: 'Invalid JSON' }));
        return;
      }

      try {
        switch (msg.type) {
          case 'JOIN_FLOOR':
            await handleJoinFloor(client, msg);
            break;
          case 'LEAVE_FLOOR':
            await handleLeaveFloor(client, msg);
            break;
          case 'GET_ROUTER_RTP_CAPABILITIES':
            await handleGetRouterCapabilities(client, msg);
            break;
          case 'CREATE_RECV_TRANSPORT':
            await handleCreateRecvTransport(client, msg);
            break;
          case 'CONNECT_RECV_TRANSPORT':
            await handleConnectRecvTransport(client, msg);
            break;
          case 'CONSUME':
            await handleConsume(client, msg);
            break;
          case 'RESUME_CONSUMER':
            await handleResumeConsumer(client, msg);
            break;
          case 'CREATE_SEND_TRANSPORT':
            await handleCreateSendTransport(client, msg);
            break;
          case 'CONNECT_SEND_TRANSPORT':
            await handleConnectSendTransport(client, msg);
            break;
          case 'PRODUCE':
            await handleProduce(client, msg);
            break;
          case 'PING':
            ws.send(createMessage('PONG', {}, msg.id));
            break;

          // ── Intrusion Detection Events ────────────────
          case 'BUZZER_CONTROL':
            // Broadcast alarm to all connected dashboard clients
            console.info(`[ws] BUZZER_CONTROL: camera=${msg.payload.cameraId} action=${msg.payload.action}`);
            broadcastToAll(createMessage('BUZZER_CONTROL', msg.payload));
            break;

          case 'SURVEILLANCE_TOGGLE':
            // Broadcast surveillance toggle to all (including ML bridge)
            console.info(`[ws] SURVEILLANCE_TOGGLE: camera=${msg.payload.cameraId} active=${msg.payload.active}`);
            broadcastToAll(createMessage('SURVEILLANCE_TOGGLE', msg.payload));
            break;

          case 'HEATMAP_UPDATE':
            // Broadcast heatmap update to all dashboard clients
            broadcastToAll(createMessage('HEATMAP_UPDATE', msg.payload));
            break;

          case 'WALKTHROUGH_STATUS':
            // Log and broadcast walkthrough check status
            console.info(`[ws] WALKTHROUGH_STATUS: camera=${msg.payload.cameraId} checked`);
            broadcastToAll(createMessage('WALKTHROUGH_STATUS', msg.payload));
            break;

          case 'DETECTION_OVERLAY':
            // Relay live detection bounding boxes to dashboard clients
            broadcastToAll(createMessage('DETECTION_OVERLAY', msg.payload));
            break;

          case 'ZONE_INTRUSION':
            // Relay zone intrusion alerts
            console.info(`[ws] ZONE_INTRUSION: camera=${msg.payload.cameraId} zone=${msg.payload.zone}`);
            broadcastToAll(createMessage('ZONE_INTRUSION', msg.payload));
            break;

          case 'ML_ALERT':
            // Relay ML detection alert to all dashboard clients
            console.info(`[ws] ML_ALERT: camera=${msg.payload.cameraId} type=${msg.payload.type}`);
            broadcastToAll(createMessage('ML_ALERT', msg.payload));
            break;

          default:
            ws.send(createMessage('ERROR', { message: `Unknown message type: ${msg.type}` }, msg.id));
        }
      } catch (error: any) {
        console.error(`[ws] Error handling ${msg.type}:`, error);
        ws.send(createMessage('ERROR', { message: error.message || 'Internal error' }, msg.id));
      }
    });

    ws.on('close', () => handleDisconnect(client));
    ws.on('error', (error) => {
      console.error(`[ws] Client ${clientId} error:`, error);
      handleDisconnect(client);
    });
  });

  return wss;
}
