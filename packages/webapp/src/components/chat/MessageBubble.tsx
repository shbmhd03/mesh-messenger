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
}

export function MessageBubble({ text, sent, timestamp, status, transport, animDelay = 0 }: MessageBubbleProps) {
  return (
    <div
      className={`message-group ${sent ? 'sent' : 'received'}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className={`message-bubble ${sent ? 'sent' : 'received'}`}>
        {text}
      </div>
      <div className="message-footer">
        {transport && (
          <span className={`mesh-node-transport ${transport}`} style={{ fontSize: '10px' }}>
            {transport.toUpperCase()}
          </span>
        )}
        <span className="message-time">{formatMessageTime(timestamp)}</span>
        {sent && <DeliveryBadge status={status} />}
      </div>
    </div>
  );
}
