/**
 * WebSocket transport adapter for the relay server.
 * Handles connection, reconnection with jittered exponential backoff,
 * authentication, and message routing.
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface RelayMessage {
  type: string;
  [key: string]: unknown;
}

export interface TransportEvents {
  onStateChange: (state: ConnectionState) => void;
  onMessage: (msg: RelayMessage) => void;
  onPeerCountChange: (count: number) => void;
  onQueueDrained: (count: number) => void;
  onError: (error: string) => void;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_FACTOR = 0.3;

export class RelayTransport {
  private ws: WebSocket | null = null;
  private nodeId: string;
  private relayUrl: string;
  private events: TransportEvents;
  private state: ConnectionState = 'disconnected';
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  constructor(nodeId: string, relayUrl: string, events: TransportEvents) {
    this.nodeId = nodeId;
    this.relayUrl = relayUrl;
    this.events = events;
  }

  /** Connect to the relay server */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionalClose = false;
    this.setState(this.retryCount > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(this.relayUrl);

      this.ws.onopen = () => {
        this.retryCount = 0;
        this.setState('connected');

        // Register with the relay
        this.send({
          type: 'register',
          nodeId: this.nodeId,
        });

        // Start keepalive ping
        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping' });
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as RelayMessage;

          if (msg.type === 'registered') {
            const queuedDelivered = (msg.queuedDelivered as number) ?? 0;
            const peerCount = (msg.peerCount as number) ?? 0;
            if (queuedDelivered > 0) {
              this.events.onQueueDrained(queuedDelivered);
            }
            this.events.onPeerCountChange(peerCount);
          } else if (msg.type === 'peers') {
            this.events.onPeerCountChange(msg.count as number);
            this.events.onMessage(msg);
          } else if (msg.type === 'error') {
            this.events.onError(msg.error as string);
          } else {
            this.events.onMessage(msg);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = (event) => {
        this.cleanup();

        if (!this.intentionalClose) {
          this.setState('reconnecting');
          this.scheduleReconnect();
        } else {
          this.setState('disconnected');
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };

    } catch {
      this.setState('reconnecting');
      this.scheduleReconnect();
    }
  }

  /** Disconnect from the relay server */
  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();
    this.ws?.close();
    this.ws = null;
    this.setState('disconnected');
    this.retryCount = 0;
  }

  /** Send a mesh packet through the relay */
  sendPacket(destNodeId: string, data: string, packetId?: string): void {
    this.send({
      type: 'packet',
      destNodeId,
      data,
      packetId: packetId ?? crypto.randomUUID(),
    });
  }

  /** Send a WebRTC signaling message */
  sendSignaling(to: string, sigType: 'offer' | 'answer' | 'ice-candidate', payload: unknown): void {
    this.send({
      type: 'signaling',
      signaling: {
        type: sigType,
        from: this.nodeId,
        to,
        payload,
      },
    });
  }

  /** Request connected peer list */
  requestPeers(): void {
    this.send({ type: 'peers' });
  }

  /** Get current connection state */
  getState(): ConnectionState {
    return this.state;
  }

  private send(msg: RelayMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.events.onStateChange(state);
    }
  }

  private scheduleReconnect(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);

    // Exponential backoff with jitter
    const baseDelay = Math.min(BASE_DELAY_MS * Math.pow(2, this.retryCount), MAX_DELAY_MS);
    const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1); // ±30%
    const delay = Math.max(0, baseDelay + jitter);

    this.retryTimer = setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
