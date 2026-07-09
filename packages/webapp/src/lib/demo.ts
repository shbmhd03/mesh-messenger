/**
 * Demo data generator for showcase.
 * Realistic conversations, contacts, and mesh topology.
 */

export interface DemoContact {
  id: string;
  nodeId: string;
  name: string;
  initials: string;
  color: string;
  online: boolean;
  transport: 'ble' | 'wifi' | 'relay' | 'webrtc';
  hopCount: number;
  verified: boolean;
}

export interface DemoMessage {
  id: string;
  conversationId: string;
  text: string;
  sent: boolean;
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  transport?: 'ble' | 'wifi' | 'relay' | 'webrtc';
}

export interface DemoConversation {
  id: string;
  contact: DemoContact;
  messages: DemoMessage[];
  lastMessage: string;
  lastTime: number;
  unread: number;
}

export interface DemoMeshNode {
  id: string;
  nodeId: string;
  displayId: string;
  transport: 'ble' | 'wifi' | 'relay' | 'webrtc';
  batteryClass: 'mains' | 'high' | 'normal' | 'low' | 'ephemeral';
  hopCount: number;
  rssi?: number;
  relayCapable: boolean;
  x: number; // for graph visualization
  y: number;
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, hsl(252, 85%, 55%), hsl(280, 80%, 50%))',
  'linear-gradient(135deg, hsl(175, 75%, 40%), hsl(200, 70%, 45%))',
  'linear-gradient(135deg, hsl(340, 75%, 50%), hsl(10, 80%, 50%))',
  'linear-gradient(135deg, hsl(38, 90%, 50%), hsl(20, 85%, 50%))',
  'linear-gradient(135deg, hsl(140, 65%, 40%), hsl(175, 70%, 40%))',
  'linear-gradient(135deg, hsl(210, 80%, 50%), hsl(252, 75%, 55%))',
  'linear-gradient(135deg, hsl(300, 70%, 50%), hsl(330, 75%, 50%))',
];

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const now = Date.now();
const minute = 60 * 1000;
const hour = 60 * minute;

export function generateDemoContacts(): DemoContact[] {
  return [
    {
      id: 'c1', nodeId: randomHex(16), name: 'Aisha Rahman',
      initials: 'AR', color: AVATAR_COLORS[0], online: true,
      transport: 'ble', hopCount: 1, verified: true,
    },
    {
      id: 'c2', nodeId: randomHex(16), name: 'Marcus Chen',
      initials: 'MC', color: AVATAR_COLORS[1], online: true,
      transport: 'relay', hopCount: 0, verified: true,
    },
    {
      id: 'c3', nodeId: randomHex(16), name: 'Priya Patel',
      initials: 'PP', color: AVATAR_COLORS[2], online: false,
      transport: 'ble', hopCount: 3, verified: false,
    },
    {
      id: 'c4', nodeId: randomHex(16), name: 'Diego Morales',
      initials: 'DM', color: AVATAR_COLORS[3], online: true,
      transport: 'wifi', hopCount: 1, verified: true,
    },
    {
      id: 'c5', nodeId: randomHex(16), name: 'Lena Okafor',
      initials: 'LO', color: AVATAR_COLORS[4], online: true,
      transport: 'webrtc', hopCount: 0, verified: true,
    },
    {
      id: 'c6', nodeId: randomHex(16), name: 'Yuki Tanaka',
      initials: 'YT', color: AVATAR_COLORS[5], online: false,
      transport: 'ble', hopCount: 4, verified: false,
    },
    {
      id: 'c7', nodeId: randomHex(16), name: 'Finn Larsson',
      initials: 'FL', color: AVATAR_COLORS[6], online: true,
      transport: 'relay', hopCount: 0, verified: true,
    },
  ];
}

export function generateDemoConversations(contacts: DemoContact[]): DemoConversation[] {
  return [
    {
      id: 'conv1',
      contact: contacts[0],
      lastMessage: 'The mesh propagation is looking solid across the park 🛜',
      lastTime: now - 2 * minute,
      unread: 2,
      messages: [
        { id: 'm1', conversationId: 'conv1', text: 'Hey! Are you at the festival site?', sent: false, timestamp: now - 45 * minute, status: 'read' },
        { id: 'm2', conversationId: 'conv1', text: 'Yeah, just arrived. Setting up the node near the main stage', sent: true, timestamp: now - 42 * minute, status: 'read' },
        { id: 'm3', conversationId: 'conv1', text: 'Perfect. I can see your node from here — 1 hop, strong signal', sent: false, timestamp: now - 40 * minute, status: 'read' },
        { id: 'm4', conversationId: 'conv1', text: 'I\'m seeing about 12 nodes in the mesh already. Pretty good coverage for setup day', sent: true, timestamp: now - 35 * minute, status: 'read' },
        { id: 'm5', conversationId: 'conv1', text: 'Nice! The BLE range is better than expected. I\'m getting 3-hop delivery to the parking area', sent: false, timestamp: now - 30 * minute, status: 'read' },
        { id: 'm6', conversationId: 'conv1', text: 'Let me check the relay bridge...', sent: true, timestamp: now - 25 * minute, status: 'delivered' },
        { id: 'm7', conversationId: 'conv1', text: 'Relay is online. We\'re bridging to the downtown mesh island 🌐', sent: true, timestamp: now - 20 * minute, status: 'delivered' },
        { id: 'm8', conversationId: 'conv1', text: 'That\'s amazing. Full coverage from here to downtown, all encrypted', sent: false, timestamp: now - 5 * minute, status: 'read' },
        { id: 'm9', conversationId: 'conv1', text: 'The mesh propagation is looking solid across the park 🛜', sent: false, timestamp: now - 2 * minute, status: 'read' },
      ],
    },
    {
      id: 'conv2',
      contact: contacts[1],
      lastMessage: 'Ratchet keys rotated successfully. Session is fresh',
      lastTime: now - 15 * minute,
      unread: 0,
      messages: [
        { id: 'm10', conversationId: 'conv2', text: 'I just verified your safety number via QR. We\'re confirmed E2EE ✅', sent: true, timestamp: now - 2 * hour, status: 'read' },
        { id: 'm11', conversationId: 'conv2', text: 'Verified on my end too. The double ratchet is working perfectly', sent: false, timestamp: now - 1.5 * hour, status: 'read' },
        { id: 'm12', conversationId: 'conv2', text: 'I sent a test message through 4 hops — decrypted perfectly on your end?', sent: true, timestamp: now - hour, status: 'read' },
        { id: 'm13', conversationId: 'conv2', text: 'Yep, came through clean. The out-of-order handling with skipped message keys is working great', sent: false, timestamp: now - 50 * minute, status: 'read' },
        { id: 'm14', conversationId: 'conv2', text: 'Ratchet keys rotated successfully. Session is fresh', sent: false, timestamp: now - 15 * minute, status: 'read' },
      ],
    },
    {
      id: 'conv3',
      contact: contacts[2],
      lastMessage: 'Will be back online when I get to the venue',
      lastTime: now - 3 * hour,
      unread: 0,
      messages: [
        { id: 'm15', conversationId: 'conv3', text: 'Hey Priya, are you coming to the mesh testing session?', sent: true, timestamp: now - 5 * hour, status: 'delivered' },
        { id: 'm16', conversationId: 'conv3', text: 'Yes! But I\'m on the subway right now, no connectivity', sent: false, timestamp: now - 4 * hour, status: 'read' },
        { id: 'm17', conversationId: 'conv3', text: 'No worries, the store-and-forward queue will hold your messages', sent: true, timestamp: now - 3.5 * hour, status: 'delivered' },
        { id: 'm18', conversationId: 'conv3', text: 'Will be back online when I get to the venue', sent: false, timestamp: now - 3 * hour, status: 'read' },
      ],
    },
    {
      id: 'conv4',
      contact: contacts[3],
      lastMessage: 'Wi-Fi Direct throughput: 12 MB/s — way faster than BLE 🚀',
      lastTime: now - 8 * minute,
      unread: 1,
      messages: [
        { id: 'm19', conversationId: 'conv4', text: 'Diego, I need to send you the updated firmware. It\'s 2MB', sent: true, timestamp: now - 20 * minute, status: 'read' },
        { id: 'm20', conversationId: 'conv4', text: 'BLE will fragment that into like 12,000 pieces. Let me upgrade us to Wi-Fi Direct', sent: false, timestamp: now - 18 * minute, status: 'read' },
        { id: 'm21', conversationId: 'conv4', text: 'Good call. Negotiating Wi-Fi Direct link over BLE...', sent: true, timestamp: now - 15 * minute, status: 'read' },
        { id: 'm22', conversationId: 'conv4', text: 'Wi-Fi Direct throughput: 12 MB/s — way faster than BLE 🚀', sent: false, timestamp: now - 8 * minute, status: 'read' },
      ],
    },
    {
      id: 'conv5',
      contact: contacts[4],
      lastMessage: 'DataChannel is up. Latency looks great from here',
      lastTime: now - 30 * minute,
      unread: 0,
      messages: [
        { id: 'm23', conversationId: 'conv5', text: 'Testing WebRTC DataChannel from the web app', sent: true, timestamp: now - 45 * minute, status: 'read', transport: 'webrtc' },
        { id: 'm24', conversationId: 'conv5', text: 'I see the SDP offer. Negotiating DTLS...', sent: false, timestamp: now - 43 * minute, status: 'read' },
        { id: 'm25', conversationId: 'conv5', text: 'DataChannel is up. Latency looks great from here', sent: false, timestamp: now - 30 * minute, status: 'read' },
      ],
    },
    {
      id: 'conv6',
      contact: contacts[5],
      lastMessage: 'Message queued — 4 hops estimated when back online',
      lastTime: now - 6 * hour,
      unread: 0,
      messages: [
        { id: 'm26', conversationId: 'conv6', text: 'Yuki, checking in — are you still at the mountain camp?', sent: true, timestamp: now - 8 * hour, status: 'sent' },
        { id: 'm27', conversationId: 'conv6', text: 'Message queued — 4 hops estimated when back online', sent: true, timestamp: now - 6 * hour, status: 'pending' },
      ],
    },
    {
      id: 'conv7',
      contact: contacts[6],
      lastMessage: 'Relay federation is the next big step',
      lastTime: now - hour,
      unread: 0,
      messages: [
        { id: 'm28', conversationId: 'conv7', text: 'The relay server just bridged two mesh islands across continents', sent: false, timestamp: now - 2 * hour, status: 'read' },
        { id: 'm29', conversationId: 'conv7', text: 'Sealed sender is working — the relay can\'t even see who sent it', sent: true, timestamp: now - 1.5 * hour, status: 'read' },
        { id: 'm30', conversationId: 'conv7', text: 'Relay federation is the next big step', sent: false, timestamp: now - hour, status: 'read' },
      ],
    },
  ];
}

export function generateDemoMeshNodes(): DemoMeshNode[] {
  return [
    { id: 'n1', nodeId: randomHex(16), displayId: 'A3F2 81C0', transport: 'ble', batteryClass: 'high', hopCount: 0, rssi: -42, relayCapable: false, x: 50, y: 50 },
    { id: 'n2', nodeId: randomHex(16), displayId: 'E7D1 0B5A', transport: 'ble', batteryClass: 'normal', hopCount: 1, rssi: -65, relayCapable: false, x: 30, y: 30 },
    { id: 'n3', nodeId: randomHex(16), displayId: '92BC 4F17', transport: 'wifi', batteryClass: 'mains', hopCount: 1, relayCapable: true, x: 70, y: 25 },
    { id: 'n4', nodeId: randomHex(16), displayId: '1D8A E3C9', transport: 'relay', batteryClass: 'mains', hopCount: 0, relayCapable: true, x: 85, y: 50 },
    { id: 'n5', nodeId: randomHex(16), displayId: '5C40 72DE', transport: 'ble', batteryClass: 'low', hopCount: 2, rssi: -78, relayCapable: false, x: 20, y: 65 },
    { id: 'n6', nodeId: randomHex(16), displayId: 'F6B3 9A25', transport: 'webrtc', batteryClass: 'ephemeral', hopCount: 0, relayCapable: false, x: 75, y: 75 },
    { id: 'n7', nodeId: randomHex(16), displayId: '0E97 D4F8', transport: 'ble', batteryClass: 'normal', hopCount: 3, rssi: -85, relayCapable: false, x: 15, y: 40 },
    { id: 'n8', nodeId: randomHex(16), displayId: 'B2C1 6E3D', transport: 'wifi', batteryClass: 'high', hopCount: 1, relayCapable: true, x: 55, y: 80 },
  ];
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  if (diff < 24 * hour) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * 24 * hour) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
