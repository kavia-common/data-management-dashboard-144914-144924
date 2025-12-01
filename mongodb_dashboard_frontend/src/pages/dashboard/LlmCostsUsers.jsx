import React, { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import client from '../../api/client';

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

  const columns = useMemo(() => ([
    // Required by task: table with columns User ID, Type, User Cost, Project Count
    {
      key: 'user_id',
      label: 'User ID',
      render: (v, row) => String(v ?? row?.user?._id ?? '—'),
      priority: 1,
    },
    {
      key: 'type',
      label: 'Type',
      render: (v, row) => String((row?.type ?? row?.user?.type ?? v ?? '—')),
      priority: 2,
    },
    {
      key: 'user_cost',
      label: 'User Cost',
      render: (v, row) => `$${Number((row?.user_cost ?? row?.cost ?? v ?? 0) || 0).toFixed(4)}`,
      priority: 1,
    },
    {
      key: 'project_count',
      label: 'Project Count',
      render: (v, row) => Number((row?.project_count ?? v ?? 0) || 0),
      priority: 2,
    }
  ]), []);

  async function fetchUsers(p = page, l = limit) {
    setLoading(true);
    setError('');
    try {
      const params = { page: p, limit: l, sort: '-createdAt' };
      if (organizationId) params.organization_id = organizationId;
      const res = await client.get('/api/llm-costs/users', { params });

      const payload = res?.data;
      let list = [];
      let nextMeta = { page: p, limit: l, total: 0 };

      if (payload && Array.isArray(payload.items)) {
        list = payload.items;
        nextMeta = {
          page: Number(payload.page || p),
          limit: Number(payload.limit || l),
          total: Number(payload.total || list.length || 0),
        };
      } else if (payload && Array.isArray(payload.data) && payload.meta) {
        // fallback if server uses envelope with {data, meta}
        list = payload.data;
        nextMeta = {
          page: Number(payload.meta?.page || p),
          limit: Number(payload.meta?.limit || l),
          total: Number(payload.meta?.total || list.length || 0),
        };
      } else if (Array.isArray(payload)) {
        list = payload;
        nextMeta = { page: p, limit: l, total: list.length };
      }

      // Map items with null-safe defaults for required columns
      const mapped = (list || []).map((it) => ({
        ...it,
        user_id: it?.user_id ?? it?.user?._id ?? '—',
        type: it?.type ?? it?.user?.type ?? '—',
        user_cost: Number(it?.user_cost ?? it?.cost ?? 0),
        project_count: Number(it?.project_count ?? 0),
      }));

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

  useEffect(() => { fetchUsers(1, limit); }, [organizationId]); // refetch when org changes

  return (
    <div className="card">
      <div className="card-header">
        <h3>LLM Costs — Users</h3>
      </div>
      <div className="card-body">
        {error && <div className="error" role="alert">{error}</div>}
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
