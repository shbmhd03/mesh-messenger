/**
 * Safety Number display component.
 * Shows the numeric fingerprint for verifying E2EE sessions,
 * plus a visual QR-style grid pattern.
 */

import React, { useMemo } from 'react';

interface SafetyNumberProps {
  contactName: string;
  /** Pre-computed safety number string (60 digits) */
  safetyNumber?: string;
  /** Contact's NodeID (hex): used to generate a deterministic pattern when no real safety number */
  nodeId: string;
  verified: boolean;
  onVerify?: () => void;
  onClose?: () => void;
}

/**
 * Generate a deterministic pseudo-safety-number from a nodeId for demo purposes.
 */
function generateDemoSafetyNumber(nodeId: string): string {
  const digits: string[] = [];
  for (let i = 0; i < 12; i++) {
    // Use nodeId bytes cyclically to make a deterministic 5-digit group
    const offset = (i * 3) % nodeId.length;
    const val = parseInt(nodeId.substring(offset, offset + 4) || '0000', 16) % 100000;
    digits.push(val.toString().padStart(5, '0'));
  }
  return digits.join(' ');
}

/**
 * Generate a deterministic visual grid pattern from a nodeId.
 * Each cell is a color derived from the nodeId bytes.
 */
function generateGridPattern(nodeId: string): string[] {
  const colors: string[] = [];
  const palette = [
    'hsl(252, 85%, 63%)',  // accent purple
    'hsl(175, 75%, 50%)',  // mesh teal
    'hsl(280, 80%, 55%)',  // violet
    'hsl(320, 75%, 50%)',  // magenta
    'hsl(200, 70%, 55%)',  // blue
    'hsl(140, 65%, 45%)',  // green
    'hsl(38, 90%, 55%)',   // amber
    'hsl(0, 72%, 55%)',    // red
  ];

  for (let i = 0; i < 64; i++) {
    const charIdx = i % nodeId.length;
    const val = parseInt(nodeId[charIdx], 16);
    colors.push(palette[val % palette.length]);
  }
  return colors;
}

export function SafetyNumber({
  contactName,
  safetyNumber,
  nodeId,
  verified,
  onVerify,
  onClose,
}: SafetyNumberProps) {
  const displayNumber = useMemo(
    () => safetyNumber || generateDemoSafetyNumber(nodeId),
    [safetyNumber, nodeId]
  );

  const gridColors = useMemo(() => generateGridPattern(nodeId), [nodeId]);

  const groups = displayNumber.replace(/\s+/g, '').match(/.{1,5}/g) || [];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      animation: 'fadeIn 200ms ease-out',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        width: '420px',
        maxWidth: '90vw',
        animation: 'fadeInScale 300ms ease-out',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '4px',
            }}>
              Verify Safety Number
            </h2>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
            }}>
              with {contactName}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" id="close-safety-number-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Visual Pattern (QR-style grid) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '3px',
          padding: 'var(--space-4)',
          background: 'var(--bg-overlay)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          {gridColors.map((color, i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                borderRadius: '3px',
                background: color,
                opacity: 0.6 + (parseInt(nodeId[i % nodeId.length], 16) / 16) * 0.4,
                animation: `fadeInScale 300ms ease-out ${i * 10}ms backwards`,
              }}
            />
          ))}
        </div>

        {/* Numeric Safety Number */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-md)',
          lineHeight: 2.2,
          letterSpacing: '0.1em',
          color: 'var(--text-primary)',
          textAlign: 'center',
          padding: 'var(--space-4)',
          background: 'var(--bg-overlay)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          {/* 4 rows of 3 groups */}
          {[0, 3, 6, 9].map((start) => (
            <div key={start}>
              {groups.slice(start, start + 3).join('  ')}
            </div>
          ))}
        </div>

        {/* Instructions */}
        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          Compare this number and pattern with {contactName}'s device.
          If they match, your messages are end-to-end encrypted.
        </p>

        {/* Verification Status / Action */}
        {verified ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--success-soft)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid hsla(152, 65%, 48%, 0.2)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11.5 14.5 15.5 10" />
            </svg>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--success)' }}>
              Verified
            </span>
          </div>
        ) : (
          <button
            onClick={onVerify}
            id="mark-verified-btn"
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Mark as Verified
          </button>
        )}
      </div>
    </div>
  );
}
