import React, { useCallback, useMemo, useState } from 'react'
import { useCurrentOrgId } from '../../hooks/useCurrentOrgId'
import { fetchLlmCostsUnderscore } from '../../api/llmCostsUnderscore'
import Card from '../../components/common/Card'
import Button from '../../components/ui/Button'
import DataTable from '../../components/DataTable'
import './SessionsAnalytics.css'
import '../../styles/globals.css'
import '../../styles/theme.css'
import { parseCurrencyToNumber, formatAsCurrency } from '../../utils/llmCostsUtils'

/**
 * PUBLIC_INTERFACE
 * CostsUnderscore Page
 * - Fetches GET /api/llm_costs (underscore path) with organization_id and pagination.
 * - Renders columns: organization_id, organization_name, organization_cost (string),
 *   users (length), user_cost (sum of users[].user_cost parsed from "$" string to number),
 *   projects (sum of lengths of users[].projects arrays).
 * - No auto-fetch on mount. Explicit Load button triggers fetch.
 * - Numeric columns are right-aligned.
 */
export default function CostsUnderscore() {
  const orgIdFromHook = useCurrentOrgId?.()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)

  const organizationId = orgIdFromHook || ''

  // Map raw doc to display row
  const toRow = useCallback((doc) => {
    const usersArr = Array.isArray(doc?.users) ? doc.users : []
    const usersCount = usersArr.length

    const userCostSum = usersArr.reduce((sum, u) => sum + parseCurrencyToNumber(u?.user_cost), 0)

    const projectsCount = usersArr.reduce((sum, u) => {
      const pCount = Array.isArray(u?.projects) ? u.projects.length : 0
      return sum + pCount
    }, 0)

    return {
      organization_id: doc?.organization_id ?? '',
      organization_name: doc?.organization_name ?? '',
      organization_cost: doc?.organization_cost ?? '',
      users: usersCount,
      user_cost: userCostSum,
      projects: projectsCount,
    }
  }, [])

  const onLoad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchLlmCostsUnderscore({
        organizationId,
        page,
        limit,
      })
      const data = Array.isArray(res?.data) ? res.data : []
      const mapped = data.map(toRow)
      setRows(mapped)
      const metaTotal = res?.meta?.total
      setTotal(Number.isFinite(metaTotal) ? metaTotal : data.length)
    } catch (e) {
      setError(e?.message || 'Failed to load costs')
    } finally {
      setLoading(false)
    }
  }, [organizationId, page, limit, toRow])

  const columns = useMemo(() => {
    const rightAlign = { textAlign: 'right' }
    return [
      { key: 'organization_id', label: 'Organization ID' },
      { key: 'organization_name', label: 'Organization Name' },
      { key: 'organization_cost', label: 'Organization Cost', render: (v) => v ?? '', style: rightAlign },
      { key: 'users', label: 'Users', render: (v) => (Number.isFinite(v) ? v : 0), style: rightAlign },
      { key: 'user_cost', label: 'User Cost (Sum)', render: (v) => formatAsCurrency(v || 0), style: rightAlign },
      { key: 'projects', label: 'Projects', render: (v) => (Number.isFinite(v) ? v : 0), style: rightAlign },
    ]
  }, [])

  const handleNext = useCallback(() => {
    if (rows.length < limit) return
    setPage((p) => p + 1)
  }, [rows.length, limit])

  const handlePrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1))
  }, [])

  const pageInfo = useMemo(() => {
    const start = (page - 1) * limit + 1
    const end = Math.min(page * limit, total || page * limit)
    return `${start} - ${end} of ${total || '—'}`
  }, [page, limit, total])

  return (
    <div className="container" style={{ padding: 16 }}>
      <Card title="LLM Costs (underscore)">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <Button onClick={onLoad} disabled={loading || !organizationId}>
            {loading ? 'Loading...' : 'Load'}
          </Button>
          {!organizationId && (
            <span style={{ color: 'var(--color-error, #EF4444)' }}>
              Select an organization to enable loading.
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="secondary" onClick={handlePrev} disabled={page === 1 || loading}>Prev</Button>
            <span style={{ minWidth: 120, textAlign: 'center' }}>{pageInfo}</span>
            <Button variant="secondary" onClick={handleNext} disabled={loading || rows.length < limit}>Next</Button>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--color-error, #EF4444)', marginBottom: 8 }}>
            {String(error)}
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          keyField="organization_id"
        />
      </Card>
    </div>
  )
}
