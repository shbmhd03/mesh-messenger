/**
 * useRelay: React hook for managing the live relay WebSocket connection.
 * Pipes incoming traffic directly into the Zustand state.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMeshStore } from '../store/meshStore';
import { RelayTransport, type ConnectionState, type RelayMessage } from '../lib/transport';

// Helper: Safe UTF-8 to Base64 (supports all emojis and multi-byte characters)
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Safe Base64 to UTF-8 (supports all emojis and multi-byte characters)
function base64ToUtf8(base64: string): string {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return atob(base64);
  }
}

export function useRelay() {
  const { ownNodeId, relayConnected, addLiveMessage, updateLivePeers, ownDisplayName, stealthMode } = useMeshStore();
  const transportRef = useRef<RelayTransport | null>(null);

  const relayUrl = (import.meta as any).env.DEV
    ? 'ws://localhost:4800/mesh'
    : 'wss://mesh-messenger.onrender.com/mesh';

  useEffect(() => {
    if (relayConnected && transportRef.current) {
      transportRef.current.rename(ownDisplayName);
    }
  }, [ownDisplayName, relayConnected]);

  useEffect(() => {
    if (relayConnected && transportRef.current) {
      transportRef.current.setStealth(stealthMode);
    }
  }, [stealthMode, relayConnected]);

  useEffect(() => {
    const transport = new RelayTransport(
      ownNodeId,
      relayUrl,
      {
        onStateChange: (state: ConnectionState) => {
          useMeshStore.setState({ relayConnected: state === 'connected' });
          if (state === 'connected') {
            transport.rename(useMeshStore.getState().ownDisplayName);
            transport.setStealth(useMeshStore.getState().stealthMode);
          }
        },
      onMessage: (msg: RelayMessage) => {
        if (msg.type === 'packet') {
          const fromNodeId = msg.fromNodeId as string;
          const base64Data = msg.data as string;
          
          try {
            // Decrypt base64 packet payload with UTF-8 support
            const text = base64ToUtf8(base64Data);
            try {
              const payload = JSON.parse(text);
              if (payload && typeof payload === 'object') {
                if (payload.type === 'msg') {
                  addLiveMessage(fromNodeId, payload.text, false, payload.id, payload.senderName);
                } else if (payload.type === 'ack') {
                  // Update outgoing message delivery status (single tick -> double tick!)
                  const updateMessageStatus = useMeshStore.getState().updateMessageStatus;
                  updateMessageStatus(fromNodeId, payload.id, payload.status);
                } else if (payload.type === 'chat_request') {
                  // Handle incoming authorization invite from stealth node
                  useMeshStore.getState().handleIncomingChatRequest(fromNodeId, payload.senderName);
                } else if (payload.type === 'chat_accept') {
                  // Handle incoming acceptance response from stealth node
                  useMeshStore.getState().handleIncomingChatAccept(fromNodeId);
                } else if (payload.type === 'group_msg' || payload.type === 'group_invite' || payload.type === 'group_update') {
                  // Handle incoming group chat packets
                  useMeshStore.getState().handleIncomingGroupPacket(fromNodeId, payload);
                } else if (payload.type === 'delete_msg') {
                  // Handle incoming message deletion packet
                  useMeshStore.getState().handleIncomingDeletePacket(fromNodeId, payload.conversationId, payload.messageId);
                } else if (payload.type.startsWith('call_')) {
                  // Handle incoming WebRTC P2P Voice and Video Call packets
                  useMeshStore.getState().handleCallPacket(fromNodeId, payload);
                }
                return;
              }
            } catch (jsonErr) {
              // Not structured JSON: treat as plain text legacy packet
            }
            addLiveMessage(fromNodeId, text, false);
          } catch (e) {
            console.error('[relay] failed to decode packet:', e);
          }
        } else if (msg.type === 'peers') {
          const peerList = (msg.peers as { id: string; name: string }[]) || [];
          updateLivePeers(peerList);
        } else if (msg.type === 'stored') {
          // Server confirmed store-and-forward queueing in Convex (single checkmark!)
          const destNodeId = msg.destNodeId as string;
          const msgId = (msg.messageId || msg.id) as string | undefined;
          const conversations = useMeshStore.getState().conversations;
          const conv = conversations.find(c => c.id === destNodeId);

          const targetMsg = msgId
            ? conv?.messages.find(m => m.id === msgId)
            : conv?.messages.find(m => m.sent && (m.status === 'pending' || m.status === 'sent'));

          if (targetMsg) {
            useMeshStore.setState({
              conversations: conversations.map(c => c.id === destNodeId ? {
                ...c,
                messages: c.messages.map(m => m.id === targetMsg.id ? { ...m, status: 'sent' } : m)
              } : c)
            });
          }
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
        // Encode packet payload to base64 with UTF-8 support for emojis
        const base64Data = utf8ToBase64(text);
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
