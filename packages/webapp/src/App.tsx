import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { ChatView } from './components/chat/ChatView';
import { useRelay } from './hooks/useRelay';
import { useMeshStore } from './store/meshStore';
import { IncomingCallModal } from './components/call/IncomingCallModal';
import { ActiveCallModal } from './components/call/ActiveCallModal';

export default function App() {
  const { sendPacket } = useRelay();
  const registerSendHandler = useMeshStore((state) => state.registerSendHandler);

  const hasActiveConversation = useMeshStore((state) => state.activeConversationId !== null);
  const activeConversationId = useMeshStore((state) => state.activeConversationId);
  const setActiveConversation = useMeshStore((state) => state.setActiveConversation);
  
  const ownDisplayName = useMeshStore((state) => state.ownDisplayName);
  const setOwnDisplayName = useMeshStore((state) => state.setOwnDisplayName);

  // Check if display name has been set previously in localStorage
  const [showNameModal, setShowNameModal] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('meshq_display_name');
    }
    return true;
  });

  const [inputName, setInputName] = useState('');

  useEffect(() => {
    // Bind the Zustand store to the active WebSocket sendPacket transport
    registerSendHandler(sendPacket);
  }, [sendPacket, registerSendHandler]);

  useEffect(() => {
    // If name is saved in localStorage, sync it to the Zustand store immediately
    const savedName = localStorage.getItem('meshq_display_name');
    if (savedName) {
      setOwnDisplayName(savedName);
    }
  }, [setOwnDisplayName]);

  useEffect(() => {
    // Aggressively clear unread indicators and send read receipts when focusing the browser tab
    const handleFocus = () => {
      if (activeConversationId) {
        setActiveConversation(activeConversationId);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeConversationId, setActiveConversation]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      setOwnDisplayName(inputName.trim());
      localStorage.setItem('meshq_display_name', inputName.trim());
      setShowNameModal(false);
    }
  };

  // Render the Welcome Name Entry Screen if not configured yet
  if (showNameModal) {
    return (
      <div className="welcome-overlay">
        <div className="welcome-glow-orb"></div>
        <form onSubmit={handleNameSubmit} className="welcome-card">
          <div className="welcome-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="welcome-title">Welcome to MeshQ</h1>
          <p className="welcome-desc">
            Secure, decentralized peer-to-peer messaging. Enter a display name to join the local network.
          </p>
          <div className="welcome-input-group">
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Enter your name..."
              required
              autoFocus
              maxLength={20}
              id="welcome-name-input"
            />
            <button type="submit" className="welcome-btn">
              Join Chat
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`app-shell ${hasActiveConversation ? 'has-active-chat' : ''}`}>
      <IncomingCallModal />
      <ActiveCallModal />
      <Sidebar />
      <ChatView />
    </div>
  );
}
