import React from 'react';
import { useMeshStore } from '../../store/meshStore';
import { Avatar } from '../common/Avatar';

export function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall } = useMeshStore();

  if (!incomingCall) return null;

  return (
    <div className="call-modal-overlay">
      <div className="call-card incoming-card">
        <div className="call-avatar-pulse">
          <Avatar initials={incomingCall.callerName.substring(0, 2).toUpperCase()} color="var(--accent)" size="lg" />
          <div className="pulse-ring ring1"></div>
          <div className="pulse-ring ring2"></div>
        </div>

        <h2 className="call-contact-name">{incomingCall.callerName}</h2>
        <p className="call-status highlight">
          Incoming P2P {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call...
        </p>

        <div className="incoming-call-actions">
          <button className="call-action-btn accept" onClick={acceptCall} title="Accept Call">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
            </svg>
            <span>Accept</span>
          </button>

          <button className="call-action-btn reject" onClick={rejectCall} title="Decline Call">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
            <span>Decline</span>
          </button>
        </div>
      </div>
    </div>
  );
}
