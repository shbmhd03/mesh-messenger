import React from 'react';

interface AvatarProps {
  initials: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

export function Avatar({ initials, color, size = 'md', online }: AvatarProps) {
  return (
    <div className={`avatar ${size}`} style={{ background: color }}>
      {initials}
      {online && <span className="avatar-online-dot" />}
    </div>
  );
}
