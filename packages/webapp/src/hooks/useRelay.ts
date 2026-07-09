/**
 * useRelay — React hook for managing the live relay WebSocket connection.
 * Pipes incoming traffic directly into the Zustand state.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMeshStore } from '../store/meshStore';
import { RelayTransport, type ConnectionState, type RelayMessage } from '../lib/transport';

export function useRelay() {
  const { ownNodeId, relayConnected, addLiveMessage, updateLivePeers } = useMeshStore();
  const transportRef = useRef<RelayTransport | null>(null);

  const relayUrl = (import.meta as any).env.DEV
    ? 'ws://localhost:4800/mesh'
    : 'wss://mesh-messenger.onrender.com/mesh';

  useEffect(() => {
    const transport = new RelayTransport(ownNodeId, relayUrl, {
      onStateChange: (state: ConnectionState) => {
        useMeshStore.setState({ relayConnected: state === 'connected' });
      },
      onMessage: (msg: RelayMessage) => {
        if (msg.type === 'packet') {
          const fromNodeId = msg.fromNodeId as string;
          const base64Data = msg.data as string;
          
          try {
            // Decrypt base64 packet payload
            const text = atob(base64Data);
            addLiveMessage(fromNodeId, text, false);
          } catch (e) {
            console.error('[relay] failed to decode packet:', e);
          }
        } else if (msg.type === 'peers') {
          const peerList = (msg.peers as string[]) || [];
          updateLivePeers(peerList);
        }
      },
      onPeerCountChange: (count: number) => {
        // Query active peer NodeIDs list
        transportRef.current?.requestPeers();
      },
      onQueueDrained: (count: number) => {
        console.log('[relay] drained', count, 'queued messages');
      },
      onError: (error: string) => {
        console.warn('[relay] error:', error);
      },
    });

    transportRef.current = transport;

    // Auto-connect to relay
    transport.connect();

    return () => {
      transport.disconnect();
      transportRef.current = null;
    };
  }, [ownNodeId, addLiveMessage, updateLivePeers]);

  const sendPacket = useCallback((destNodeId: string, text: string) => {
    if (transportRef.current) {
      try {
        // Encode packet payload to base64
        const base64Data = btoa(text);
        transportRef.current.sendPacket(destNodeId, base64Data);
      } catch (e) {
        console.error('[relay] failed to encode packet:', e);
      }
    }
  }, []);

  return {
    relayConnected,
    sendPacket,
  };
}
