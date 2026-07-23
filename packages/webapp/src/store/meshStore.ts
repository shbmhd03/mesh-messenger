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
  chatStatus?: 'none' | 'waiting_approval' | 'waiting_approval_sent' | 'requested' | 'accepted';
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
  ownDisplayName: string;
  stealthMode: boolean; // added for invisible mode

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
  setOwnDisplayName: (name: string) => void;
  setStealthMode: (enabled: boolean) => void; // added for invisible toggle
  connectToPeerById: (peerId: string) => boolean; // added for manual channel connect
  sendChatRequest: (contactId: string) => void; // added for stealth requests
  acceptChatRequest: (contactId: string) => void; // added for stealth requests
  declineChatRequest: (contactId: string) => void; // added for stealth requests
  handleIncomingChatRequest: (fromNodeId: string, senderName?: string) => void; // added for stealth requests
  handleIncomingChatAccept: (fromNodeId: string) => void; // added for stealth requests
  setActiveConversation: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  addLiveMessage: (fromNodeId: string, text: string, isSent: boolean, packetId?: string, senderName?: string) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: 'delivered' | 'read') => void;
  updateLivePeers: (peerNodeIds: { id: string; name: string }[]) => void;
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

// LocalStorage Persistence Keys
const STORAGE_KEY_NODE_ID = 'mesh_own_node_id';
const STORAGE_KEY_DISPLAY_NAME = 'mesh_own_display_name';
const STORAGE_KEY_STEALTH_MODE = 'mesh_stealth_mode';
const STORAGE_KEY_CONTACTS = 'mesh_contacts';
const STORAGE_KEY_CONVERSATIONS = 'mesh_conversations';

// Generate a hex NodeID
const generateNodeId = () => {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16))
    .join('')
    .toUpperCase();
};

// Safe localStorage initial state loaders
const getInitialNodeId = (): string => {
  if (typeof window === 'undefined' || !window.localStorage) return generateNodeId();
  try {
    const saved = localStorage.getItem(STORAGE_KEY_NODE_ID);
    if (saved && saved.trim().length >= 4) return saved.trim();
    const newId = generateNodeId();
    localStorage.setItem(STORAGE_KEY_NODE_ID, newId);
    return newId;
  } catch {
    return generateNodeId();
  }
};

const getInitialDisplayName = (nodeId: string): string => {
  if (typeof window === 'undefined' || !window.localStorage) return `Node ${nodeId.substring(0, 8)}`;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DISPLAY_NAME);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return `Node ${nodeId.substring(0, 8)}`;
};

const getInitialStealthMode = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return localStorage.getItem(STORAGE_KEY_STEALTH_MODE) === 'true';
  } catch {
    return false;
  }
};

const getInitialContacts = (): Contact[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

const getInitialConversations = (): Conversation[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

const initialNodeId = getInitialNodeId();
const initialDisplayName = getInitialDisplayName(initialNodeId);
const initialStealthMode = getInitialStealthMode();
const initialContacts = getInitialContacts();
const initialConversations = getInitialConversations();

export const useMeshStore = create<MeshState>((set, get) => ({
  ownNodeId: initialNodeId,
  ownDisplayName: initialDisplayName,
  stealthMode: initialStealthMode,

  contacts: initialContacts,
  conversations: initialConversations,
  activeConversationId: null,
  searchQuery: '',

  meshNodes: [],
  relayConnected: false,
  meshPanelOpen: false,
  safetyNumberContactId: null,

  sendPacketHandler: null,

  registerSendHandler: (handler) => set({ sendPacketHandler: handler }),

  // Action: updates own profile display name
  setOwnDisplayName: (name) => set({ ownDisplayName: name.trim() || `Node ${get().ownNodeId.substring(0, 8)}` }),

  // Action: toggle stealth/invisible mode connection status
  setStealthMode: (enabled) => set({ stealthMode: enabled }),

  // Action: initiates a private manual peer contact channel using a specific Node ID code
  connectToPeerById: (peerId) => {
    const id = peerId.trim().toUpperCase();
    if (!id || id.length < 4) return false;

    const state = get();
    const conv = state.conversations.find((c) => c.id === id);

    if (!conv) {
      const name = `Node ${id}`;
      const initials = id.substring(0, 2);
      const color = getDeterministicColor(id);

      // Check if peer is currently public online
      const isOnline = state.meshNodes.some((n) => n.id === id);

      const newContact: Contact = {
        id,
        nodeId: id,
        name,
        initials,
        color,
        online: isOnline,
        hopCount: 1,
        transport: 'relay',
        verified: false,
        chatStatus: isOnline ? 'accepted' : 'waiting_approval',
      };

      const newConv: Conversation = {
        id,
        contact: newContact,
        messages: [],
        lastMessage: 'Direct chat established via Peer ID',
        lastTime: Date.now(),
        unread: 0,
      };

      set((state) => ({
        contacts: [...state.contacts, newContact],
        conversations: [...state.conversations, newConv],
      }));
    }

    set({ activeConversationId: id });
    return true;
  },

  // Action: send a connection invitation to a stealth node
  sendChatRequest: (contactId) => {
    const state = get();
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === contactId ? { ...c, chatStatus: 'waiting_approval_sent' } : c
      ),
      conversations: state.conversations.map((conv) =>
        conv.id === contactId
          ? { ...conv, contact: { ...conv.contact, chatStatus: 'waiting_approval_sent' } }
          : conv
      ),
    }));

    if (state.sendPacketHandler) {
      try {
        state.sendPacketHandler(contactId, JSON.stringify({
          type: 'chat_request',
          senderName: state.ownDisplayName,
        }));
      } catch (e) {}
    }
  },

  // Action: accept incoming connection request from a stealth node
  acceptChatRequest: (contactId) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === contactId ? { ...c, chatStatus: 'accepted' } : c
      ),
      conversations: state.conversations.map((conv) =>
        conv.id === contactId
          ? { ...conv, contact: { ...conv.contact, chatStatus: 'accepted' } }
          : conv
      ),
    }));

    const state = get();
    if (state.sendPacketHandler) {
      try {
        state.sendPacketHandler(contactId, JSON.stringify({
          type: 'chat_accept',
        }));
      } catch (e) {}
    }
  },

  // Action: decline incoming request from a stealth node
  declineChatRequest: (contactId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== contactId),
      contacts: state.contacts.filter((c) => c.id !== contactId),
      activeConversationId: state.activeConversationId === contactId ? null : state.activeConversationId
    }));
  },

  // Action: process incoming request packet from a stealth peer
  handleIncomingChatRequest: (fromNodeId, senderName) => {
    const state = get();
    const conv = state.conversations.find((c) => c.id === fromNodeId);
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
        chatStatus: 'requested',
      };

      const newConv: Conversation = {
        id: fromNodeId,
        contact: newContact,
        messages: [],
        lastMessage: 'Incoming chat request',
        lastTime: Date.now(),
        unread: 1,
      };

      set((state) => ({
        contacts: [...state.contacts, newContact],
        conversations: [...state.conversations, newConv],
      }));
    } else {
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === fromNodeId ? { ...c, chatStatus: 'requested', name: finalName, initials } : c
        ),
        conversations: state.conversations.map((c) =>
          c.id === fromNodeId
            ? { ...c, contact: { ...c.contact, chatStatus: 'requested', name: finalName, initials }, unread: c.unread + 1 }
            : c
        ),
      }));
    }
  },

  // Action: process incoming approval response packet from a stealth peer
  handleIncomingChatAccept: (fromNodeId) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === fromNodeId ? { ...c, chatStatus: 'accepted', online: true } : c
      ),
      conversations: state.conversations.map((conv) =>
        conv.id === fromNodeId
          ? { ...conv, contact: { ...conv.contact, chatStatus: 'accepted', online: true } }
          : conv
      ),
    }));
  },

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

  updateLivePeers: (peerList) => {
    const count = peerList.length;
    const newMeshNodes: MeshNode[] = peerList.map((peer, index) => {
      const angle = (index * 2 * Math.PI) / count;
      const radius = 30;
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);

      return {
        id: peer.id,
        nodeId: peer.id,
        displayId: `${peer.id.substring(0, 8)}...`,
        hopCount: 1,
        transport: 'relay',
        batteryClass: 'mains',
        relayCapable: true,
        x,
        y,
      };
    });

    const peerNodeIds = peerList.map((p) => p.id);

    set((state) => {
      const peerNameMap = new Map(peerList.map(p => [p.id, p.name]));

      const updatedContacts = state.contacts.map((c) => {
        const isOnline = peerNodeIds.includes(c.id);
        const name = peerNameMap.get(c.id) || c.name;
        const initials = name.substring(0, 2).toUpperCase();
        return {
          ...c,
          name,
          initials,
          online: isOnline,
        };
      });

      // Ensure any newly discovered peer has a contact record
      const finalContacts = [...updatedContacts];
      for (const peer of peerList) {
        if (!finalContacts.some((c) => c.id === peer.id)) {
          const initials = peer.name.substring(0, 2).toUpperCase();
          finalContacts.push({
            id: peer.id,
            nodeId: peer.id,
            name: peer.name,
            initials,
            color: getDeterministicColor(peer.id),
            online: true,
            hopCount: 1,
            transport: 'relay',
            verified: false,
          });
        }
      }

      // Sync active conversation contacts online flag & updated names
      const updatedConversations = state.conversations.map((conv) => {
        const isOnline = peerNodeIds.includes(conv.id);
        const name = peerNameMap.get(conv.id) || conv.contact.name;
        const initials = name.substring(0, 2).toUpperCase();
        return {
          ...conv,
          contact: {
            ...conv.contact,
            name,
            initials,
            online: isOnline
          },
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

// Subscribe to automatically sync state changes to localStorage across tab reloads
if (typeof window !== 'undefined' && window.localStorage) {
  useMeshStore.subscribe((state) => {
    try {
      localStorage.setItem(STORAGE_KEY_NODE_ID, state.ownNodeId);
      localStorage.setItem(STORAGE_KEY_DISPLAY_NAME, state.ownDisplayName);
      localStorage.setItem(STORAGE_KEY_STEALTH_MODE, String(state.stealthMode));
      localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(state.contacts));
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(state.conversations));
    } catch {
      // Ignore quota or private browsing errors silently
    }
  });
}
