/**
 * @mesh/relay — WebRTC Signaling
 *
 * Relays SDP offers/answers and ICE candidates between peers
 * identified by NodeID. The relay never inspects payload content.
 */

import type { WebSocket } from 'ws';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;      // sender NodeID (hex)
  to: string;        // recipient NodeID (hex)
  payload: unknown;   // SDP or ICE candidate — opaque to relay
}

export class SignalingRelay {
  /**
   * Route a signaling message to the target peer.
   * Returns true if delivered, false if peer not connected.
   */
  route(
    message: SignalingMessage,
    connectedPeers: Map<string, WebSocket>,
  ): boolean {
    const targetSocket = connectedPeers.get(message.to);
    if (!targetSocket || targetSocket.readyState !== 1 /* OPEN */) {
      return false;
    }

    targetSocket.send(JSON.stringify({
      type: 'signaling',
      signaling: message,
    }));

    return true;
  }

  /**
   * Validate a signaling message structure.
   */
  validate(msg: unknown): msg is SignalingMessage {
    if (typeof msg !== 'object' || msg === null) return false;
    const m = msg as Record<string, unknown>;
    return (
      (m.type === 'offer' || m.type === 'answer' || m.type === 'ice-candidate') &&
      typeof m.from === 'string' &&
      typeof m.to === 'string' &&
      m.payload !== undefined
    );
  }
}
