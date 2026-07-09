import React from 'react';
import { useMeshStore } from '../../store/meshStore';
import { Avatar } from '../common/Avatar';
import { MeshStatus } from '../mesh/MeshStatus';
import { formatTime } from '../../lib/demo';

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
    meshPanelOpen,
    toggleMeshPanel,
  } = useMeshStore();

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1>MeshQ</h1>
        <button
          className="icon-btn"
          onClick={toggleMeshPanel}
          title="Toggle mesh network panel"
          id="toggle-mesh-panel-btn"
          style={meshPanelOpen ? { color: 'var(--mesh)', background: 'var(--mesh-soft)' } : {}}
        >
          <NetworkIcon />
        </button>
      </div>

      {/* Mesh Panel (collapsible) */}
      {meshPanelOpen && (
        <div style={{ borderBottom: '1px solid var(--border-subtle)', maxHeight: '50vh', overflowY: 'auto' }}>
          <MeshStatus
            nodes={meshNodes}
            relayConnected={relayConnected}
            ownNodeId={ownNodeId}
          />
        </div>
      )}

      {/* Search */}
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          id="conversation-search-input"
        />
      </div>

      {/* Conversation List */}
      <div className="conversation-list">
        {filtered.map((conv, i) => (
          <div
            key={conv.id}
            className={`conversation-item ${conv.id === activeConversationId ? 'active' : ''}`}
            onClick={() => setActiveConversation(conv.id)}
            style={{ animationDelay: `${i * 40}ms` }}
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
              <div className="conversation-name">{conv.contact.name}</div>
              <div className="conversation-preview">{conv.lastMessage}</div>
            </div>
            <div className="conversation-meta">
              <span className="conversation-time">{formatTime(conv.lastTime)}</span>
              {conv.unread > 0 && (
                <span className="unread-badge">{conv.unread}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mesh Status Bar */}
      <div className="mesh-status-bar">
        <div className="mesh-indicator">
          <span className={`mesh-dot ${relayConnected ? 'connected' : 'disconnected'}`} />
          <span>Relay</span>
        </div>
        <div className="mesh-indicator">
          <span className="mesh-dot connected" />
          <span>{meshNodes.filter((n) => n.hopCount <= 1).length} peers</span>
        </div>
        <div className="mesh-indicator" style={{ marginLeft: 'auto' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {ownNodeId.substring(0, 8)}
          </span>
        </div>
      </div>
    </div>
  );
}
