import React from 'react';

interface DeliveryBadgeProps {
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SingleCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 6 7 17 2 12" />
      <polyline points="22 6 11 17" />
    </svg>
  );
}

function FailedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function DeliveryBadge({ status }: DeliveryBadgeProps) {
  return (
    <span className={`delivery-badge ${status}`}>
      {status === 'pending' && <ClockIcon />}
      {status === 'sent' && <SingleCheckIcon />}
      {status === 'delivered' && <DoubleCheckIcon />}
      {status === 'read' && <DoubleCheckIcon />}
      {status === 'failed' && <FailedIcon />}
    </span>
  );
}
