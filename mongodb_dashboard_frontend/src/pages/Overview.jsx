import React, { useEffect } from 'react';
import OverviewContainer from '../components/overview/OverviewContainer';

/**
 * PUBLIC_INTERFACE
 * Overview
 * Renders the full OverviewContainer so all existing charts mount and fetch on initial load.
 * Keeps T0000 chart append-only behavior inside the container.
 */
// PUBLIC_INTERFACE
export default function Overview() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'test') {
      // minimal debug: page-level mount
      // eslint-disable-next-line no-console
      console.debug('[Overview] mount');
    }
  }, []);

  return (
    <div className="overview-page">
      <OverviewContainer />
    </div>
  );
}
