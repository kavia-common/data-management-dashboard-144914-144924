import React, { useEffect, useMemo, useState } from "react";
import UsersList from "../../components/UsersList.jsx";
import TabbedUserModal from "../../components/users/TabbedUserModal.jsx";
import UsersAnalyticsPanel from "../../modules/users/UsersAnalyticsPanel.jsx";
import { QuickRangeProvider } from "../../modules/users/quickRangeContext";
import UsersTableByQuickRange from "../../components/users/UsersTableByQuickRange.jsx";

export default function Users() {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [defaultTab, setDefaultTab] = useState("details");

  const selectedTenantId = useMemo(() => {
    const u = selectedUser || {};
    return (
      u.tenant_id ??
      u.organization_name ??
      u.organization ??
      u.organization_id ??
      ""
    );
  }, [selectedUser]);

  function handleUserSelect(user) {
    setSelectedUser(user);
    setDefaultTab("details");
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  // Accessibility toggle for modal overlay
  useEffect(() => {
    document.body.classList.toggle("modal-open--dim-header", open);
    const headerEl = document.querySelector(".app-headbar, .topbar");
    if (headerEl) {
      if (open) headerEl.setAttribute("aria-hidden", "true");
      else headerEl.removeAttribute("aria-hidden");
    }
  }, [open]);

  return (
    <QuickRangeProvider defaultQuickValue={0}>
      <div>
        {/* Users Analytics Panel (Quick Range source of truth) */}
        <UsersAnalyticsPanel style={{ marginBottom: 12 }} />

        {/* Users table aligned to the same Quick Range */}
        <UsersTableByQuickRange pageSize={20} />

        {/* Users List */}
        <UsersList
          title="Users"
          subtitle="All users"
          showActions={false}
          onUserSelect={handleUserSelect}
        />

        <TabbedUserModal
          open={open}
          onClose={closeModal}
          user={selectedUser}
          tenantId={selectedTenantId}
          defaultTab={defaultTab}
        />
      </div>
    </QuickRangeProvider>
  );
}
