/**
 * CreateGroupModal — Modal to create a new group chat and select initial members.
 */

import React, { useState } from 'react';
import { useMeshStore } from '../../store/meshStore';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const { contacts, createGroup, setActiveConversation } = useMeshStore();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Please enter a group name.');
      return;
    }

    const groupId = createGroup(groupName.trim(), groupDescription.trim(), selectedContactIds);
    setActiveConversation(groupId);
    onClose();
    setGroupName('');
    setGroupDescription('');
    setSelectedContactIds([]);
    setError(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Group</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleCreate} className="group-form">
          {error && <div className="modal-error-banner">{error}</div>}

          <div className="form-group">
            <label>Group Name *</label>
            <input
              type="text"
              placeholder="e.g. Mesh Developers, Core Team"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError(null);
              }}
              className="group-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <input
              type="text"
              placeholder="Group topic or description"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="group-input"
            />
          </div>

          <div className="form-group">
            <label>Select Members ({selectedContactIds.length} selected)</label>
            <div className="member-picker-list">
              {contacts.length === 0 ? (
                <div className="empty-contacts-hint">
                  No contacts found. Direct peer Node IDs can also be added later from Group Settings.
                </div>
              ) : (
                contacts.map((contact) => {
                  const selected = selectedContactIds.includes(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className={`member-picker-item ${selected ? 'selected' : ''}`}
                      onClick={() => toggleContactSelection(contact.id)}
                    >
                      <div className="member-checkbox">
                        {selected ? '✓' : ''}
                      </div>
                      <div className="member-avatar" style={{ background: contact.color }}>
                        {contact.initials}
                      </div>
                      <div className="member-info">
                        <div className="member-name">{contact.name}</div>
                        <div className="member-node">Node ID: {contact.nodeId.substring(0, 8)}...</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Group ({selectedContactIds.length + 1} members)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
