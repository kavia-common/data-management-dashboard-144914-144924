import React from "react";
import Card from "../../../components/ui/Card.jsx";
import DataTable from "../../../components/DataTable.jsx";

/**
 * Mock projects data for TATA super-admin view.
 * Replace with real API calls once the backend is implemented.
 */
const MOCK_PROJECTS_DATA = [
  { _id: "p001", project_id: "proj-001", name: "Alpha",   tenant_id: "T0001", service_type: "LLM Agent", status: "active",   created_at: "2024-03-10", deployments: 5  },
  { _id: "p002", project_id: "proj-002", name: "Beta",    tenant_id: "T0002", service_type: "Analytics", status: "active",   created_at: "2024-03-15", deployments: 3  },
  { _id: "p003", project_id: "proj-003", name: "Gamma",   tenant_id: "T0003", service_type: "LLM Agent", status: "inactive", created_at: "2024-02-20", deployments: 1  },
  { _id: "p004", project_id: "proj-004", name: "Delta",   tenant_id: "T0004", service_type: "Data Sync", status: "active",   created_at: "2024-04-01", deployments: 8  },
  { _id: "p005", project_id: "proj-005", name: "Epsilon", tenant_id: "T0005", service_type: "Analytics", status: "active",   created_at: "2024-04-18", deployments: 2  },
  { _id: "p006", project_id: "proj-006", name: "Zeta",    tenant_id: "T0001", service_type: "LLM Agent", status: "active",   created_at: "2024-05-01", deployments: 4  },
  { _id: "p007", project_id: "proj-007", name: "Eta",     tenant_id: "T0002", service_type: "Data Sync", status: "inactive", created_at: "2024-01-08", deployments: 0  },
  { _id: "p008", project_id: "proj-008", name: "Theta",   tenant_id: "T0003", service_type: "Analytics", status: "active",   created_at: "2024-05-08", deployments: 6  },
];

/** Inline status badge for projects table */
function ProjectStatusBadge({ status }) {
  const style =
    status === "active"
      ? { bg: "rgba(34,197,94,0.15)", color: "#22c55e" }
      : { bg: "rgba(160,160,160,0.15)", color: "#a0a0a0" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        textTransform: "capitalize",
      }}
    >
      {status || "—"}
    </span>
  );
}

/** Column definitions for the projects data table */
const TABLE_COLUMNS = [
  { key: "project_id",   label: "Project ID",    priority: 1, render: (v) => v || "—" },
  { key: "name",         label: "Name",           priority: 1, render: (v) => v || "—" },
  { key: "tenant_id",    label: "Tenant",         priority: 1, render: (v) => v || "—" },
  { key: "service_type", label: "Service Type",   priority: 2, render: (v) => v || "—" },
  { key: "status",       label: "Status",         priority: 2, render: (v) => <ProjectStatusBadge status={v} /> },
  { key: "deployments",  label: "Deployments",    priority: 3, render: (v) => v != null ? v : "—" },
  { key: "created_at",   label: "Created At",     priority: 3, render: (v) => v || "—" },
];

/**
 * PUBLIC_INTERFACE
 * TataProjectsTab
 * Renders the Projects view inside the TATA super-admin section.
 * Shows a table of all projects across tenants.
 * Currently backed by mock data; wire to real API when backend is ready.
 *
 * @returns {JSX.Element}
 */
export default function TataProjectsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary note */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Total Projects",    value: MOCK_PROJECTS_DATA.length },
          { label: "Active",            value: MOCK_PROJECTS_DATA.filter((p) => p.status === "active").length },
          { label: "Total Deployments", value: MOCK_PROJECTS_DATA.reduce((s, p) => s + (p.deployments || 0), 0) },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="card"
            style={{ flex: "1 1 160px", minWidth: 140, padding: "16px 20px" }}
          >
            <div style={{ fontSize: 13, color: "var(--color-text-secondary, #B0A8A0)", marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-primary, #EAEAEA)" }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Projects Table */}
      <Card
        title="Projects"
        subtitle="All projects across tenants (mock data — backend integration pending)"
      >
        <DataTable
          columns={TABLE_COLUMNS}
          data={MOCK_PROJECTS_DATA}
          loading={false}
          pageSize={8}
          paginationTitle="Projects pages"
        />
      </Card>
    </div>
  );
}
