import React from "react";
import PropTypes from "prop-types";
import { useAuth } from "../../context/AuthContext";
import UserSessionsList from "./UserSessionsList";

/**
 * PUBLIC_INTERFACE
 * UserSessionsPanel
 * Convenience component that injects tenantId from AuthContext into UserSessionsList.
 * Props:
 * - userId: string (required)
 * - projectId?: string|null
 */
function UserSessionsPanel({ userId, projectId = null }) {
  const { tenantId } = useAuth();
  if (!tenantId) {
    return (
      <div style={{ padding: 12, fontSize: 14, color: "var(--text-tertiary, #64748B)" }}>
        Select a tenant to view sessions.
      </div>
    );
  }
  if (!userId) {
    return (
      <div style={{ padding: 12, fontSize: 14, color: "var(--text-tertiary, #64748B)" }}>
        Select a user to view sessions.
      </div>
    );
  }
  return <UserSessionsList userId={userId} tenantId={tenantId} projectId={projectId} />;
}

UserSessionsPanel.propTypes = {
  userId: PropTypes.string.isRequired,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
};

UserSessionsPanel.defaultProps = {
  projectId: null,
};

export default UserSessionsPanel;
