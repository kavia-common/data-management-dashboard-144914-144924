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

  const columns = useMemo(() => ([
    { Header: 'Organization', accessor: r => r.organization_id || '—' },
    { Header: 'User', accessor: r => r.user_id || '—' },
    { Header: 'Type', accessor: r => r.type || '—' },
    { Header: 'User Cost', accessor: r => `$${Number(r.user_cost || 0).toFixed(4)}` },
    { Header: 'Projects', accessor: r => Number(r.project_count || 0) }
  ]), []);

  async function fetchUsers(p = page, l = limit) {
    setLoading(true);
    try {
      const params = { page: p, limit: l, sort: '-createdAt' };
      if (organizationId) params.organization_id = organizationId;
      const res = await client.get('/api/llm-costs/users', { params });
      const data = res?.data || {};
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setTotal(Number(data.total || list.length || 0));
      setPage(Number(data.page || p));
      setLimit(Number(data.limit || l));
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
        <DataTable
          data={items}
          columns={columns}
          loading={loading}
          page={page}
          pageSize={limit}
          total={total}
          onPageChange={(p) => fetchUsers(p, limit)}
          onPageSizeChange={(s) => fetchUsers(1, s)}
        />
      </div>
    </div>
  );
}
