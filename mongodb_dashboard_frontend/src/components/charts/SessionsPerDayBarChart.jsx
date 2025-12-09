import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { useSessionsPerDay } from '../../hooks/useSessionsPerDay';
import Card from '../ui/Card';
import './ActiveUsersTrendChart.css';
import { oceanTheme, getPrimaryBarGradient, rechartsCommonAxes } from './index';

/**
 * PUBLIC_INTERFACE
 * Renders a responsive bar chart of sessions per day.
 * Props:
 *  - title?: string
 *  - filters?: { tenant_id?, project_id?, status?, start?, end? }
 */
export default function SessionsPerDayBarChart({ title = 'Sessions Per Day', filters = {} }) {
  const { data, loading, error } = useSessionsPerDay(filters);

  const { axisStyle, gridStyle, tickStyle } = rechartsCommonAxes();
  const gradient = getPrimaryBarGradient('sessionsPerDayGradient');

  return (
    <Card title={title}>
      {loading && <div className="chart-inline-state">Loading sessions…</div>}
      {error && <div className="chart-inline-state">Failed to load data</div>}
      {!loading && !error && (
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id={gradient.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradient.start} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={gradient.end} stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStyle.stroke} strokeDasharray={gridStyle.strokeDasharray} />
              <XAxis
                dataKey="date"
                tick={{ ...tickStyle, fontSize: oceanTheme.typography.fontSize.sm }}
                tickLine={false}
                axisLine={{ stroke: axisStyle.stroke }}
                minTickGap={24}
              />
              <YAxis
                tick={{ ...tickStyle, fontSize: oceanTheme.typography.fontSize.sm }}
                tickLine={false}
                axisLine={{ stroke: axisStyle.stroke }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: oceanTheme.colors.primarySoft }}
                contentStyle={{
                  background: oceanTheme.colors.tooltipBg,
                  color: oceanTheme.colors.tooltipText,
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: oceanTheme.shadows.medium,
                  fontSize: oceanTheme.typography.fontSize.sm
                }}
                formatter={(value) => [value, 'Count']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Bar dataKey="count" fill={`url(#${gradient.id})`} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
