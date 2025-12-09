import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { fetchUsersSummary } from '../../api/usersSummary'
import UsersCreatedBarChart from '../charts/UsersCreatedBarChart'
import '../overview/overview.css'

function formatDateInput(dateObj) {
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const RANGE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
]

export default function OverviewUsersSummary({ organizationId: organizationIdProp }) {
  // Determine organization ID: prop has priority; else default to demo org 'b2c'
  const orgId = organizationIdProp || 'b2c'

  const [range, setRange] = useState('daily')
  const [startDate, setStartDate] = useState(formatDateInput(new Date()))
  const [endDate, setEndDate] = useState(formatDateInput(new Date()))

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const query = useMemo(() => {
    if (range === 'custom') {
      return { organization_id: orgId, range, start_date: startDate, end_date: endDate }
    }
    return { organization_id: orgId, range }
  }, [orgId, range, startDate, endDate])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchUsersSummary(query)
        const items = (res?.buckets || []).map(b => ({ label: b.label ?? b.key, count: b.count ?? 0 }))
        if (!cancelled) {
          setData(items)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load users summary')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (orgId) load()
    return () => { cancelled = true }
  }, [orgId, query.organization_id, query.range, query.start_date, query.end_date]) // explicit deps

  const isCustom = range === 'custom'

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ fontWeight: 600, color: '#111827' }}>Users Summary</div>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: '#374151' }}>Range</label>
        <select
          aria-label="Range selector"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff' }}
        >
          {RANGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {isCustom && (
          <>
            <label style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>Start</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff' }}
            />
            <label style={{ fontSize: 12, color: '#374151' }}>End</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff' }}
            />
          </>
        )}
      </div>

      <div>
        {loading && (
          <div style={{ padding: 16, borderRadius: 12, background: '#F3F4F6', color: '#374151', fontSize: 14 }}>
            Loading users summary...
          </div>
        )}
        {!loading && error && (
          <div role="alert" style={{ padding: 16, borderRadius: 12, background: '#FEE2E2', color: '#991B1B', fontSize: 14 }}>
            {error}
          </div>
        )}
        {!loading && !error && (
          <UsersCreatedBarChart
            title="Users Created"
            subtitle={isCustom ? `${startDate} to ${endDate}` : `Range: ${RANGE_OPTIONS.find(r => r.value === range)?.label || range}`}
            data={data}
          />
        )}
      </div>
    </section>
  )
}

OverviewUsersSummary.propTypes = {
  organizationId: PropTypes.string,
}
