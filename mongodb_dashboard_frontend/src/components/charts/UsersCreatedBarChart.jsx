import React from 'react'
import PropTypes from 'prop-types'
import './ActiveUsersTrendChart.css' // reuse chart styles if any
import { Card } from '../ui' // falls back to index.js export; else path adjust
import './index.js'

/**
 * A minimal responsive bar chart using plain SVG to avoid new deps.
 * Expects data = [{ label, count }]
 */
function SimpleBarChart({ data, height = 200, barColor = '#2563EB' }) {
  const paddingX = 24
  const paddingY = 24
  const width = Math.max(320, data.length * 40 + paddingX * 2)
  const max = Math.max(1, ...data.map(d => d.count || 0))
  const barWidth = Math.max(10, (width - paddingX * 2) / Math.max(1, data.length) - 8)
  const scaleY = (v) => {
    const usable = height - paddingY * 2
    return usable * (v / max)
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width={width} height={height} role="img" aria-label="Users created bar chart">
        {/* Axes */}
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#E5E7EB" />
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#E5E7EB" />
        {/* Bars */}
        {data.map((d, i) => {
          const x = paddingX + i * (barWidth + 8)
          const barH = scaleY(d.count || 0)
          const y = height - paddingY - barH
          return (
            <g key={`${d.label}-${i}`}>
              <rect x={x} y={y} width={barWidth} height={barH} fill={barColor} rx="4" />
              <text x={x + barWidth / 2} y={height - paddingY + 14} fontSize="10" fill="#6B7280" textAnchor="middle">
                {d.label}
              </text>
              <text x={x + barWidth / 2} y={y - 4} fontSize="10" fill="#111827" textAnchor="middle">
                {d.count ?? 0}
              </text>
            </g>
          )
        })}
        {/* Max label */}
        <text x={paddingX - 6} y={paddingY + 6} fontSize="10" fill="#6B7280" textAnchor="end">{max}</text>
        <text x={paddingX - 6} y={height - paddingY} fontSize="10" fill="#6B7280" textAnchor="end">0</text>
      </svg>
    </div>
  )
}

SimpleBarChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, count: PropTypes.number })).isRequired,
  height: PropTypes.number,
  barColor: PropTypes.string,
}

export default function UsersCreatedBarChart({ title, subtitle, data }) {
  return (
    <div className="card users-created-bar-chart" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 12, color: '#6B7280' }}>{subtitle}</div> : null}
      </div>
      <SimpleBarChart data={data} height={220} />
    </div>
  )
}

UsersCreatedBarChart.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, count: PropTypes.number })).isRequired,
}

UsersCreatedBarChart.defaultProps = {
  title: 'Users Created',
  subtitle: '',
}
