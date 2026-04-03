// ============================================
// WebRTC Transport Management for Viewers
// ============================================
// Manages WebRtcTransport creation for browser clients.
// Each client gets a single receiving transport to consume
// multiple camera streams efficiently via the SFU.
// ============================================

import type { types as mediasoupTypes } from 'mediasoup';
import { getRouter } from './workers';

/** Map of transport ID → WebRtcTransport */
export const transportMap = new Map<string, mediasoupTypes.WebRtcTransport>();

/** Map of consumer ID → Consumer */
export const consumerMap = new Map<string, mediasoupTypes.Consumer>();

/** Map of consumer ID → cameraId (for cleanup tracking) */
export const consumerCameraMap = new Map<string, string>();

/**
 * Create a WebRtcTransport for a viewer client.
 * Each client gets ONE transport and consumes all camera streams through it.
 */
export async function createRecvTransport(
  clientId: string,
  workerIndex: number
): Promise<{
  id: string;
  iceParameters: mediasoupTypes.IceParameters;
  iceCandidates: mediasoupTypes.IceCandidate[];
  dtlsParameters: mediasoupTypes.DtlsParameters;
}> {
  const router = getRouter(workerIndex);
  const announcedIp = process.env.ANNOUNCED_IP || '127.0.0.1';

  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transportMap.set(transport.id, transport);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      console.info(`[transport] Client ${clientId} transport closed`);
      transport.close();
      transportMap.delete(transport.id);
    }
  });

  console.info(`[transport] Created recv transport ${transport.id} for client ${clientId}`);

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

/**
 * Connect a client's transport with DTLS parameters.
 */
export async function connectRecvTransport(
  transportId: string,
  dtlsParameters: mediasoupTypes.DtlsParameters
): Promise<void> {
  const transport = transportMap.get(transportId);
  if (!transport) {
    throw new Error(`Transport ${transportId} not found`);
  }

  await transport.connect({ dtlsParameters });
  console.info(`[transport] Connected transport ${transportId}`);
}

/**
 * Consume a producer — creates a Consumer on the client's transport.
 * Returns paused consumer params. Client must send RESUME_CONSUMER after setup.
 */
export async function consumeProducer(
  transportId: string,
  producerId: string,
  rtpCapabilities: mediasoupTypes.RtpCapabilities,
  cameraId: string,
  workerIndex: number
): Promise<{
  consumerId: string;
  producerId: string;
  kind: 'video';
  rtpParameters: mediasoupTypes.RtpParameters;
}> {
  const transport = transportMap.get(transportId);
  if (!transport) {
    throw new Error(`Transport ${transportId} not found`);
  }

  const router = getRouter(workerIndex);

  // Verify the router can provide this producer to this consumer
  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error(`Router cannot consume producer ${producerId} with given RTP capabilities`);
  }

  // Create consumer in paused state
  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true, // Client must send RESUME_CONSUMER after setting up the track
  });

  consumerMap.set(consumer.id, consumer);
  consumerCameraMap.set(consumer.id, cameraId);

  consumer.on('transportclose', () => {
    consumerMap.delete(consumer.id);
    consumerCameraMap.delete(consumer.id);
  });

  consumer.on('producerclose', () => {
    consumerMap.delete(consumer.id);
    consumerCameraMap.delete(consumer.id);
  });

  console.info(`[transport] Consumer ${consumer.id} created for producer ${producerId} (camera ${cameraId})`);

  return {
    consumerId: consumer.id,
    producerId,
    kind: 'video',
    rtpParameters: consumer.rtpParameters,
  };
}

/**
 * Resume a paused consumer.
 */
export async function resumeConsumer(consumerId: string): Promise<void> {
  const consumer = consumerMap.get(consumerId);
  if (!consumer) {
    throw new Error(`Consumer ${consumerId} not found`);
  }
  await consumer.resume();
  console.info(`[transport] Resumed consumer ${consumerId}`);
}

/**
 * Close a specific transport and all its consumers.
 */
export function closeTransport(transportId: string): void {
  const transport = transportMap.get(transportId);
  if (transport) {
    transport.close();
    transportMap.delete(transportId);
  }
}

/**
 * Get all consumer IDs associated with a transport.
 */
export function getConsumersForTransport(transportId: string): string[] {
  const consumerIds: string[] = [];
  for (const [id, consumer] of consumerMap.entries()) {
    if (!consumer.closed) {
      consumerIds.push(id);
    }
  }
  return consumerIds;
}

/**
 * Clean up all consumers for a client.
 */
export function cleanupClientConsumers(consumerIds: string[]): Map<string, number> {
  const cameraDecrements = new Map<string, number>();

  for (const consumerId of consumerIds) {
    const cameraId = consumerCameraMap.get(consumerId);
    if (cameraId) {
      cameraDecrements.set(cameraId, (cameraDecrements.get(cameraId) || 0) + 1);
    }

    const consumer = consumerMap.get(consumerId);
    if (consumer && !consumer.closed) {
      consumer.close();
    }
    consumerMap.delete(consumerId);
    consumerCameraMap.delete(consumerId);
  }

  return cameraDecrements;
}

// ============================================
// Broadcaster Methods
// ============================================

/**
 * Create a Send WebRtcTransport for a broadcaster client.
 */
export async function createSendTransport(
  clientId: string,
  workerIndex: number
): Promise<{
  id: string;
  iceParameters: mediasoupTypes.IceParameters;
  iceCandidates: mediasoupTypes.IceCandidate[];
  dtlsParameters: mediasoupTypes.DtlsParameters;
}> {
  const router = getRouter(workerIndex);
  const announcedIp = process.env.ANNOUNCED_IP || '127.0.0.1';

  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transportMap.set(transport.id, transport);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      console.info(`[transport] Broadcaster ${clientId} transport closed`);
      transport.close();
      transportMap.delete(transport.id);
    }
  });

  console.info(`[transport] Created send transport ${transport.id} for broadcaster ${clientId}`);

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

/**
 * Connect a broadcaster's send transport with DTLS parameters.
 */
export async function connectSendTransport(
  transportId: string,
  dtlsParameters: mediasoupTypes.DtlsParameters
): Promise<void> {
  const transport = transportMap.get(transportId);
  if (!transport) {
    throw new Error(`Transport ${transportId} not found`);
  }

  await transport.connect({ dtlsParameters });
  console.info(`[transport] Connected send transport ${transportId}`);
}

/**
 * Handle a producer creating media.
 */
export async function createProducer(
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: mediasoupTypes.RtpParameters
): Promise<mediasoupTypes.Producer> {
  const transport = transportMap.get(transportId);
  if (!transport) {
    throw new Error(`Transport ${transportId} not found`);
  }

  const producer = await transport.produce({ kind, rtpParameters });

  console.info(`[transport] Created producer ${producer.id} for transport ${transportId}`);

  return producer;
}
