import React from "react";
import OverviewContainer from "../../components/overview/OverviewContainer.jsx";

/**
 * PUBLIC_INTERFACE
 * Overview page
 * Renders the OverviewContainer which includes KPI cards, service type chart,
 * and a single ProjectCreatedBarChart immediately after the service_type_created_chart section.
 */
export default function Overview() {
  return (
    <div className="page-container">
      <OverviewContainer />
    </div>
  );
}
