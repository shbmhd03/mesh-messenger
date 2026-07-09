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
    setActiveConversation, sendChatRequest, acceptChatRequest, declineChatRequest
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
          <h2 className="empty-state-title">MeshQ</h2>
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
        <button
          className="mobile-back-btn"
          onClick={() => setActiveConversation(null)}
          title="Back to conversation list"
          id="mobile-back-to-list-btn"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
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

      {/* Conditional rendering based on Stealth Request Authorization Status */}
      {contact.chatStatus === 'waiting_approval' ? (
        <div className="messages-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', maxWidth: '360px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
            <div style={{ width: 48, height: 48, background: 'var(--accent-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--accent)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Stealth Lock Active</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              This peer is in Stealth Mode or Offline. You must send a verification invite to request a secure private chat.
            </p>
            <button
              onClick={() => sendChatRequest(contact.id)}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', width: '100%' }}
              id="send-chat-request-btn"
            >
              Send Chat Request
            </button>
          </div>
        </div>
      ) : contact.chatStatus === 'waiting_approval_sent' ? (
        <div className="messages-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', maxWidth: '360px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
            <div style={{ width: 48, height: 48, background: 'var(--mesh-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--mesh)' }}>
              <svg style={{ animation: 'spin 3s linear infinite' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Waiting for Approval</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Your connection request was sent. The chat will unlock automatically once they accept your invite.
            </p>
          </div>
        </div>
      ) : contact.chatStatus === 'requested' ? (
        <div className="messages-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', maxWidth: '360px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
            <div style={{ width: 48, height: 48, background: 'var(--success-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--success)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Chat Connection Request</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              <strong>{contact.name}</strong> wants to connect and chat privately. Do you accept this connection?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => acceptChatRequest(contact.id)}
                style={{ flex: 1, padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: 'var(--success)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                id="accept-chat-request-btn"
              >
                Accept
              </button>
              <button
                onClick={() => declineChatRequest(contact.id)}
                style={{ flex: 1, padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                id="decline-chat-request-btn"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}

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
