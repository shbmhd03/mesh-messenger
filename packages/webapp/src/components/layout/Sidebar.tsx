import React, { useState } from 'react';
import { useMeshStore } from '../../store/meshStore';
import { Avatar } from '../common/Avatar';
import { MeshStatus } from '../mesh/MeshStatus';
import { formatTime } from '../../lib/demo';
import { QRCodeModal } from '../qr/QRCodeModal';
import { CreateGroupModal } from '../group/CreateGroupModal';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function NetworkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="16" y="2" width="6" height="6" rx="1" />
      <rect x="9" y="16" width="6" height="6" rx="1" />
      <path d="M5 8v2a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V8" />
      <line x1="12" y1="14" x2="12" y2="16" />
    </svg>
  );
}

function SingleCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    searchQuery,
    setSearchQuery,
    meshNodes,
    relayConnected,
    ownNodeId,
    ownDisplayName,
    setOwnDisplayName,
    stealthMode,
    setStealthMode,
    connectToPeerById,
    meshPanelOpen,
    toggleMeshPanel,
    qrModalOpen,
    setQrModalOpen,
    createGroupModalOpen,
    setCreateGroupModalOpen,
    theme,
    toggleTheme,
  } = useMeshStore();

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'online' | 'bridge'>('all');
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  // Filter conversations according to search and active tab
  let filtered = conversations;

  if (activeTab === 'unread') {
    filtered = filtered.filter((c) => c.unread > 0);
  } else if (activeTab === 'online') {
    filtered = filtered.filter((c) => c.contact.online);
  }

  if (searchQuery.trim()) {
    filtered = filtered.filter((c) =>
      c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const unreadTotal = conversations.reduce((acc, c) => acc + c.unread, 0);

  return (
    <div className="sidebar whatsapp-theme">
      {/* WhatsApp / Telegram Style Sidebar Header */}
      <div className="sidebar-header">
        <div className="header-left-profile" onClick={() => setShowProfileDrawer(!showProfileDrawer)} title="Open Profile Settings">
          <Avatar initials={ownDisplayName.substring(0, 2).toUpperCase()} color="var(--accent)" size="sm" />
          <img src="/meshq-text-logo.png" alt="MeshQ" className="header-logo-img" />
        </div>

        <div className="sidebar-header-actions">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            id="theme-toggle-btn"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          <button
            className="icon-btn"
            onClick={() => setQrModalOpen(true)}
            title="My QR Code & Scan Peer QR Code"
            id="qr-code-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>

          <button
            className="icon-btn"
            onClick={() => setCreateGroupModalOpen(true)}
            title="Create New Group Chat"
            id="create-group-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>

          <button
            onClick={() => setStealthMode(!stealthMode)}
            className={`stealth-toggle-pill ${stealthMode ? 'stealth-on' : 'stealth-off'}`}
            title="Toggle Stealth Mode. When Stealth is ON, you vanish from public peer maps."
            id="stealth-mode-btn"
          >
            <span className="stealth-dot"></span>
            {stealthMode ? 'Stealth ON' : 'Stealth OFF'}
          </button>

          <button
            className="icon-btn"
            onClick={toggleMeshPanel}
            title="Toggle Mesh Network Topology Map"
            id="toggle-mesh-panel-btn"
            style={meshPanelOpen ? { color: 'var(--mesh)', background: 'var(--mesh-soft)' } : {}}
          >
            <NetworkIcon />
          </button>
        </div>
      </div>

      {/* User Quick Profile Edit Drawer */}
      {showProfileDrawer && (
        <div className="profile-edit-card">
          <div className="profile-card-header">
            <span>My Profile & Identity</span>
            <button className="close-profile-btn" onClick={() => setShowProfileDrawer(false)}>✕</button>
          </div>
          <div className="profile-input-row">
            <label htmlFor="own-display-name-input">Display Name:</label>
            <input
              type="text"
              value={ownDisplayName}
              onChange={(e) => setOwnDisplayName(e.target.value)}
              placeholder="Set your name..."
              id="own-display-name-input"
            />
          </div>
          <div className="profile-id-row">
            <span>Unique Peer ID Code:</span>
            <code>{ownNodeId.substring(0, 8)}</code>
          </div>
        </div>
      )}

      {/* Mesh Status Network Topology Drawer */}
      {meshPanelOpen && (
        <div style={{ borderBottom: '1px solid var(--border-subtle)', maxHeight: '50vh', overflowY: 'auto' }}>
          <MeshStatus
            nodes={meshNodes}
            relayConnected={relayConnected}
            ownNodeId={ownNodeId}
          />
        </div>
      )}

      {/* WhatsApp Search Bar */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="conversation-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* WhatsApp / Telegram Filter Tabs */}
      <div className="sidebar-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button
          className={`tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveTab('unread')}
        >
          Unread {unreadTotal > 0 && <span className="tab-badge">{unreadTotal}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'online' ? 'active' : ''}`}
          onClick={() => setActiveTab('online')}
        >
          Online ({meshNodes.filter((n) => n.hopCount <= 1).length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'bridge' ? 'active' : ''}`}
          onClick={() => setActiveTab('bridge')}
        >
          Bridge
        </button>
      </div>

      {/* Private Chat Bridge Form (Shown when Bridge tab is active or manually connected) */}
      {activeTab === 'bridge' && (
        <div className="private-bridge-box">
          <div className="bridge-title">Connect by Unique Peer ID</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = document.getElementById('peer-id-connect-input') as HTMLInputElement;
              if (input && input.value.trim()) {
                const success = connectToPeerById(input.value.trim());
                if (success) {
                  input.value = '';
                  setActiveTab('all');
                }
              }
            }}
            className="bridge-form-row"
          >
            <input
              type="text"
              id="peer-id-connect-input"
              placeholder="Enter Peer ID (e.g. 97E5F61A)..."
              maxLength={8}
            />
            <button type="submit" id="peer-id-connect-submit-btn">
              Connect
            </button>
          </form>
        </div>
      )}

      {/* WhatsApp / Telegram Conversation List */}
      <div className="conversation-list">
        {filtered.length === 0 ? (
          <div className="no-chats-placeholder">
            <p>No conversations found</p>
            {activeTab === 'bridge' ? (
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Enter a 8-character Peer ID to connect</span>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Waiting for peers to join network...</span>
            )}
          </div>
        ) : (
          filtered.map((conv, i) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === activeConversationId ? 'active' : ''}`}
              onClick={() => setActiveConversation(conv.id)}
              style={{ animationDelay: `${i * 30}ms` }}
              id={`conversation-${conv.id}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveConversation(conv.id)}
            >
              <Avatar
                initials={conv.contact.initials}
                color={conv.contact.color}
                online={conv.contact.online}
              />

              <div className="conversation-info">
                <div className="conversation-name-row">
                  <span className="conversation-name">{conv.contact.name}</span>
                  {conv.contact.verified && (
                    <span className="mini-verified-icon" title="Verified Contact Key">✓</span>
                  )}
                </div>
                <div className="conversation-preview">
                  {conv.messages.length > 0 && conv.messages[conv.messages.length - 1].sent && (
                    <SingleCheckIcon />
                  )}
                  <span>{conv.lastMessage || 'Connected'}</span>
                </div>
              </div>

              <div className="conversation-meta">
                <span className="conversation-time">{formatTime(conv.lastTime)}</span>
                {conv.unread > 0 && (
                  <span className="unread-badge">{conv.unread}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* WhatsApp Bottom Network Bar */}
      <div className="mesh-status-bar">
        <div className="mesh-indicator">
          <span className={`mesh-dot ${relayConnected ? 'connected' : 'disconnected'}`} />
          <span>{relayConnected ? 'Relay Active' : 'Connecting...'}</span>
        </div>
        <div className="mesh-indicator">
          <span className="mesh-dot connected" />
          <span>{meshNodes.filter((n) => n.hopCount <= 1).length} peers online</span>
        </div>
      </div>

      {/* QR Code Invite & Scanner Modal */}
      <QRCodeModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} />

      {/* Create New Group Modal */}
      <CreateGroupModal isOpen={createGroupModalOpen} onClose={() => setCreateGroupModalOpen(false)} />
    </div>
  );
}
