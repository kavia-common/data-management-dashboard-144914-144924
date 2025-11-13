import React, { useMemo, useState } from "react";
import UsersDashboard from "../dashboard/Users.jsx";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * PUBLIC_INTERFACE
 * UsersIndex
 * Wrapper to reuse the Dashboard Users view and provide a Session Details modal trigger.
 */
export default function UsersIndex() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const { tenantId: activeTenantId, organizationId } = useAuth?.() || {};

  const tenantId = useMemo(() => activeTenantId || organizationId || null, [activeTenantId, organizationId]);

  const handleViewSessions = (user) => {
    setSelectedUser(user);
    setIsSessionsOpen(true);
  };
  const handleClose = () => {
    setIsSessionsOpen(false);
    setSelectedUser(null);
  };

  return (
    <>
      <UsersDashboard onViewSessions={handleViewSessions} />
      {!!selectedUser && (
        <SessionDetailsModal
          isOpen={isSessionsOpen}
          onClose={handleClose}
          userId={String(selectedUser?.id || selectedUser?._id || selectedUser?.user_id || '')}
          tenantId={tenantId || undefined}
        />
      )}
    </>
  );
}
