import React from 'react';
import { formatMessageTime } from '../../lib/demo';
import { DeliveryBadge } from './DeliveryBadge';

interface MessageBubbleProps {
  text: string;
  sent: boolean;
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  transport?: string;
  animDelay?: number;
  senderName?: string;
}

export function MessageBubble({ text, sent, timestamp, status, transport, animDelay = 0, senderName }: MessageBubbleProps) {
  return (
    <div
      className={`message-row ${sent ? 'sent' : 'received'}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className={`message-bubble ${sent ? 'sent' : 'received'}`}>
        {/* Tail SVG */}
        <svg className={`bubble-tail ${sent ? 'sent' : 'received'}`} viewBox="0 0 8 13" width="8" height="13">
          {sent ? (
            <path d="M0,0 C3,0 8,4 8,8 C8,10 6,13 0,13 L0,0 Z" fill="currentColor" />
          ) : (
            <path d="M8,0 C5,0 0,4 0,8 C0,10 2,13 8,13 L8,0 Z" fill="currentColor" />
          )}
        </svg>

        {!sent && senderName && (
          <div className="group-sender-header">{senderName}</div>
        )}

        <span className="message-content-text">{text}</span>
        
        {/* In-bubble WhatsApp/Telegram style timestamp & delivery badge */}
        <span className="message-meta-inline">
          {transport && (
            <span className={`mesh-node-transport-pill ${transport}`}>
              {transport.toUpperCase()}
            </span>
          )}
          <span className="message-time">{formatMessageTime(timestamp)}</span>
          {sent && <DeliveryBadge status={status} />}
        </span>
      </div>
    </div>
  );
}

