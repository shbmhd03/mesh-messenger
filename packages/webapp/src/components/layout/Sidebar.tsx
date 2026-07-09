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
    ownDisplayName,
    setOwnDisplayName,
    stealthMode,
    setStealthMode,
    connectToPeerById,
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

      {/* User Profile Info & Custom Nickname Input */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.01)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: stealthMode ? 'var(--text-tertiary)' : 'var(--accent)', boxShadow: stealthMode ? 'none' : '0 0 6px var(--accent)' }}></div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>My Profile</span>
          </div>
          <button
            onClick={() => setStealthMode(!stealthMode)}
            style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 'bold',
              background: stealthMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--accent-soft)',
              color: stealthMode ? 'var(--text-secondary)' : 'var(--accent)',
              border: '1px solid ' + (stealthMode ? 'var(--border-subtle)' : 'var(--accent)'),
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Toggle Stealth Mode. When Stealth is ON, you are completely hidden from other peers' online lists."
            id="stealth-mode-btn"
          >
            <svg style={{ width: 10, height: 10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
            </svg>
            {stealthMode ? 'Stealth ON' : 'Stealth OFF'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
            ME
          </div>
          <input
            type="text"
            value={ownDisplayName}
            onChange={(e) => setOwnDisplayName(e.target.value)}
            placeholder="Set your name..."
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, outline: 'none', padding: '2px 0' }}
            title="Edit your nickname. Other peers will see this name on their screens when you chat with them."
            id="own-display-name-input"
          />
        </div>
      </div>

      {/* Connect by Peer ID / Code */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.005)' }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Private Chat Bridge</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = document.getElementById('peer-id-connect-input') as HTMLInputElement;
            if (input && input.value.trim()) {
              const success = connectToPeerById(input.value.trim());
              if (success) input.value = '';
            }
          }}
          style={{ display: 'flex', gap: 'var(--space-2)' }}
        >
          <input
            type="text"
            id="peer-id-connect-input"
            placeholder="Enter Unique Peer ID Code..."
            maxLength={8}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '12px',
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-mono)'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
            id="peer-id-connect-submit-btn"
          >
            Connect
          </button>
        </form>
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
