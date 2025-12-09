import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { fetchUsersSummary } from '../../api/usersSummary';
import UsersCreatedBarChart from '../charts/UsersCreatedBarChart';
import '../charts/ActiveUsersTrendChart.css';
import './overview.css';
import OverviewTimeControls from './OverviewTimeControls';
import { useAuth } from '../../context/AuthContext';
import { fetchSessionTenants, normalizeTenantId } from '../../utils/tenantClient';
import { rangeSelectorClasses } from '../charts';
import AllTenantsIndicator from '../AllTenantsIndicator';

/**
 * PUBLIC_INTERFACE
 * OverviewUsersSummary
 * Fetches and displays the Users Created bar chart with a themed header and range controls.
 * Adds a dynamic total next to the title based on current buckets.
 *
 * Behavior updates:
 * - Uses org from auth context; do not hardcode any org id.
 * - For super-admins, shows a local Organization selector with "All organizations".
 * - When "All organizations" is selected (aggregation), omit org in request so backend aggregates.
 * - Range selector works the same; start/end only sent for custom.
 */
export default function OverviewUsersSummary({ organizationId: organizationIdProp }) {
  const auth = useAuth();

  // Role detection: prefer explicit role flags on auth or user
  const isSuperAdmin =
    !!auth?.user?.isSuperAdmin ||
    (Array.isArray(auth?.user?.roles) && auth.user.roles.includes('super-admin')) ||
    auth?.role === 'super-admin' ||
    (Array.isArray(auth?.roles) && auth.roles.includes('super-admin'));

  // Selected org state (local to this chart). Initialize from prop or auth context.
  const initialOrg =
    organizationIdProp ||
    auth?.organizationId ||
    auth?.tenantId ||
    auth?.user?.organizationId ||
    auth?.user?.tenantId ||
    null;

  const [selectedOrg, setSelectedOrg] = useState(initialOrg);
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // Range and custom dates
  const [range, setRange] = useState('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load tenants only for super-admin (local selector)
  useEffect(() => {
    let cancelled = false;
    async function loadTenants() {
      if (!isSuperAdmin) return;
      setTenantsLoading(true);
      try {
        const items = await fetchSessionTenants().catch(() => []);
        if (!cancelled) setTenants(items || []);
      } finally {
        if (!cancelled) setTenantsLoading(false);
      }
    }
    loadTenants();
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  // Build query: omit organization_id unless explicitly selected, range as chosen, start/end only for custom
  const query = useMemo(() => {
    const base = { range };
    if (range === 'custom') {
      base.start_date = startDate;
      base.end_date = endDate;
    }
    // For normal users, we omit org so api client attaches x-organization-id header automatically.
    // For super-admin: when a specific org is chosen, send it explicitly; when "All organizations", omit it.
    if (isSuperAdmin && selectedOrg && selectedOrg !== '__ALL__') {
      base.organization_id = selectedOrg;
    }
    if (!isSuperAdmin && organizationIdProp) {
      // When component is passed an explicit org (non super-admin), respect it.
      base.organization_id = organizationIdProp;
    }
    return base;
  }, [isSuperAdmin, selectedOrg, range, startDate, endDate, organizationIdProp]);

  // Fetch on mount and whenever query changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchUsersSummary(query);
        const items = (res?.buckets || []).map(b => ({ label: b.label ?? b.key, count: b.count ?? 0 }));
        if (!cancelled) {
          setData(items);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load users summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    // Always load on mount; x-organization-id is attached by API client when org is omitted
    load();
    return () => { cancelled = true; };
  }, [query.range, query.start_date, query.end_date, query.organization_id]);

  // Compute dynamic total from current data buckets
  const totalUsers = useMemo(
    () => data.reduce((sum, d) => sum + (Number(d.count) || 0), 0),
    [data]
  );

  // Render super-admin org selector locally (reuses theme classes for compact controls)
  const OrgSelector = () => {
    if (!isSuperAdmin) return null;

    const options = [
      { id: '__ALL__', name: 'All organizations' },
      ...tenants.map((t) => {
        const id = normalizeTenantId(t);
        const name = t?.tenant_name || t?.name || id || 'Unknown';
        return { id, name };
      }),
    ];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Optional inline indicator to reflect global all-tenants mode elsewhere */}
        <AllTenantsIndicator />
        <div className={rangeSelectorClasses.container} aria-label="Organization selector">
          <select
            value={selectedOrg || '__ALL__'}
            onChange={(e) => setSelectedOrg(e.target.value || '__ALL__')}
            disabled={tenantsLoading}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(17,24,39,0.15)',
              background: '#fff',
              color: '#111827',
              fontSize: 12,
            }}
          >
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <section className="overview-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <h3 className="chart-title" style={{ margin: 0 }}>
          Users Created
          <span
            style={{
              marginLeft: 8,
              fontWeight: 600,
              color: 'var(--ocean-primary)',
              fontSize: 13
            }}
            aria-label={`Total users in range: ${totalUsers}`}
            title={`Total users in range: ${totalUsers}`}
          >
            {Number(totalUsers).toLocaleString()}
          </span>
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <OrgSelector />
          <OverviewTimeControls
            range={range}
            onChangeRange={setRange}
            customRange={{ start: startDate, end: endDate }}
            onChangeCustom={(next) => {
              if (typeof next?.start === 'string') setStartDate(next.start);
              if (typeof next?.end === 'string') setEndDate(next.end);
            }}
          />
        </div>
      </div>

      <UsersCreatedBarChart
        data={data}
        loading={loading}
        error={error}
      />
    </section>
  );
}

OverviewUsersSummary.propTypes = {
  organizationId: PropTypes.string,
};
