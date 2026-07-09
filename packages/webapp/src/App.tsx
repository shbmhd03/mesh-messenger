import React, { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { ChatView } from './components/chat/ChatView';
import { useRelay } from './hooks/useRelay';
import { useMeshStore } from './store/meshStore';

export default function App() {
  const { sendPacket } = useRelay();
  const registerSendHandler = useMeshStore((state) => state.registerSendHandler);

  const hasActiveConversation = useMeshStore((state) => state.activeConversationId !== null);
  const activeConversationId = useMeshStore((state) => state.activeConversationId);
  const setActiveConversation = useMeshStore((state) => state.setActiveConversation);

  useEffect(() => {
    // Bind the Zustand store to the active WebSocket sendPacket transport
    registerSendHandler(sendPacket);
  }, [sendPacket, registerSendHandler]);

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

  return (
    <div className={`app-shell ${hasActiveConversation ? 'has-active-chat' : ''}`}>
      <Sidebar />
      <ChatView />
    </div>
  );
}
