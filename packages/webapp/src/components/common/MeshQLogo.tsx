import React from 'react';

interface MeshQLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MeshQLogo({ size = 'md', className = '' }: MeshQLogoProps) {
  return (
    <span className={`meshq-brand-logo size-${size} ${className}`}>
      <span className="logo-word-mesh">Mesh</span>
      <span className="logo-letter-q">Q</span>
    </span>
  );
}
