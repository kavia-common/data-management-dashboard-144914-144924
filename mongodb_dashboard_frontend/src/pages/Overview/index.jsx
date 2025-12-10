import React from 'react';
import OverviewFeaturesByService from '../../components/overview/OverviewFeaturesByService';

// PUBLIC_INTERFACE
// Overview page assembly: ensure Features chart appears below existing users summary component.
// If UsersSummary is already rendered by another component on this page template, we append our chart below.
export default function OverviewPage() {
  return (
    <div style={{ padding: 16 }}>
      {/* Existing Overview content (users summary, metrics, etc.) is assumed to be above or in a wrapper. */}
      <div id="overview-users-summary-anchor" />
      <OverviewFeaturesByService />
    </div>
  );
}
