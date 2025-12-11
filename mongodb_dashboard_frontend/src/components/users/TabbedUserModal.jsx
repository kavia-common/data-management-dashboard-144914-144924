import React from 'react';
import Modal from '../ui/Modal';
import Tabs from '../ui/Tabs';

/**
 * TabbedUserModal
 * A modal to view user details across available tabs.
 * This is the reverted version without the "Project Details" tab.
 *
 * Props:
 * - isOpen: boolean - controls modal visibility
 * - onClose: function - callback when modal is closed
 * - user: object - selected user document
 */
const TabbedUserModal = ({ isOpen, onClose, user }) => {
  if (!user) return null;

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div style={{ padding: '8px 0' }}>
          <div><strong>User ID:</strong> {user._id || user.id || '-'}</div>
          <div><strong>Email:</strong> {user.email || '-'}</div>
          <div><strong>Name:</strong> {user.name || user.full_name || '-'}</div>
          <div><strong>Organization:</strong> {user.organization_id || user.tenant_id || '-'}</div>
          <div><strong>Created:</strong> {user.created_at || '-'}</div>
        </div>
      ),
    },
    {
      id: 'activity',
      label: 'Activity',
      content: (
        <div style={{ padding: '8px 0' }}>
          <p>Recent activity details are not available in this modal. Use the Users analytics and Sessions views for more.</p>
        </div>
      ),
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Details">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: '#374151' }}>
          Viewing details for: <strong>{user.email || user.name || user._id}</strong>
        </div>
      </div>
      <Tabs tabs={tabs} />
    </Modal>
  );
};

export default TabbedUserModal;
