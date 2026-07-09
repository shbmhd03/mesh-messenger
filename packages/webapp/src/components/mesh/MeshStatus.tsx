import React from 'react';
import type { DemoMeshNode } from '../../lib/demo';

interface MeshStatusProps {
  nodes: DemoMeshNode[];
  relayConnected: boolean;
  ownNodeId: string;
}

export function MeshStatus({ nodes, relayConnected, ownNodeId }: MeshStatusProps) {
  const directPeers = nodes.filter((n) => n.hopCount <= 1).length;
  const totalReachable = nodes.length;
  const relayNodes = nodes.filter((n) => n.relayCapable).length;

  return (
    <div className="mesh-panel">
      <div className="mesh-panel-title">Mesh Network</div>

      {/* Stats */}
      <div className="mesh-stats">
        <div className="mesh-stat">
          <div className="mesh-stat-value">{directPeers}</div>
          <div className="mesh-stat-label">Direct Peers</div>
        </div>
        <div className="mesh-stat">
          <div className="mesh-stat-value">{totalReachable}</div>
          <div className="mesh-stat-label">Total Nodes</div>
        </div>
        <div className="mesh-stat">
          <div className="mesh-stat-value">{relayNodes}</div>
          <div className="mesh-stat-label">Relays</div>
        </div>
      </div>

      {/* Network Graph Visualization */}
      <div className="mesh-graph-container">
        <MeshGraph nodes={nodes} ownNodeId={ownNodeId} />
      </div>

      {/* Node List */}
      <div className="mesh-node-list">
        {nodes.map((node, i) => (
          <div
            className="mesh-node"
            key={node.id}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className={`mesh-dot ${node.hopCount <= 1 ? 'connected' : 'connecting'}`} />
            <span className="mesh-node-id">{node.displayId}</span>
            <span className={`mesh-node-transport ${node.transport}`}>
              {node.transport.toUpperCase()}
            </span>
            <span style={{ flex: 1 }} />
            {node.rssi !== undefined && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {node.rssi} dBm
              </span>
            )}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              {node.hopCount === 0 ? 'direct' : `${node.hopCount} hop${node.hopCount > 1 ? 's' : ''}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple SVG mesh graph visualization */
function MeshGraph({ nodes, ownNodeId }: { nodes: DemoMeshNode[]; ownNodeId: string }) {
  // Center node is "you"
  const centerX = 50;
  const centerY = 50;

  // Generate connections (simplified: direct peers connect to center, multi-hop chain)
  const connections: { x1: number; y1: number; x2: number; y2: number; hop: number }[] = [];

  for (const node of nodes) {
    if (node.hopCount <= 1) {
      connections.push({ x1: centerX, y1: centerY, x2: node.x, y2: node.y, hop: 0 });
    } else {
      // Connect to nearest lower-hop node
      const nearestParent = nodes
        .filter((n) => n.hopCount < node.hopCount)
        .sort((a, b) => {
          const distA = Math.hypot(a.x - node.x, a.y - node.y);
          const distB = Math.hypot(b.x - node.x, b.y - node.y);
          return distA - distB;
        })[0];

      if (nearestParent) {
        connections.push({
          x1: nearestParent.x,
          y1: nearestParent.y,
          x2: node.x,
          y2: node.y,
          hop: node.hopCount,
        });
      }
    }
  }

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsla(252, 85%, 63%, 0.3)" />
          <stop offset="100%" stopColor="hsla(252, 85%, 63%, 0)" />
        </radialGradient>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsla(175, 75%, 50%, 0.2)" />
          <stop offset="100%" stopColor="hsla(175, 75%, 50%, 0)" />
        </radialGradient>
      </defs>

      {/* Connection lines */}
      {connections.map((c, i) => (
        <line
          key={`conn-${i}`}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke={c.hop <= 1 ? 'hsla(175, 75%, 50%, 0.25)' : 'hsla(175, 75%, 50%, 0.12)'}
          strokeWidth="0.4"
          strokeDasharray={c.hop > 1 ? '1,1' : 'none'}
        >
          <animate
            attributeName="opacity"
            values="0.3;0.7;0.3"
            dur={`${2 + i * 0.3}s`}
            repeatCount="indefinite"
          />
        </line>
      ))}

      {/* Center node (you) */}
      <circle cx={centerX} cy={centerY} r="6" fill="url(#centerGlow)" />
      <circle cx={centerX} cy={centerY} r="2.5" fill="hsl(252, 85%, 63%)">
        <animate
          attributeName="r"
          values="2.5;3;2.5"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <text
        x={centerX}
        y={centerY + 7}
        textAnchor="middle"
        fill="hsla(252, 85%, 63%, 0.6)"
        fontSize="2.5"
        fontFamily="Inter, sans-serif"
      >
        YOU
      </text>

      {/* Peer nodes */}
      {nodes.map((node) => {
        const color = node.relayCapable
          ? 'hsl(252, 75%, 55%)'
          : node.hopCount <= 1
          ? 'hsl(175, 75%, 50%)'
          : 'hsl(175, 75%, 35%)';
        const r = node.relayCapable ? 2 : 1.5;

        return (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={r * 2.5} fill="url(#nodeGlow)" />
            <circle cx={node.x} cy={node.y} r={r} fill={color}>
              {node.hopCount <= 1 && (
                <animate
                  attributeName="opacity"
                  values="0.7;1;0.7"
                  dur="3s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
            <text
              x={node.x}
              y={node.y - r - 1.5}
              textAnchor="middle"
              fill="hsla(0, 0%, 100%, 0.35)"
              fontSize="2"
              fontFamily="JetBrains Mono, monospace"
            >
              {node.displayId.split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
