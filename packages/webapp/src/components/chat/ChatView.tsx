import React, { useRef, useEffect } from 'react';
import { useMeshStore } from '../../store/meshStore';
import { Avatar } from '../common/Avatar';
import { SafetyNumber } from '../common/SafetyNumber';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function MeshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <circle cx="6" cy="6" r="1.5" />
      <circle cx="18" cy="6" r="1.5" />
      <circle cx="6" cy="18" r="1.5" />
      <circle cx="18" cy="18" r="1.5" />
      <line x1="12" y1="10" x2="7.5" y2="7.5" />
      <line x1="12" y1="10" x2="16.5" y2="7.5" />
      <line x1="12" y1="14" x2="7.5" y2="16.5" />
      <line x1="12" y1="14" x2="16.5" y2="16.5" />
    </svg>
  );
}

export function ChatView() {
  const {
    conversations, activeConversationId, sendMessage,
    safetyNumberContactId, showSafetyNumber, verifyContact,
  } = useMeshStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  if (!conversation) {
    return (
      <div className="main-area">
        <div className="empty-state">
          <div className="empty-state-icon">
            <MeshIcon />
          </div>
          <h2 className="empty-state-title">Mesh Messenger</h2>
          <p className="empty-state-desc">
            Select a conversation to start messaging through the mesh network. All messages are end-to-end encrypted.
          </p>
        </div>
      </div>
    );
  }

  const { contact, messages } = conversation;

  return (
    <div className="main-area">
      {/* Header */}
      <div className="chat-header">
        <Avatar
          initials={contact.initials}
          color={contact.color}
          size="sm"
          online={contact.online}
        />
        <div className="chat-header-info">
          <div className="chat-header-name">{contact.name}</div>
          <div className="chat-header-status">
            <span
              className={`mesh-dot ${contact.online ? 'connected' : 'disconnected'}`}
              style={{ width: 6, height: 6 }}
            />
            {contact.online
              ? `${contact.hopCount === 0 ? 'Direct' : `${contact.hopCount} hop${contact.hopCount > 1 ? 's' : ''}`} via ${contact.transport.toUpperCase()}`
              : 'Offline — messages will be queued'}
          </div>
        </div>
        <div className="chat-header-actions">
          {contact.verified && (
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--success)',
              display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11.5 14.5 15.5 10" />
              </svg>
              Verified
            </span>
          )}
          <button
            className="icon-btn"
            title="Verify safety number"
            id="verify-safety-number-btn"
            onClick={() => showSafetyNumber(contact.id)}
            style={contact.verified ? { color: 'var(--success)' } : {}}
          >
            <ShieldIcon />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" ref={containerRef}>
        {/* E2EE notice */}
        <div className="date-separator">
          <span>🔒 Messages are end-to-end encrypted</span>
        </div>

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            text={msg.text}
            sent={msg.sent}
            timestamp={msg.timestamp}
            status={msg.status}
            transport={msg.transport}
            animDelay={i * 20}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={(text) => sendMessage(conversation.id, text)} />

      {/* Safety Number Modal */}
      {safetyNumberContactId === contact.id && (
        <SafetyNumber
          contactName={contact.name}
          nodeId={contact.nodeId}
          verified={contact.verified}
          onVerify={() => verifyContact(contact.id)}
          onClose={() => showSafetyNumber(null)}
        />
      )}
    </div>
  );
}
