import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

const QUICK_EMOJIS = ['😊', '❤️', '👍', '🔥', '😂', '🙏', '⚡', '🔒', '👋'];

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  // Click outside attach menu handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Voice note timer simulation
  useEffect(() => {
    if (isRecordingVoice) {
      setVoiceSeconds(0);
      timerRef.current = setInterval(() => {
        setVoiceSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecordingVoice]);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText('');
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const handleVoiceSend = () => {
    setIsRecordingVoice(false);
    onSend(`🎙️ Voice message (${voiceSeconds}s)`);
  };

  const handleAttachOption = (label: string) => {
    setShowAttachMenu(false);
    if (label === 'Image') {
      onSend('📷 Shared an encrypted image packet');
    } else if (label === 'Document') {
      onSend('📄 Shared a document file');
    } else if (label === 'Location') {
      onSend('📍 Shared Mesh Node Geo Coordinates: 37.7749° N, 122.4194° W');
    }
  };

  return (
    <div className="chat-input-container">
      {/* Quick Emoji Bar Popup */}
      {showEmojiPicker && (
        <div className="quick-emoji-bar">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-item-btn"
              onClick={() => addEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Voice Recording Overlay */}
      {isRecordingVoice ? (
        <div className="voice-recording-bar">
          <div className="voice-rec-indicator">
            <span className="rec-red-dot"></span>
            <span>Recording voice note... 0:{voiceSeconds < 10 ? `0${voiceSeconds}` : voiceSeconds}</span>
          </div>
          <div className="voice-rec-actions">
            <button type="button" className="voice-cancel-btn" onClick={() => setIsRecordingVoice(false)}>
              Cancel
            </button>
            <button type="button" className="voice-send-btn" onClick={handleVoiceSend}>
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-input-wrapper">
          {/* Emoji Toggle */}
          <button
            type="button"
            className={`input-action-btn ${showEmojiPicker ? 'active' : ''}`}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji reactions"
          >
            <EmojiIcon />
          </button>

          {/* Attachment Toggle */}
          <div className="attach-menu-wrapper" ref={attachMenuRef}>
            <button
              type="button"
              className={`input-action-btn ${showAttachMenu ? 'active' : ''}`}
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              title="Attach media or document"
            >
              <PaperclipIcon />
            </button>

            {/* Attachment Dropdown Popup */}
            {showAttachMenu && (
              <div className="attach-popup-menu">
                <button type="button" className="attach-menu-item" onClick={() => handleAttachOption('Image')}>
                  <span className="attach-icon-circle image">📷</span>
                  <span>Photo & Video</span>
                </button>
                <button type="button" className="attach-menu-item" onClick={() => handleAttachOption('Document')}>
                  <span className="attach-icon-circle doc">📄</span>
                  <span>Document</span>
                </button>
                <button type="button" className="attach-menu-item" onClick={() => handleAttachOption('Location')}>
                  <span className="attach-icon-circle loc">📍</span>
                  <span>Mesh Location</span>
                </button>
              </div>
            )}
          </div>

          {/* Main Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            id="chat-message-input"
          />

          {/* Dynamic Send / Mic Button */}
          {text.trim() ? (
            <button
              className="send-button"
              onClick={handleSend}
              id="send-message-button"
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          ) : (
            <button
              className="send-button mic"
              onClick={() => setIsRecordingVoice(true)}
              id="voice-message-button"
              aria-label="Record voice note"
              title="Hold/Tap to record voice message"
            >
              <MicIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
