import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import OverviewChartFilters from "./OverviewChartFilters.jsx";
import OverallFeaturesChart from "../charts/OverallFeaturesChart.jsx";
import UsersByTenantChart from "../charts/UsersByTenantChart.jsx";

/**
 * PUBLIC_INTERFACE
 * OverviewFeaturesSection
 * Renders Users by Tenant chart and below it the Overall Features chart.
 * Shares simple date granularity and custom from/to filters for consistency.
 */
export default function OverviewFeaturesSection({ organizationId }) {
  const [filters, setFilters] = useState({
    granularity: "week",
    from: undefined,
    to: undefined,
  });

  const tenantsList = useMemo(() => {
    if (!organizationId) return [];
    return [{ id: organizationId, name: organizationId }];
  }, [organizationId]);

  const tenant_id = tenantsList[0]?.id;

  return (
    <div className="overview-container">
      <OverviewChartFilters
        value={filters}
        onChange={setFilters}
        showGranularity={true}
        tenants={tenantsList}
      />
      <section className="grid grid-2">
        <div className="col-span-2">
          <UsersByTenantChart
            from={filters.from}
            to={filters.to}
            status={"completed|active"}
            includeInactive={false}
            maxBars={12}
          />
        </div>

        <div className="col-span-2">
          <OverallFeaturesChart
            granularity={filters.granularity}
            from={filters.from}
            to={filters.to}
            tenant_id={tenant_id}
            maxBars={12}
          />
        </div>
      </section>
    </div>
  );
}

OverviewFeaturesSection.propTypes = {
  organizationId: PropTypes.string,
};
