import React, { useState, useRef, useEffect } from 'react';
import { formatMessageTime } from '../../lib/demo';
import { DeliveryBadge } from './DeliveryBadge';

interface MessageBubbleProps {
  id: string;
  text: string;
  sent: boolean;
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  transport?: string;
  animDelay?: number;
  senderName?: string;
  onDeleteForMe?: (id: string) => void;
  onDeleteForEveryone?: (id: string) => void;
}

export function MessageBubble({
  id,
  text,
  sent,
  timestamp,
  status,
  transport,
  animDelay = 0,
  senderName,
  onDeleteForMe,
  onDeleteForEveryone,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isDeleted = text === '🚫 This message was deleted';

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div
      className={`message-row ${sent ? 'sent' : 'received'}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className={`message-bubble ${sent ? 'sent' : 'received'} ${isDeleted ? 'deleted' : ''}`}>
        {/* Tail SVG */}
        <svg className={`bubble-tail ${sent ? 'sent' : 'received'}`} viewBox="0 0 8 13" width="8" height="13">
          {sent ? (
            <path d="M0,0 C3,0 8,4 8,8 C8,10 6,13 0,13 L0,0 Z" fill="currentColor" />
          ) : (
            <path d="M8,0 C5,0 0,4 0,8 C0,10 2,13 8,13 L8,0 Z" fill="currentColor" />
          )}
        </svg>

        {/* Hover Action Menu Trigger */}
        {!isDeleted && (
          <div className="bubble-menu-wrapper" ref={menuRef}>
            <button
              className="bubble-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              title="Message options"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {showMenu && (
              <div className="bubble-context-menu">
                <button
                  className="menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    onDeleteForMe?.(id);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete for me
                </button>

                {sent && (
                  <button
                    className="menu-item danger"
                    onClick={() => {
                      setShowMenu(false);
                      onDeleteForEveryone?.(id);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete for everyone
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!sent && senderName && (
          <div className="group-sender-header">{senderName}</div>
        )}

        <span className={`message-content-text ${isDeleted ? 'italic' : ''}`}>{text}</span>
        
        {/* In-bubble WhatsApp/Telegram style timestamp & delivery badge */}
        <span className="message-meta-inline">
          {transport && (
            <span className={`mesh-node-transport-pill ${transport}`}>
              {transport.toUpperCase()}
            </span>
          )}
          <span className="message-time">{formatMessageTime(timestamp)}</span>
          {sent && !isDeleted && <DeliveryBadge status={status} />}
        </span>
      </div>
    </div>
  );
}

