/**
 * GroupInfoDrawer — Slide-over drawer displaying group details, member roster, and Admin controls.
 */

import React, { useState } from 'react';
import { useMeshStore, Conversation } from '../../store/meshStore';

interface GroupInfoDrawerProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export function GroupInfoDrawer({ conversation, isOpen, onClose }: GroupInfoDrawerProps) {
  const { ownNodeId, contacts, addGroupMember, removeGroupMember, toggleGroupAdmin, leaveGroup } = useMeshStore();
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberNodeId, setNewMemberNodeId] = useState('');

  if (!isOpen || !conversation.isGroup) return null;

  const members = conversation.members || [];
  const isAdmin = conversation.groupAdminId === ownNodeId || members.some((m) => m.nodeId === ownNodeId && m.role === 'admin');

  const handleAddMember = (contactId: string) => {
    addGroupMember(conversation.id, contactId);
  };

  const handleAddCustomNodeId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberNodeId.trim()) return;
    addGroupMember(conversation.id, newMemberNodeId.trim());
    setNewMemberNodeId('');
    setShowAddMember(false);
  };

  const handleLeaveGroup = () => {
    if (confirm('Are you sure you want to leave this group?')) {
      leaveGroup(conversation.id);
      onClose();
    }
  };

  // Contacts that are not yet in the group
  const nonGroupContacts = contacts.filter(
    (c) => !members.some((m) => m.nodeId === c.nodeId)
  );

  return (
    <div className="group-drawer-overlay" onClick={onClose}>
      <div className="group-drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Group Details</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="drawer-body">
          {/* Group Header Card */}
          <div className="group-profile-card">
            <div className="group-avatar-large" style={{ background: conversation.contact.color }}>
              👥
            </div>
            <div className="group-title-name">{conversation.groupName || conversation.contact.name}</div>
            <div className="group-meta-subtitle">
              Group · {members.length} members
            </div>
            {conversation.groupDescription && (
              <div className="group-description-box">
                "{conversation.groupDescription}"
              </div>
            )}
            <div className="group-id-code">
              Group ID: <code>{conversation.id}</code>
            </div>
          </div>

          {/* Members Section */}
          <div className="drawer-section">
            <div className="section-header">
              <h4>Members ({members.length})</h4>
              {isAdmin && (
                <button
                  className="section-add-btn"
                  onClick={() => setShowAddMember(!showAddMember)}
                >
                  {showAddMember ? 'Cancel' : '+ Add Member'}
                </button>
              )}
            </div>

            {/* Add Member Dropdown Panel */}
            {showAddMember && (
              <div className="add-member-panel">
                {nonGroupContacts.length > 0 && (
                  <div className="quick-contact-list">
                    <div className="panel-label">Add from contacts:</div>
                    {nonGroupContacts.map((c) => (
                      <div
                        key={c.id}
                        className="quick-contact-item"
                        onClick={() => handleAddMember(c.id)}
                      >
                        <div className="contact-avatar-sm" style={{ background: c.color }}>
                          {c.initials}
                        </div>
                        <span className="contact-name-sm">{c.name}</span>
                        <button className="add-sm-btn">+ Add</button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddCustomNodeId} className="custom-node-form">
                  <div className="panel-label">Or add by Node ID code:</div>
                  <div className="input-with-btn">
                    <input
                      type="text"
                      placeholder="Enter Peer Node ID"
                      value={newMemberNodeId}
                      onChange={(e) => setNewMemberNodeId(e.target.value)}
                      className="drawer-input"
                    />
                    <button type="submit" className="add-node-btn">Add</button>
                  </div>
                </form>
              </div>
            )}

            {/* Member List */}
            <div className="group-members-list">
              {members.map((member) => {
                const isSelf = member.nodeId === ownNodeId;
                const memberIsAdmin = member.role === 'admin' || member.nodeId === conversation.groupAdminId;

                return (
                  <div key={member.nodeId} className="group-member-item">
                    <div className="member-left">
                      <div className="member-avatar-icon">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="member-details">
                        <div className="member-display-name">
                          {member.name} {isSelf && <span className="you-tag">(You)</span>}
                        </div>
                        <div className="member-node-id">
                          Node: <code>{member.nodeId.substring(0, 8)}</code>
                        </div>
                      </div>
                    </div>

                    <div className="member-right">
                      {memberIsAdmin && (
                        <span className="badge-admin">Admin</span>
                      )}

                      {/* Admin Actions Dropdown / Buttons */}
                      {isAdmin && !isSelf && (
                        <div className="admin-actions">
                          <button
                            className="admin-action-btn"
                            title={memberIsAdmin ? 'Dismiss as Admin' : 'Make Group Admin'}
                            onClick={() => toggleGroupAdmin(conversation.id, member.nodeId)}
                          >
                            {memberIsAdmin ? 'Demote' : 'Make Admin'}
                          </button>
                          <button
                            className="admin-action-btn danger"
                            title="Remove Member"
                            onClick={() => removeGroupMember(conversation.id, member.nodeId)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Action */}
          <div className="drawer-footer-actions">
            <button className="leave-group-btn" onClick={handleLeaveGroup}>
              🚪 Leave Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
