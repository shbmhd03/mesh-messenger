import React, { useEffect, useRef, useState } from 'react';
import { useMeshStore } from '../../store/meshStore';
import { Avatar } from '../common/Avatar';

function formatCallTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function ActiveCallModal() {
  const { activeCall, endCall, toggleCallMute, toggleCallCamera } = useMeshStore();
  const [seconds, setSeconds] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let timer: any = null;
    if (activeCall && activeCall.status === 'connected') {
      timer = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  useEffect(() => {
    if (localVideoRef.current && activeCall?.localStream) {
      localVideoRef.current.srcObject = activeCall.localStream;
    }
  }, [activeCall?.localStream, activeCall?.isCameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current && activeCall?.remoteStream) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall?.remoteStream]);

  if (!activeCall) return null;

  const isVideo = activeCall.callType === 'video';

  return (
    <div className="call-modal-overlay">
      <div className={`call-card active-call-card ${isVideo ? 'video-mode' : 'voice-mode'}`}>
        {/* Video Containers */}
        {isVideo ? (
          <div className="call-video-grid">
            <div className="remote-video-wrapper">
              {activeCall.remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="remote-video-feed" />
              ) : (
                <div className="video-placeholder">
                  <Avatar initials={activeCall.peerName.substring(0, 2).toUpperCase()} color="var(--accent)" size="lg" />
                  <p className="connecting-text">Waiting for remote video feed...</p>
                </div>
              )}
            </div>

            <div className="local-video-pip">
              {!activeCall.isCameraOff && activeCall.localStream ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="local-video-feed" />
              ) : (
                <div className="pip-off-placeholder">Camera Off</div>
              )}
            </div>
          </div>
        ) : (
          /* Voice Only Container */
          <div className="voice-call-content">
            <div className="call-avatar-pulse">
              <Avatar initials={activeCall.peerName.substring(0, 2).toUpperCase()} color="var(--accent)" size="lg" />
              {activeCall.status === 'connected' && (
                <>
                  <div className="pulse-ring ring1"></div>
                  <div className="pulse-ring ring2"></div>
                </>
              )}
            </div>

            <h2 className="call-contact-name">{activeCall.peerName}</h2>
            <p className="call-status">
              {activeCall.status === 'ringing'
                ? 'Ringing... Establishing P2P E2EE Connection'
                : `Connected • ${formatCallTime(seconds)}`}
            </p>

            {activeCall.status === 'connected' && (
              <div className="call-soundwaves">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            )}
          </div>
        )}

        {/* Floating Call Bar Controls */}
        <div className="active-call-controls">
          <button
            className={`control-btn ${activeCall.isMuted ? 'active-red' : ''}`}
            onClick={toggleCallMute}
            title={activeCall.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {activeCall.isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-3-2V5c0-1.66-1.34-3-3-3S10 3.34 10 5v1.7l6 6V9zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l2.18 2.18L19 17.73 4.27 3z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
              </svg>
            )}
          </button>

          {isVideo && (
            <button
              className={`control-btn ${activeCall.isCameraOff ? 'active-red' : ''}`}
              onClick={toggleCallCamera}
              title={activeCall.isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {activeCall.isCameraOff ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82l8 8H18c.55 0 1-.45 1-1v-3.5l4 4v-11l-2 2zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18l2.19 2.19L20 20.73 3.27 2z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              )}
            </button>
          )}

          <button className="call-end-btn" onClick={endCall} title="End Call">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
