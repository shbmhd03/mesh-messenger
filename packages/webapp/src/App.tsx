import React, { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { ChatView } from './components/chat/ChatView';
import { useRelay } from './hooks/useRelay';
import { useMeshStore } from './store/meshStore';

export default function App() {
  const { sendPacket } = useRelay();
  const registerSendHandler = useMeshStore((state) => state.registerSendHandler);

  const hasActiveConversation = useMeshStore((state) => state.activeConversationId !== null);

  useEffect(() => {
    // Bind the Zustand store to the active WebSocket sendPacket transport
    registerSendHandler(sendPacket);
  }, [sendPacket, registerSendHandler]);

  return (
    <div className={`app-shell ${hasActiveConversation ? 'has-active-chat' : ''}`}>
      <Sidebar />
      <ChatView />
    </div>
  );
}
