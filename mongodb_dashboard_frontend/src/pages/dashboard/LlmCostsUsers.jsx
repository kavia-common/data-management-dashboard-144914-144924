import React, { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import { getApiClient } from '../../api/baseClient';
import { getOrganizationId } from '../../api/authTokenProvider';

// PUBLIC_INTERFACE
/**
 * LlmCostsUsers
 * Displays per-user costs listing from /api/llm-costs/users with optional organization filter.
 * Props:
 * - organizationId?: string - when provided, filters to this tenant.
 */
export default function LlmCostsUsers({ organizationId }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Optional debug flag through env to log payload shape once
  const debugEnabled = String(process.env.REACT_APP_DEBUG_LLM_COSTS || '').toLowerCase() === 'true';

  const columns = useMemo(() => ([
    // Required by task: table with columns User ID, Type, User Cost, Project Count
    {
      key: 'user_id',
      label: 'User ID',
      render: (v, row) => String(v ?? row?.users?.[0]?.user_id ?? row?.user?._id ?? '—'),
      priority: 1,
    },
    {
      key: 'type',
      label: 'Type',
      render: (v, row) => String((row?.type ?? row?.users?.[0]?.type ?? row?.user?.type ?? v ?? '—')),
      priority: 2,
    },
    {
      key: 'user_cost',
      label: 'User Cost',
      render: (v, row) => {
        // Strictly use users[i].user_cost (or top-level user_cost when provided by API)
        const numRaw = row?.user_cost ?? row?.users?.[0]?.user_cost ?? null;
        if (numRaw == null || Number.isNaN(Number(numRaw))) return '—';
        const num = Number(numRaw);
        return `$${num.toFixed(4)}`;
      },
      priority: 1,
    },
    {
      key: 'project_count',
      label: 'Project Count',
      render: (v, row) => {
        const count = row?.project_count ?? row?.users?.[0]?.project_count ?? 0;
        const n = Number(count);
        return Number.isFinite(n) ? n : 0;
      },
      priority: 2,
    }
  ]), []);

  async function fetchUsers(p = page, l = limit) {
    setLoading(true);
    setError('');
    try {
      const api = getApiClient();
      const orgId = organizationId || getOrganizationId();
      const params = { page: p, limit: l };
      // Ensure pagination and scoping params are passed. baseClient will also append organization_id if missing.
      if (orgId) params.organization_id = orgId;

      const { data: payload } = await api.get('/api/llm-costs/users', { params });

      if (debugEnabled && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[llm-costs/users] payload (first item):', Array.isArray(payload?.items) ? payload.items[0] : Array.isArray(payload?.data) ? payload.data[0] : Array.isArray(payload) ? payload[0] : payload);
      }

      let list = [];
      let nextMeta = { page: p, limit: l, total: 0 };

      // Preferred API shape from backend openapi: { items, page, limit, total }
      if (payload && Array.isArray(payload.items)) {
        list = payload.items;
        nextMeta = {
          page: Number(payload.page || p),
          limit: Number(payload.limit || l),
          total: Number(payload.total || list.length || 0),
        };
      } else if (payload && Array.isArray(payload.data) && payload.meta) {
        // Alternate envelope: { data, meta }
        list = payload.data;
        nextMeta = {
          page: Number(payload.meta?.page || p),
          limit: Number(payload.meta?.limit || l),
          total: Number(payload.meta?.total || list.length || 0),
        };
      } else if (Array.isArray(payload)) {
        // Raw array
        list = payload;
        nextMeta = { page: p, limit: l, total: list.length };
      }

      // Map to required columns null-safe:
      // - User ID from users[i].user_id
      // - Type from record.type or users[i].type (fallback item.type)
      // - User Cost strictly from users[i].user_cost (or top-level user_cost if API provides it)
      // - Project Count from users[i].project_count (or users[i].projects?.length)
      const mapped = (list || []).map((it) => {
        const u = Array.isArray(it?.users) && it.users.length > 0 ? it.users[0] : (it?.user || null);
        const userId = it?.user_id ?? u?.user_id ?? u?._id ?? '—';
        const type = it?.type ?? u?.type ?? '—';

        // Strictly source user_cost from users[i].user_cost, or top-level user_cost if provided
        const userCostRaw = it?.user_cost ?? u?.user_cost ?? null;
        const userCost = userCostRaw != null && Number.isFinite(Number(userCostRaw)) ? Number(userCostRaw) : null;

        // Project count: prefer explicit project_count; else derive from users[i].projects?.length
        let projectCount = it?.project_count ?? u?.project_count ?? null;
        if (projectCount == null && Array.isArray(u?.projects)) {
          projectCount = u.projects.length;
        }
        const projectCountNum = Number.isFinite(Number(projectCount)) ? Number(projectCount) : 0;

        return {
          ...it,
          user_id: userId ?? '—',
          type: type ?? '—',
          user_cost: userCost ?? null,
          project_count: projectCountNum,
        };
      });

      setItems(mapped);
      setTotal(nextMeta.total);
      setPage(nextMeta.page);
      setLimit(nextMeta.limit);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(e?.message || 'Failed to load user costs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial & on organization change
    fetchUsers(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return (
    <div className="card">
      <div className="card-header">
        <h3>LLM Costs — Users</h3>
      </div>
      <div className="card-body">
        {loading && !items.length && !error && (
          <div className="text-muted" aria-live="polite">Loading…</div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="text-muted" role="status">No data</div>
        )}
        <DataTable
          data={items}
          columns={columns}
          loading={loading}
          initialPage={page}
          pageSize={limit}
          serverTotal={total}
          fetchPage={(newPage, pageSize) => fetchUsers(newPage, pageSize)}
          onPageChange={(p) => fetchUsers(p, limit)}
        />
      </div>
    </div>
  );
}
