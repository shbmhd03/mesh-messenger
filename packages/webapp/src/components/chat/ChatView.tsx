import React, { useRef, useEffect, useState } from 'react';
import { useMeshStore } from '../../store/meshStore';
import { Avatar } from '../common/Avatar';
import { SafetyNumber } from '../common/SafetyNumber';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { GroupInfoDrawer } from '../group/GroupInfoDrawer';

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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function ChatView() {
  const {
    conversations, activeConversationId, sendMessage,
    safetyNumberContactId, showSafetyNumber, verifyContact,
    setActiveConversation, sendChatRequest, acceptChatRequest, declineChatRequest,
    groupInfoDrawerOpen, setGroupInfoDrawerOpen,
    deleteMessageForMe, deleteMessageForEveryone
  } = useMeshStore();

  const [activeCallType, setActiveCallType] = useState<'voice' | 'video' | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [inChatSearch, setInChatSearch] = useState('');
  const [showInChatSearch, setShowInChatSearch] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<any>(null);

  const conversation = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  // Call timer effect
  useEffect(() => {
    if (activeCallType) {
      setCallSeconds(0);
      callTimerRef.current = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCallType]);

  if (!conversation) {
    return (
      <div className="main-area whatsapp-theme">
        <div className="empty-state">
          <div className="empty-state-icon-wrapper">
            <img src="/meshq-main-logo.png" alt="MeshQ Main Logo" className="empty-state-main-logo" />
          </div>
          <img src="/meshq-text-logo.png" alt="MeshQ" className="empty-state-text-logo" />
          <p className="empty-state-desc">
            Send and receive end-to-end encrypted peer-to-peer messages across the mesh network without internet tracking.
          </p>
          <div className="empty-state-privacy-badge">
            🔒 End-to-End Encrypted & Zero-Knowledge
          </div>
        </div>
      </div>
    );
  }

  const { contact, messages } = conversation;

  const filteredMessages = inChatSearch
    ? messages.filter((m) => m.text.toLowerCase().includes(inChatSearch.toLowerCase()))
    : messages;

  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="main-area whatsapp-theme">
      {/* WhatsApp / Telegram Style Chat Header */}
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
          initials={conversation.isGroup ? '👥' : contact.initials}
          color={contact.color}
          size="sm"
          online={contact.online}
        />

        <div
          className="chat-header-info"
          onClick={() => conversation.isGroup && setGroupInfoDrawerOpen(true)}
          style={{ cursor: conversation.isGroup ? 'pointer' : 'default' }}
        >
          <div className="chat-header-name">
            {conversation.isGroup ? (conversation.groupName || contact.name) : contact.name}
          </div>
          <div className="chat-header-status">
            {conversation.isGroup ? (
              <span>
                {conversation.members?.length || 0} members
                {conversation.members && conversation.members.length > 0 && (
                  `: ${conversation.members.map((m) => m.name).slice(0, 3).join(', ')}${conversation.members.length > 3 ? '...' : ''}`
                )}
              </span>
            ) : (
              <>
                <span
                  className={`mesh-dot ${contact.online ? 'connected' : 'disconnected'}`}
                  style={{ width: 6, height: 6 }}
                />
                {contact.online
                  ? `online - ${contact.hopCount === 0 ? 'Direct' : `${contact.hopCount} hops`} (${contact.transport.toUpperCase()})`
                  : 'offline - queued via Convex cloud'}
              </>
            )}
          </div>
        </div>

        {/* WhatsApp Header Action Buttons */}
        <div className="chat-header-actions">
          {conversation.isGroup && (
            <button
              className="icon-btn"
              title="Group Info & Member Management"
              onClick={() => setGroupInfoDrawerOpen(true)}
              id="group-info-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </button>
          )}

          <button
            className="icon-btn"
            title="Start Encrypted Voice Call"
            onClick={() => setActiveCallType('voice')}
            id="start-voice-call-btn"
          >
            <PhoneIcon />
          </button>
          
          <button
            className="icon-btn"
            title="Start Encrypted Video Call"
            onClick={() => setActiveCallType('video')}
            id="start-video-call-btn"
          >
            <VideoIcon />
          </button>

          <button
            className={`icon-btn ${showInChatSearch ? 'active' : ''}`}
            title="Search in chat"
            onClick={() => setShowInChatSearch(!showInChatSearch)}
            id="toggle-in-chat-search-btn"
          >
            <SearchIcon />
          </button>

          {contact.verified && (
            <span className="verified-badge-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11.5 14.5 15.5 10" />
              </svg>
              Verified
            </span>
          )}

          {!conversation.isGroup && (
            <button
              className="icon-btn"
              title="Verify safety number key"
              id="verify-safety-number-btn"
              onClick={() => showSafetyNumber(contact.id)}
              style={contact.verified ? { color: 'var(--success)' } : {}}
            >
              <ShieldIcon />
            </button>
          )}
        </div>
      </div>

      {/* In-Chat Search Bar Dropdown */}
      {showInChatSearch && (
        <div className="in-chat-search-bar">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search messages in this chat..."
            value={inChatSearch}
            onChange={(e) => setInChatSearch(e.target.value)}
            autoFocus
          />
          {inChatSearch && (
            <button className="clear-search-btn" onClick={() => setInChatSearch('')}>✕</button>
          )}
        </div>
      )}

      {/* Voice / Video Call Fullscreen Overlay Modal */}
      {activeCallType && (
        <div className="call-modal-overlay">
          <div className="call-card">
            <div className="call-avatar-pulse">
              <Avatar initials={contact.initials} color={contact.color} size="lg" />
              <div className="pulse-ring ring1"></div>
              <div className="pulse-ring ring2"></div>
            </div>

            <h2 className="call-contact-name">{contact.name}</h2>
            <p className="call-status">
              {callSeconds < 3 ? 'Connecting E2EE Peer Audio...' : `Mesh Voice Call • ${formatCallTime(callSeconds)}`}
            </p>

            <div className="call-soundwaves">
              <span></span><span></span><span></span><span></span><span></span>
            </div>

            <div className="call-actions">
              <button className="call-end-btn" onClick={() => setActiveCallType(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stealth Authorization Request / Active Messages Area */}
      {contact.chatStatus === 'waiting_approval' ? (
        <div className="messages-container wallpaper-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div className="messages-container wallpaper-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <div className="messages-container wallpaper-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          {/* Main Messages Scroll Container with WhatsApp Wallpaper */}
          <div className="messages-container wallpaper-bg" ref={containerRef}>
            <div className="date-separator">
              <span>🔒 Messages and calls are end-to-end encrypted</span>
            </div>

            {filteredMessages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                text={msg.text}
                sent={msg.sent}
                timestamp={msg.timestamp}
                status={msg.status}
                transport={msg.transport}
                animDelay={i * 20}
                senderName={msg.senderName}
                onDeleteForMe={(msgId) => deleteMessageForMe(conversation.id, msgId)}
                onDeleteForEveryone={(msgId) => deleteMessageForEveryone(conversation.id, msgId)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
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

      {/* Group Info & Admin Management Drawer */}
      <GroupInfoDrawer
        conversation={conversation}
        isOpen={groupInfoDrawerOpen}
        onClose={() => setGroupInfoDrawerOpen(false)}
      />
    </div>
  );
}
