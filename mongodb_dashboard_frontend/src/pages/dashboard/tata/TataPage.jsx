import React, { useState } from "react";
import Tabs from "../../../components/ui/Tabs.jsx";
import TataSessionsTab from "./TataSessionsTab.jsx";
import TataProjectsTab from "./TataProjectsTab.jsx";
import TataDocumentsTab from "./TataDocumentsTab.jsx";

/**
 * Tab definitions for the TATA super-admin section.
 * Each tab maps a key to its label; the content is rendered below the tab bar.
 */
const TATA_TABS = [
  { key: "sessions",  label: "Sessions"  },
  { key: "projects",  label: "Projects"  },
  { key: "documents", label: "Documents" },
];

/**
 * Map of tab keys to their content components.
 * Adding a new tab requires only a new entry here and in TATA_TABS.
 */
const TAB_CONTENT_MAP = {
  sessions:  <TataSessionsTab />,
  projects:  <TataProjectsTab />,
  documents: <TataDocumentsTab />,
};

/**
 * PUBLIC_INTERFACE
 * TataPage
 * Super-admin (tenant T0000) exclusive section providing a unified view across
 * all TATA tenants. Contains three tabs: Sessions, Projects, and Documents.
 *
 * Access is controlled at the route level — this component itself does not
 * enforce the T0000 guard; that is handled in Sidebar.jsx and AppRoutes.jsx.
 *
 * @returns {JSX.Element}
 */
export default function TataPage() {
  // Track the currently selected tab; default to the first tab
  const [activeTab, setActiveTab] = useState(TATA_TABS[0].key);

  return (
    <div
      className="tata-page"
      role="region"
      aria-label="TATA super-admin section"
      style={{ display: "flex", flexDirection: "column", gap: 0 }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text-primary, #EAEAEA)",
            margin: 0,
            marginBottom: 4,
          }}
        >
          TATA
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary, #B0A8A0)",
            margin: 0,
          }}
        >
          Super-admin overview across all tenants — Sessions, Projects, and Documents
        </p>
      </div>

      {/* Tab bar */}
      <Tabs
        tabs={TATA_TABS}
        activeKey={activeTab}
        onChange={setActiveTab}
        aria-label="TATA section tabs"
        className="tata-tabs"
      />

      {/* Tab content panel */}
      <div
        role="tabpanel"
        aria-label={`${activeTab} tab content`}
        style={{ marginTop: 24 }}
      >
        {TAB_CONTENT_MAP[activeTab] ?? null}
      </div>
    </div>
  );
}
