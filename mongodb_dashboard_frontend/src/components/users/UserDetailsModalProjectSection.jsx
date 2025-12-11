import React from 'react';
import UserProjectDetails from './UserProjectDetails';

// PUBLIC_INTERFACE
export default function UserDetailsModalProjectSection({ user, organizationId, apiBaseUrl }) {
  /** Small wrapper to be slotted after "User Details" within the modal */
  return <UserProjectDetails user={user} organizationId={organizationId} apiBaseUrl={apiBaseUrl} />;
}
