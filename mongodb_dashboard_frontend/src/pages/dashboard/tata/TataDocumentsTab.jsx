import React, { useState } from "react";
import Card from "../../../components/ui/Card.jsx";
import DataTable from "../../../components/DataTable.jsx";

/**
 * Mock documents data for TATA super-admin view.
 * Replace with real API calls once the backend is implemented.
 */
const MOCK_DOCUMENTS_DATA = [
  { _id: "d001", doc_id: "doc-001", title: "Onboarding Guide",      tenant_id: "T0001", doc_type: "Guide",    size_kb: 142,  created_at: "2024-01-10", author: "alice@tata.com"  },
  { _id: "d002", doc_id: "doc-002", title: "API Reference v2",      tenant_id: "T0002", doc_type: "Reference",size_kb: 398,  created_at: "2024-02-05", author: "bob@tata.com"    },
  { _id: "d003", doc_id: "doc-003", title: "Architecture Diagram",  tenant_id: "T0001", doc_type: "Diagram",  size_kb: 54,   created_at: "2024-02-18", author: "carol@tata.com"  },
  { _id: "d004", doc_id: "doc-004", title: "User Research Report",  tenant_id: "T0003", doc_type: "Report",   size_kb: 214,  created_at: "2024-03-01", author: "dan@tata.com"    },
  { _id: "d005", doc_id: "doc-005", title: "Sprint Retrospective",  tenant_id: "T0002", doc_type: "Report",   size_kb: 36,   created_at: "2024-03-20", author: "eve@tata.com"    },
  { _id: "d006", doc_id: "doc-006", title: "Security Policy",       tenant_id: "T0004", doc_type: "Policy",   size_kb: 89,   created_at: "2024-04-02", author: "frank@tata.com"  },
  { _id: "d007", doc_id: "doc-007", title: "Q1 Cost Analysis",      tenant_id: "T0001", doc_type: "Report",   size_kb: 175,  created_at: "2024-04-15", author: "grace@tata.com"  },
  { _id: "d008", doc_id: "doc-008", title: "Deployment Checklist",  tenant_id: "T0005", doc_type: "Guide",    size_kb: 28,   created_at: "2024-05-03", author: "heidi@tata.com"  },
  { _id: "d009", doc_id: "doc-009", title: "LLM Model Benchmarks",  tenant_id: "T0003", doc_type: "Reference",size_kb: 512,  created_at: "2024-05-06", author: "ivan@tata.com"   },
  { _id: "d010", doc_id: "doc-010", title: "Release Notes v3.2",    tenant_id: "T0002", doc_type: "Report",   size_kb: 47,   created_at: "2024-05-12", author: "judy@tata.com"   },
];

/** Column definitions for the documents data table */
const TABLE_COLUMNS = [
  { key: "doc_id",    label: "Document ID",  priority: 1, render: (v) => v || "—" },
  { key: "title",     label: "Title",        priority: 1, render: (v) => v || "—" },
  { key: "tenant_id", label: "Tenant",       priority: 1, render: (v) => v || "—" },
  { key: "doc_type",  label: "Type",         priority: 2, render: (v) => v || "—" },
  { key: "author",    label: "Author",       priority: 2, render: (v) => v || "—" },
  { key: "size_kb",   label: "Size (KB)",    priority: 3, render: (v) => v != null ? `${v} KB` : "—" },
  { key: "created_at",label: "Created At",   priority: 3, render: (v) => v || "—" },
];

/** Unique document types extracted from mock data */
const DOC_TYPES = [...new Set(MOCK_DOCUMENTS_DATA.map((d) => d.doc_type))];

/**
 * PUBLIC_INTERFACE
 * TataDocumentsTab
 * Renders the Documents view inside the TATA super-admin section.
 * Shows a table of all documents across tenants with type filtering.
 * Currently backed by mock data; wire to real API when backend is ready.
 *
 * @returns {JSX.Element}
 */
export default function TataDocumentsTab() {
  const [filterType, setFilterType] = useState("");

  const filteredDocs = filterType
    ? MOCK_DOCUMENTS_DATA.filter((d) => d.doc_type === filterType)
    : MOCK_DOCUMENTS_DATA;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI summary row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "Total Documents", value: MOCK_DOCUMENTS_DATA.length },
          { label: "Document Types",  value: DOC_TYPES.length },
          {
            label: "Total Size",
            value: `${(MOCK_DOCUMENTS_DATA.reduce((s, d) => s + (d.size_kb || 0), 0) / 1024).toFixed(1)} MB`,
          },
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

      {/* Documents Table */}
      <Card
        title="Documents"
        subtitle="All documents across tenants (mock data — backend integration pending)"
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
            alignItems: "center",
          }}
          aria-label="Documents filter toolbar"
        >
          <label htmlFor="tata-filter-doctype" className="sr-only">
            Filter by Document Type
          </label>
          <select
            id="tata-filter-doctype"
            className="input-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ minWidth: 180 }}
            aria-label="Filter by Document Type"
          >
            <option value="">All types</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "var(--color-text-secondary, #B0A8A0)",
              whiteSpace: "nowrap",
            }}
          >
            {filteredDocs.length} document{filteredDocs.length !== 1 ? "s" : ""}
          </span>
        </div>

        <DataTable
          columns={TABLE_COLUMNS}
          data={filteredDocs}
          loading={false}
          pageSize={8}
          paginationTitle="Documents pages"
        />
      </Card>
    </div>
  );
}
