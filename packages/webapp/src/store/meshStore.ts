/**
 * Zustand store for Mesh Messenger (Live Production Edition).
 * Manages live contact maps, message lists, and dynamic peer layouts.
 */

import { create } from 'zustand';
import { WebRTCManager, type CallType } from '../lib/webrtc';

export interface IncomingCall {
  callId: string;
  callerNodeId: string;
  callerName: string;
  callType: CallType;
  sdp: RTCSessionDescriptionInit;
}

export interface ActiveCall {
  callId: string;
  peerNodeId: string;
  peerName: string;
  callType: CallType;
  status: 'ringing' | 'connected';
  isMuted: boolean;
  isCameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  webrtcManager: WebRTCManager | null;
}

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
  senderName?: string;
}

export interface GroupMember {
  nodeId: string;
  name: string;
  role: 'admin' | 'member';
}

export interface Conversation {
  id: string;
  contact: Contact;
  messages: Message[];
  lastMessage: string;
  lastTime: number;
  unread: number;
  // Group properties
  isGroup?: boolean;
  groupName?: string;
  groupDescription?: string;
  groupAdminId?: string;
  members?: GroupMember[];
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
  theme: 'dark' | 'light';

  // Modals & Drawers
  qrModalOpen: boolean;
  createGroupModalOpen: boolean;
  groupInfoDrawerOpen: boolean;

  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setQrModalOpen: (open: boolean) => void;
  setCreateGroupModalOpen: (open: boolean) => void;
  setGroupInfoDrawerOpen: (open: boolean) => void;

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

  // Message Deletion Actions
  deleteMessageForMe: (conversationId: string, messageId: string) => void;
  deleteMessageForEveryone: (conversationId: string, messageId: string) => void;
  handleIncomingDeletePacket: (fromNodeId: string, conversationId: string, messageId: string) => void;

  // Group Chat Actions
  createGroup: (name: string, description: string, selectedContactIds: string[]) => string;
  addGroupMember: (groupId: string, contactIdOrNodeId: string) => void;
  removeGroupMember: (groupId: string, memberNodeId: string) => void;
  toggleGroupAdmin: (groupId: string, memberNodeId: string) => void;
  leaveGroup: (groupId: string) => void;
  handleIncomingGroupPacket: (fromNodeId: string, payload: any) => void;

  // WebRTC Calling State & Actions
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  startCall: (peerNodeId: string, callType: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleCallMute: () => void;
  toggleCallCamera: () => void;
  handleCallPacket: (fromNodeId: string, payload: any) => void;
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

const STORAGE_KEY_THEME = 'mesh_theme';

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined' || !window.localStorage) return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
};

const initialNodeId = getInitialNodeId();
const initialDisplayName = getInitialDisplayName(initialNodeId);
const initialStealthMode = getInitialStealthMode();
const initialContacts = getInitialContacts();
const initialConversations = getInitialConversations();
const initialTheme = getInitialTheme();

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}

// Module-level buffer for WebRTC ICE candidates arriving before acceptCall
const iceCandidateBuffer = new Map<string, RTCIceCandidateInit[]>();

export const useMeshStore = create<MeshState>((set, get) => ({
  ownNodeId: initialNodeId,
  ownDisplayName: initialDisplayName,
  stealthMode: initialStealthMode,
  theme: initialTheme,

  contacts: initialContacts,
  conversations: initialConversations,
  activeConversationId: null,
  searchQuery: '',

  meshNodes: [],
  relayConnected: false,
  meshPanelOpen: false,
  safetyNumberContactId: null,

  qrModalOpen: false,
  createGroupModalOpen: false,
  groupInfoDrawerOpen: false,

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
    set({ theme: nextTheme });
  },

  setQrModalOpen: (open) => set({ qrModalOpen: open }),
  setCreateGroupModalOpen: (open) => set({ createGroupModalOpen: open }),
  setGroupInfoDrawerOpen: (open) => set({ groupInfoDrawerOpen: open }),

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
      status: 'pending',
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
    const conv = get().conversations.find((c) => c.id === conversationId);

    if (handler && conv) {
      if (conv.isGroup && conv.members) {
        const payload = JSON.stringify({
          type: 'group_msg',
          groupId: conversationId,
          groupName: conv.groupName || conv.contact.name,
          id: messageId,
          text: text.trim(),
          senderName: get().ownDisplayName,
          senderId: get().ownNodeId,
        });
        conv.members.forEach((m) => {
          if (m.nodeId !== get().ownNodeId) {
            try {
              handler(m.nodeId, payload);
            } catch (e) {}
          }
        });
      } else {
        const payload = JSON.stringify({
          type: 'msg',
          id: messageId,
          text: text.trim(),
          senderName: get().ownDisplayName,
        });
        handler(conversationId, payload);
      }
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

  updateLivePeers: (rawPeerList) => {
    // Normalize peer list items (support both string IDs and { id, name } objects)
    const peerList: { id: string; name: string }[] = (rawPeerList || [])
      .map((item: any) => {
        if (typeof item === 'string') {
          return { id: item, name: `Node ${item.substring(0, 8)}` };
        }
        if (item && typeof item === 'object' && item.id) {
          return {
            id: String(item.id),
            name: item.name ? String(item.name) : `Node ${String(item.id).substring(0, 8)}`,
          };
        }
        return null;
      })
      .filter((p): p is { id: string; name: string } => p !== null);

    const count = peerList.length;
    const newMeshNodes: MeshNode[] = peerList.map((peer, index) => {
      const angle = (index * 2 * Math.PI) / (count || 1);
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
      const peerNameMap = new Map(peerList.map((p) => [p.id, p.name]));

      // Refresh online and name status for existing contacts (do not auto-create unrequested contacts)
      const updatedContacts = state.contacts.map((c) => {
        const isOnline = peerNodeIds.includes(c.id) || peerNodeIds.includes(c.nodeId);
        const name = peerNameMap.get(c.id) || peerNameMap.get(c.nodeId) || c.name;
        const initials = name.substring(0, 2).toUpperCase();
        return {
          ...c,
          name,
          initials,
          online: isOnline,
        };
      });

      // Refresh online and name status for existing conversations (do not auto-create unrequested conversations)
      const updatedConversations = state.conversations.map((conv) => {
        const isOnline = peerNodeIds.includes(conv.id) || peerNodeIds.includes(conv.contact.nodeId);
        const name = peerNameMap.get(conv.id) || peerNameMap.get(conv.contact.nodeId) || conv.contact.name;
        const initials = name.substring(0, 2).toUpperCase();
        return {
          ...conv,
          contact: {
            ...conv.contact,
            name,
            initials,
            online: isOnline,
          },
        };
      });

      return {
        meshNodes: newMeshNodes,
        contacts: updatedContacts,
        conversations: updatedConversations,
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

  // Message Deletion Actions Implementation
  deleteMessageForMe: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) => {
        if (conv.id !== conversationId) return conv;
        const updatedMsgs = conv.messages.filter((m) => m.id !== messageId);
        const lastMsg = updatedMsgs.length > 0 ? updatedMsgs[updatedMsgs.length - 1] : null;
        return {
          ...conv,
          messages: updatedMsgs,
          lastMessage: lastMsg ? lastMsg.text : 'Message deleted',
          lastTime: lastMsg ? lastMsg.timestamp : conv.lastTime,
        };
      }),
    }));
  },

  deleteMessageForEveryone: (conversationId, messageId) => {
    const state = get();
    const conv = state.conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    set((prev) => ({
      conversations: prev.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const updatedMsgs = c.messages.map((m) =>
          m.id === messageId ? { ...m, text: '🚫 This message was deleted', status: 'failed' as const } : m
        );
        return {
          ...c,
          messages: updatedMsgs,
          lastMessage: '🚫 This message was deleted',
        };
      }),
    }));

    if (state.sendPacketHandler) {
      const payload = JSON.stringify({
        type: 'delete_msg',
        conversationId,
        messageId,
      });

      if (conv.isGroup && conv.members) {
        conv.members.forEach((m) => {
          if (m.nodeId !== state.ownNodeId) {
            try {
              state.sendPacketHandler!(m.nodeId, payload);
            } catch (e) {}
          }
        });
      } else {
        try {
          state.sendPacketHandler(conversationId, payload);
        } catch (e) {}
      }
    }
  },

  handleIncomingDeletePacket: (fromNodeId, conversationId, messageId) => {
    const targetConvId = conversationId || fromNodeId;
    set((state) => ({
      conversations: state.conversations.map((conv) => {
        if (conv.id !== targetConvId && conv.id !== fromNodeId) return conv;
        const updatedMsgs = conv.messages.map((m) =>
          m.id === messageId ? { ...m, text: '🚫 This message was deleted', status: 'failed' as const } : m
        );
        return {
          ...conv,
          messages: updatedMsgs,
          lastMessage: '🚫 This message was deleted',
        };
      }),
    }));
  },

  // Group Chat Actions Implementation
  createGroup: (name, description, selectedContactIds) => {
    const state = get();
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const creatorMember: GroupMember = {
      nodeId: state.ownNodeId,
      name: state.ownDisplayName,
      role: 'admin',
    };

    const contactMembers: GroupMember[] = selectedContactIds.map((cid) => {
      const c = state.contacts.find((contact) => contact.id === cid);
      return {
        nodeId: c ? c.nodeId : cid,
        name: c ? c.name : `Node ${cid.substring(0, 8)}`,
        role: 'member',
      };
    });

    const members = [creatorMember, ...contactMembers];

    const groupContact: Contact = {
      id: groupId,
      nodeId: groupId,
      name,
      initials: name.substring(0, 2).toUpperCase(),
      color: getDeterministicColor(groupId),
      online: true,
      hopCount: 1,
      transport: 'relay',
      verified: true,
    };

    const groupConv: Conversation = {
      id: groupId,
      contact: groupContact,
      messages: [
        {
          id: `m-init-${Date.now()}`,
          conversationId: groupId,
          text: `Group "${name}" created.`,
          sent: true,
          timestamp: Date.now(),
          status: 'read',
        },
      ],
      lastMessage: `Group "${name}" created.`,
      lastTime: Date.now(),
      unread: 0,
      isGroup: true,
      groupName: name,
      groupDescription: description,
      groupAdminId: state.ownNodeId,
      members,
    };

    set((prev) => ({
      conversations: [groupConv, ...prev.conversations],
    }));

    if (state.sendPacketHandler) {
      const payload = JSON.stringify({
        type: 'group_invite',
        groupId,
        groupName: name,
        groupDescription: description,
        groupAdminId: state.ownNodeId,
        members,
        createdBy: state.ownDisplayName,
      });

      contactMembers.forEach((m) => {
        try {
          state.sendPacketHandler!(m.nodeId, payload);
        } catch (e) {}
      });
    }

    return groupId;
  },

  addGroupMember: (groupId, contactIdOrNodeId) => {
    const state = get();
    const conv = state.conversations.find((c) => c.id === groupId);
    if (!conv || !conv.isGroup) return;

    const contact = state.contacts.find((c) => c.id === contactIdOrNodeId);
    const targetNodeId = contact ? contact.nodeId : contactIdOrNodeId.trim();
    const targetName = contact ? contact.name : `Node ${targetNodeId.substring(0, 8)}`;

    if (conv.members?.some((m) => m.nodeId === targetNodeId)) return;

    const newMember: GroupMember = {
      nodeId: targetNodeId,
      name: targetName,
      role: 'member',
    };

    const updatedMembers = [...(conv.members || []), newMember];

    set((prev) => ({
      conversations: prev.conversations.map((c) =>
        c.id === groupId ? { ...c, members: updatedMembers } : c
      ),
    }));

    if (state.sendPacketHandler) {
      const invitePayload = JSON.stringify({
        type: 'group_invite',
        groupId: conv.id,
        groupName: conv.groupName || conv.contact.name,
        groupDescription: conv.groupDescription,
        groupAdminId: conv.groupAdminId,
        members: updatedMembers,
        createdBy: state.ownDisplayName,
      });
      try {
        state.sendPacketHandler(targetNodeId, invitePayload);
      } catch (e) {}

      const updatePayload = JSON.stringify({
        type: 'group_update',
        groupId: conv.id,
        members: updatedMembers,
      });
      updatedMembers.forEach((m) => {
        if (m.nodeId !== state.ownNodeId && m.nodeId !== targetNodeId) {
          try {
            state.sendPacketHandler!(m.nodeId, updatePayload);
          } catch (e) {}
        }
      });
    }
  },

  removeGroupMember: (groupId, memberNodeId) => {
    const state = get();
    const conv = state.conversations.find((c) => c.id === groupId);
    if (!conv || !conv.isGroup) return;

    const updatedMembers = (conv.members || []).filter((m) => m.nodeId !== memberNodeId);

    set((prev) => ({
      conversations: prev.conversations.map((c) =>
        c.id === groupId ? { ...c, members: updatedMembers } : c
      ),
    }));

    if (state.sendPacketHandler) {
      const payload = JSON.stringify({
        type: 'group_update',
        groupId,
        members: updatedMembers,
      });

      (conv.members || []).forEach((m) => {
        if (m.nodeId !== state.ownNodeId) {
          try {
            state.sendPacketHandler!(m.nodeId, payload);
          } catch (e) {}
        }
      });
    }
  },

  toggleGroupAdmin: (groupId, memberNodeId) => {
    const state = get();
    const conv = state.conversations.find((c) => c.id === groupId);
    if (!conv || !conv.isGroup) return;

    const updatedMembers = (conv.members || []).map((m) =>
      m.nodeId === memberNodeId ? { ...m, role: (m.role === 'admin' ? 'member' : 'admin') as 'admin' | 'member' } : m
    );

    set((prev) => ({
      conversations: prev.conversations.map((c) =>
        c.id === groupId ? { ...c, members: updatedMembers } : c
      ),
    }));

    if (state.sendPacketHandler) {
      const payload = JSON.stringify({
        type: 'group_update',
        groupId,
        members: updatedMembers,
      });

      updatedMembers.forEach((m) => {
        if (m.nodeId !== state.ownNodeId) {
          try {
            state.sendPacketHandler!(m.nodeId, payload);
          } catch (e) {}
        }
      });
    }
  },

  leaveGroup: (groupId) => {
    const state = get();
    const conv = state.conversations.find((c) => c.id === groupId);
    if (conv && conv.members && state.sendPacketHandler) {
      const updatedMembers = conv.members.filter((m) => m.nodeId !== state.ownNodeId);
      const payload = JSON.stringify({
        type: 'group_update',
        groupId,
        members: updatedMembers,
      });

      updatedMembers.forEach((m) => {
        try {
          state.sendPacketHandler!(m.nodeId, payload);
        } catch (e) {}
      });
    }

    set((prev) => ({
      conversations: prev.conversations.filter((c) => c.id !== groupId),
      activeConversationId: prev.activeConversationId === groupId ? null : prev.activeConversationId,
    }));
  },

  handleIncomingGroupPacket: (fromNodeId, payload) => {
    const state = get();
    if (!payload || !payload.type) return;

    if (payload.type === 'group_msg') {
      const { groupId, groupName, id, text, senderName, senderId } = payload;
      let conv = state.conversations.find((c) => c.id === groupId);

      const newMessage: Message = {
        id: id || `m-${Date.now()}`,
        conversationId: groupId,
        text: text.trim(),
        sent: false,
        timestamp: Date.now(),
        status: state.activeConversationId === groupId ? 'read' : 'delivered',
        senderName: senderName || `Node ${senderId?.substring(0, 8)}`,
      };

      if (!conv) {
        const groupContact: Contact = {
          id: groupId,
          nodeId: groupId,
          name: groupName || 'Group Chat',
          initials: (groupName || 'GC').substring(0, 2).toUpperCase(),
          color: getDeterministicColor(groupId),
          online: true,
          hopCount: 1,
          transport: 'relay',
          verified: true,
        };

        const newGroupConv: Conversation = {
          id: groupId,
          contact: groupContact,
          messages: [newMessage],
          lastMessage: `${senderName}: ${text.trim()}`,
          lastTime: Date.now(),
          unread: state.activeConversationId === groupId ? 0 : 1,
          isGroup: true,
          groupName: groupName || 'Group Chat',
          members: [
            { nodeId: state.ownNodeId, name: state.ownDisplayName, role: 'member' },
            { nodeId: senderId || fromNodeId, name: senderName || `Node ${fromNodeId.substring(0, 8)}`, role: 'member' },
          ],
        };

        set((prev) => ({
          conversations: [newGroupConv, ...prev.conversations],
        }));
      } else {
        set((prev) => ({
          conversations: prev.conversations.map((c) =>
            c.id === groupId
              ? {
                  ...c,
                  messages: [...c.messages, newMessage],
                  lastMessage: `${senderName}: ${text.trim()}`,
                  lastTime: Date.now(),
                  unread: state.activeConversationId === groupId ? 0 : c.unread + 1,
                }
              : c
          ),
        }));
      }
    } else if (payload.type === 'group_invite') {
      const { groupId, groupName, groupDescription, groupAdminId, members, createdBy } = payload;
      let conv = state.conversations.find((c) => c.id === groupId);

      if (!conv) {
        const groupContact: Contact = {
          id: groupId,
          nodeId: groupId,
          name: groupName,
          initials: groupName.substring(0, 2).toUpperCase(),
          color: getDeterministicColor(groupId),
          online: true,
          hopCount: 1,
          transport: 'relay',
          verified: true,
        };

        const newConv: Conversation = {
          id: groupId,
          contact: groupContact,
          messages: [
            {
              id: `m-invite-${Date.now()}`,
              conversationId: groupId,
              text: `Added to group "${groupName}" by ${createdBy || 'Admin'}.`,
              sent: false,
              timestamp: Date.now(),
              status: 'read',
            },
          ],
          lastMessage: `Added to group by ${createdBy || 'Admin'}.`,
          lastTime: Date.now(),
          unread: 1,
          isGroup: true,
          groupName,
          groupDescription,
          groupAdminId,
          members,
        };

        set((prev) => ({
          conversations: [newConv, ...prev.conversations],
        }));
      } else {
        set((prev) => ({
          conversations: prev.conversations.map((c) =>
            c.id === groupId ? { ...c, members, groupName, groupDescription, groupAdminId } : c
          ),
        }));
      }
    } else if (payload.type === 'group_update') {
      const { groupId, members } = payload;
      set((prev) => ({
        conversations: prev.conversations.map((c) =>
          c.id === groupId ? { ...c, members } : c
        ),
      }));
    }
  },

  // ── WebRTC Live Calling Actions ────────────────────────────────────────

  incomingCall: null,
  activeCall: null,

  startCall: async (peerNodeId: string, callType: CallType) => {
    const { contacts, sendPacketHandler } = get();
    const contact = contacts.find((c) => c.nodeId === peerNodeId || c.id === peerNodeId);
    const peerName = contact ? contact.name : `Node ${peerNodeId.substring(0, 8)}`;
    const callId = `call_${Date.now()}`;

    const manager = new WebRTCManager({
      onIceCandidate: (candidate) => {
        if (sendPacketHandler) {
          sendPacketHandler(peerNodeId, JSON.stringify({ type: 'call_ice', callId, candidate }));
        }
      },
      onRemoteStream: (stream) => {
        set((prev) => prev.activeCall ? { activeCall: { ...prev.activeCall, remoteStream: stream, status: 'connected' } } : {});
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          set((prev) => prev.activeCall ? { activeCall: { ...prev.activeCall, status: 'connected' } } : {});
        } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          get().endCall();
        }
      },
      onError: () => {
        get().endCall();
      },
    });

    // 1. Open Call Window IMMEDIATELY so user sees calling UI instantly
    set({
      activeCall: {
        callId,
        peerNodeId,
        peerName,
        callType,
        status: 'ringing',
        isMuted: false,
        isCameraOff: false,
        localStream: null,
        remoteStream: null,
        webrtcManager: manager,
      },
    });

    try {
      const localStream = await manager.getLocalStream(callType);
      set((prev) => prev.activeCall ? { activeCall: { ...prev.activeCall, localStream } } : {});

      const offerSdp = await manager.createOffer(callType);

      if (sendPacketHandler) {
        sendPacketHandler(
          peerNodeId,
          JSON.stringify({
            type: 'call_offer',
            callId,
            callType,
            sdp: offerSdp,
            callerName: get().ownDisplayName,
          })
        );
      }
    } catch (err: any) {
      console.error('[WebRTC] startCall error:', err);
      manager.close();
      set({ activeCall: null });
      alert(err.message || 'Could not start call. Please check microphone/camera permissions.');
    }
  },

  acceptCall: async () => {
    const { incomingCall, sendPacketHandler } = get();
    if (!incomingCall) return;

    const { callId, callerNodeId, callerName, callType, sdp: offerSdp } = incomingCall;
    set({ incomingCall: null });

    const manager = new WebRTCManager({
      onIceCandidate: (candidate) => {
        if (sendPacketHandler) {
          sendPacketHandler(callerNodeId, JSON.stringify({ type: 'call_ice', callId, candidate }));
        }
      },
      onRemoteStream: (stream) => {
        set((prev) => prev.activeCall ? { activeCall: { ...prev.activeCall, remoteStream: stream, status: 'connected' } } : {});
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          set((prev) => prev.activeCall ? { activeCall: { ...prev.activeCall, status: 'connected' } } : {});
        } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          get().endCall();
        }
      },
      onError: () => {
        get().endCall();
      },
    });

    // Open Active Call Window IMMEDIATELY on accept
    set({
      activeCall: {
        callId,
        peerNodeId: callerNodeId,
        peerName: callerName,
        callType,
        status: 'ringing',
        isMuted: false,
        isCameraOff: false,
        localStream: null,
        remoteStream: null,
        webrtcManager: manager,
      },
    });

    try {
      const localStream = await manager.getLocalStream(callType);
      set((prev) => prev.activeCall ? { activeCall: { ...prev.activeCall, localStream } } : {});

      const answerSdp = await manager.createAnswer(offerSdp, callType);

      // Flush early ICE candidates buffered while incomingCall was ringing
      const buffered = iceCandidateBuffer.get(callId) || [];
      for (const candidate of buffered) {
        await manager.addIceCandidate(candidate);
      }
      iceCandidateBuffer.delete(callId);

      set((prev) => prev.activeCall ? { activeCall: { ...prev.activeCall, status: 'connected' } } : {});

      if (sendPacketHandler) {
        sendPacketHandler(callerNodeId, JSON.stringify({ type: 'call_answer', callId, sdp: answerSdp }));
      }
    } catch (err: any) {
      console.error('[WebRTC] acceptCall error:', err);
      manager.close();
      iceCandidateBuffer.delete(callId);
      set({ activeCall: null });
      alert('Could not accept call. Check camera/mic permissions.');
    }
  },

  rejectCall: () => {
    const { incomingCall, sendPacketHandler } = get();
    if (incomingCall) {
      iceCandidateBuffer.delete(incomingCall.callId);
      if (sendPacketHandler) {
        sendPacketHandler(incomingCall.callerNodeId, JSON.stringify({ type: 'call_reject', callId: incomingCall.callId }));
      }
      set({ incomingCall: null });
    }
  },

  endCall: () => {
    const { activeCall, sendPacketHandler } = get();
    if (activeCall) {
      iceCandidateBuffer.delete(activeCall.callId);
      if (activeCall.webrtcManager) {
        activeCall.webrtcManager.close();
      }
      if (sendPacketHandler) {
        sendPacketHandler(activeCall.peerNodeId, JSON.stringify({ type: 'call_end', callId: activeCall.callId }));
      }
      set({ activeCall: null });
    }
  },

  toggleCallMute: () => {
    const { activeCall } = get();
    if (!activeCall || !activeCall.webrtcManager) return;
    const newMuted = !activeCall.isMuted;
    activeCall.webrtcManager.toggleMute(newMuted);
    set({ activeCall: { ...activeCall, isMuted: newMuted } });
  },

  toggleCallCamera: () => {
    const { activeCall } = get();
    if (!activeCall || !activeCall.webrtcManager) return;
    const newCameraOff = !activeCall.isCameraOff;
    activeCall.webrtcManager.toggleCamera(newCameraOff);
    set({ activeCall: { ...activeCall, isCameraOff: newCameraOff } });
  },

  handleCallPacket: (fromNodeId: string, payload: any) => {
    const { activeCall, incomingCall } = get();

    if (payload.type === 'call_offer') {
      if (activeCall || incomingCall) {
        const { sendPacketHandler } = get();
        if (sendPacketHandler) {
          sendPacketHandler(fromNodeId, JSON.stringify({ type: 'call_reject', callId: payload.callId, reason: 'busy' }));
        }
        return;
      }
      set({
        incomingCall: {
          callId: payload.callId,
          callerNodeId: fromNodeId,
          callerName: payload.callerName || `Node ${fromNodeId.substring(0, 8)}`,
          callType: payload.callType || 'voice',
          sdp: payload.sdp,
        },
      });
    } else if (payload.type === 'call_answer') {
      if (activeCall && activeCall.callId === payload.callId && activeCall.webrtcManager) {
        activeCall.webrtcManager.handleAnswer(payload.sdp);
        set({ activeCall: { ...activeCall, status: 'connected' } });
      }
    } else if (payload.type === 'call_ice') {
      if (activeCall && activeCall.callId === payload.callId && activeCall.webrtcManager) {
        activeCall.webrtcManager.addIceCandidate(payload.candidate);
      } else {
        // Buffer candidate while incomingCall is ringing or activeCall is initializing
        const existing = iceCandidateBuffer.get(payload.callId) || [];
        iceCandidateBuffer.set(payload.callId, [...existing, payload.candidate]);
      }
    } else if (payload.type === 'call_reject' || payload.type === 'call_end') {
      iceCandidateBuffer.delete(payload.callId);
      if (incomingCall && incomingCall.callId === payload.callId) {
        set({ incomingCall: null });
      }
      if (activeCall && activeCall.callId === payload.callId) {
        if (activeCall.webrtcManager) {
          activeCall.webrtcManager.close();
        }
        set({ activeCall: null });
      }
    }
  },
}));

// Subscribe to automatically sync state changes to localStorage across tab reloads
if (typeof window !== 'undefined' && window.localStorage) {
  useMeshStore.subscribe((state) => {
    try {
      localStorage.setItem(STORAGE_KEY_NODE_ID, state.ownNodeId);
      localStorage.setItem(STORAGE_KEY_DISPLAY_NAME, state.ownDisplayName);
      localStorage.setItem(STORAGE_KEY_STEALTH_MODE, String(state.stealthMode));
      localStorage.setItem(STORAGE_KEY_THEME, state.theme);
      localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(state.contacts));
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(state.conversations));
    } catch {
      // Ignore quota or private browsing errors silently
    }
  });
}
