/**
 * Zustand store for Mesh Messenger (Live Production Edition).
 * Manages live contact maps, message lists, and dynamic peer layouts.
 */

import { create } from 'zustand';

export interface Contact {
  id: string;
  nodeId: string;
  name: string;
  initials: string;
  color: string;
  online: boolean;
  hopCount: number;
  transport: 'ble' | 'wifi' | 'relay' | 'webrtc';
  verified: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  sent: boolean;
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  transport?: 'ble' | 'wifi' | 'relay' | 'webrtc';
}

export interface Conversation {
  id: string;
  contact: Contact;
  messages: Message[];
  lastMessage: string;
  lastTime: number;
  unread: number;
}

export interface MeshNode {
  id: string;
  nodeId: string;
  displayId: string;
  hopCount: number;
  transport: 'ble' | 'wifi' | 'relay' | 'webrtc';
  batteryClass: 'mains' | 'high' | 'normal' | 'low' | 'ephemeral';
  relayCapable: boolean;
  x: number;
  y: number;
}

interface MeshState {
  ownNodeId: string;
  ownDisplayName: string; // added for profile names

  contacts: Contact[];
  conversations: Conversation[];
  activeConversationId: string | null;
  searchQuery: string;

  meshNodes: MeshNode[];
  relayConnected: boolean;
  meshPanelOpen: boolean;
  safetyNumberContactId: string | null;

  // Registered socket sender callback
  sendPacketHandler: ((destNodeId: string, text: string) => void) | null;

  // Actions
  registerSendHandler: (handler: (destNodeId: string, text: string) => void) => void;
  setOwnDisplayName: (name: string) => void; // added profile action
  setActiveConversation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  addLiveMessage: (fromNodeId: string, text: string, isSent: boolean, packetId?: string, senderName?: string) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: 'delivered' | 'read') => void;
  updateLivePeers: (peerNodeIds: string[]) => void;
  toggleMeshPanel: () => void;
  showSafetyNumber: (contactId: string | null) => void;
  verifyContact: (contactId: string) => void;
}

// Generate a deterministic color based on NodeID string
function getDeterministicColor(nodeId: string): string {
  const hash = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'linear-gradient(135deg, #6B4EFE 0%, #3B2EFE 100%)',
    'linear-gradient(135deg, #00C853 0%, #009624 100%)',
    'linear-gradient(135deg, #FF6D00 0%, #D50000 100%)',
    'linear-gradient(135deg, #00B0FF 0%, #0091EA 100%)',
    'linear-gradient(135deg, #AA00FF 0%, #7B00AB 100%)',
    'linear-gradient(135deg, #00E5FF 0%, #00B8D4 100%)',
  ];
  return colors[hash % colors.length];
}

// Generate random NodeID for the browser tab session
const generateSessionNodeId = () => {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16))
    .join('')
    .toUpperCase();
};

const sessionNodeId = generateSessionNodeId();

export const useMeshStore = create<MeshState>((set, get) => ({
  ownNodeId: sessionNodeId,
  ownDisplayName: `Node ${sessionNodeId.substring(0, 8)}`, // Default username

  contacts: [],
  conversations: [],
  activeConversationId: null,
  searchQuery: '',

  meshNodes: [],
  relayConnected: false,
  meshPanelOpen: false,
  safetyNumberContactId: null,

  sendPacketHandler: null,

  registerSendHandler: (handler) => set({ sendPacketHandler: handler }),

  // Action: updates own profile display name
  setOwnDisplayName: (name) => set({ ownDisplayName: name.trim() || `Node ${sessionNodeId.substring(0, 8)}` }),

  // Clear unread badge counter when selecting a conversation thread
  setActiveConversation: (id) => set((state) => {
    // Send a read receipt for the incoming messages when clicking the chat
    const conversation = state.conversations.find((c) => c.id === id);
    const lastUnreadMessage = conversation?.messages
      .filter((m) => !m.sent && m.status !== 'read')
      .slice(-1)[0];

    if (id && lastUnreadMessage && state.sendPacketHandler) {
      try {
        state.sendPacketHandler(id, JSON.stringify({
          type: 'ack',
          id: lastUnreadMessage.id,
          status: 'read'
        }));
      } catch (e) {}
    }

    return {
      activeConversationId: id,
      conversations: state.conversations.map((conv) =>
        conv.id === id
          ? { ...conv, unread: 0, messages: conv.messages.map((m) => !m.sent ? { ...m, status: 'read' } : m) }
          : conv
      ),
    };
  }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  sendMessage: (conversationId, text) => {
    if (!text.trim()) return;

    const messageId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMessage: Message = {
      id: messageId,
      conversationId,
      text: text.trim(),
      sent: true,
      timestamp: Date.now(),
      status: 'sent',
      transport: 'relay',
    };

    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessage: text.trim(),
              lastTime: Date.now(),
            }
          : conv
      ),
    }));

    // Trigger physical WebSocket packet send via registered handler
    const handler = get().sendPacketHandler;
    if (handler) {
      // Include own nickname so recipient can instantly resolve NodeID to your actual name
      const payload = JSON.stringify({
        type: 'msg',
        id: messageId,
        text: text.trim(),
        senderName: get().ownDisplayName
      });
      handler(conversationId, payload);
    }
  },

  addLiveMessage: (fromNodeId, text, isSent, packetId, senderName) => {
    const state = get();
    const isActive = state.activeConversationId === fromNodeId;
    const resolvedPacketId = packetId || `m-${Date.now()}`;
    let conv = state.conversations.find((c) => c.id === fromNodeId);

    const newMessage: Message = {
      id: resolvedPacketId,
      conversationId: fromNodeId,
      text: text.trim(),
      sent: isSent,
      timestamp: Date.now(),
      status: isSent ? 'sent' : (isActive ? 'read' : 'delivered'),
      transport: 'relay',
    };

    const unreadIncrement = (isSent || isActive) ? 0 : 1;

    // Resolve name: prefer custom shared senderName, fallback to Node hex
    const finalName = senderName || (conv ? conv.contact.name : `Node ${fromNodeId.substring(0, 8)}`);
    const initials = finalName.substring(0, 2).toUpperCase();

    if (!conv) {
      const color = getDeterministicColor(fromNodeId);
      const newContact: Contact = {
        id: fromNodeId,
        nodeId: fromNodeId,
        name: finalName,
        initials,
        color,
        online: true,
        hopCount: 1,
        transport: 'relay',
        verified: false,
      };

      const newConv: Conversation = {
        id: fromNodeId,
        contact: newContact,
        messages: [newMessage],
        lastMessage: text.trim(),
        lastTime: Date.now(),
        unread: unreadIncrement,
      };

      set((state) => ({
        contacts: [...state.contacts, newContact],
        conversations: [...state.conversations, newConv],
      }));
    } else {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === fromNodeId
            ? {
                ...c,
                contact: { ...c.contact, name: finalName, initials },
                messages: [...c.messages, newMessage],
                lastMessage: text.trim(),
                lastTime: Date.now(),
                unread: c.unread + unreadIncrement,
              }
            : c
        ),
        contacts: state.contacts.map((contact) =>
          contact.id === fromNodeId
            ? { ...contact, name: finalName, initials }
            : contact
        ),
      }));
    }

    // Send read/delivered acknowledgment receipt if message was received from peer
    if (!isSent && state.sendPacketHandler) {
      try {
        state.sendPacketHandler(fromNodeId, JSON.stringify({
          type: 'ack',
          id: resolvedPacketId,
          status: isActive ? 'read' : 'delivered'
        }));
      } catch (e) {}
    }
  },

  // Action: updates status ticks of outgoing messages on delivery/read ack arrival
  updateMessageStatus: (conversationId, messageId, status) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((m) =>
                m.id === messageId
                  ? { ...m, status: (status === 'read' || m.status === 'read') ? 'read' : 'delivered' }
                  : m
              )
            }
          : conv
      )
    }));
  },

  updateLivePeers: (peerNodeIds) => {
    const count = peerNodeIds.length;
    const newMeshNodes: MeshNode[] = peerNodeIds.map((id, index) => {
      const angle = (index * 2 * Math.PI) / count;
      const radius = 30;
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);

      return {
        id,
        nodeId: id,
        displayId: `${id.substring(0, 8)}...`,
        hopCount: 1,
        transport: 'relay',
        batteryClass: 'mains',
        relayCapable: true,
        x,
        y,
      };
    });

    set((state) => {
      const updatedContacts = state.contacts.map((c) => ({
        ...c,
        online: peerNodeIds.includes(c.id),
      }));

      // Ensure any newly discovered peer has a contact record
      const finalContacts = [...updatedContacts];
      for (const id of peerNodeIds) {
        if (!finalContacts.some((c) => c.id === id)) {
          finalContacts.push({
            id,
            nodeId: id,
            name: `Node ${id.substring(0, 8)}`,
            initials: id.substring(0, 2),
            color: getDeterministicColor(id),
            online: true,
            hopCount: 1,
            transport: 'relay',
            verified: false,
          });
        }
      }

      // Sync active conversation contacts online flag
      const updatedConversations = state.conversations.map((conv) => {
        const isOnline = peerNodeIds.includes(conv.id);
        return {
          ...conv,
          contact: { ...conv.contact, online: isOnline },
        };
      });

      // Automatically add new conversations for newly discovered peers
      const finalConversations = [...updatedConversations];
      for (const contact of finalContacts) {
        if (!finalConversations.some((c) => c.id === contact.id)) {
          finalConversations.push({
            id: contact.id,
            contact,
            messages: [],
            lastMessage: 'Discovered peer online',
            lastTime: Date.now(),
            unread: 0,
          });
        }
      }

      return {
        meshNodes: newMeshNodes,
        contacts: finalContacts,
        conversations: finalConversations,
      };
    });
  },

  toggleMeshPanel: () => set((state) => ({ meshPanelOpen: !state.meshPanelOpen })),

  showSafetyNumber: (contactId) => set({ safetyNumberContactId: contactId }),

  verifyContact: (contactId) => set((state) => ({
    contacts: state.contacts.map((c) =>
      c.id === contactId ? { ...c, verified: true } : c
    ),
    conversations: state.conversations.map((conv) =>
      conv.contact.id === contactId
        ? { ...conv, contact: { ...conv.contact, verified: true } }
        : conv
    ),
  })),
}));
