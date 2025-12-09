import React, { useMemo } from 'react';
import OverviewContainer from '../../components/overview/OverviewContainer';
import OverviewUsersSummary from '../../components/overview/OverviewUsersSummary';
import { useAuth } from '../../context/AuthContext';
import { resolveOrganizationId } from '../../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * Overview page that renders overview sections and wires dynamic organizationId.
 */
export default function Overview() {
  const auth = useAuth();
  const organizationId = useMemo(() => resolveOrganizationId({ auth }), [auth]);

  return (
    <OverviewContainer>
      <OverviewUsersSummary organizationId={organizationId} />
    </OverviewContainer>
  );
}
