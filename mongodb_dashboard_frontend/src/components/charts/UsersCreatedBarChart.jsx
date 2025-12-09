import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import './ActiveUsersTrendChart.css';
import { oceanTheme, getPrimaryBarGradient, rechartsCommonAxes } from './index';

/**
 * PUBLIC_INTERFACE
 * UsersCreatedBarChart
 * A themed, responsive bar chart for Users Created data: [{ label, count }]
 * Props:
 *  - data: array of { label: string, count: number }
 *  - loading?: boolean
 *  - error?: string | boolean
 */
export default function UsersCreatedBarChart({ data = [], loading, error }) {
  // Inline lightweight states
  if (loading) return <div className="chart-inline-state">Loading users created…</div>;
  if (error) return <div className="chart-inline-state">Unable to load chart</div>;

  const gradient = getPrimaryBarGradient('usersCreatedPrimaryGradient');
  const { axisStyle, gridStyle, tickStyle } = rechartsCommonAxes();

  return (
    <div className="chart-surface" style={{ width: '100%', height: 300, padding: 12 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 14, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gradient.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradient.start} stopOpacity={0.95} />
              <stop offset="100%" stopColor={gradient.end} stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStyle.stroke} strokeDasharray={gridStyle.strokeDasharray} />
          <XAxis
            dataKey="label"
            tick={{ ...tickStyle, fontSize: oceanTheme.typography.fontSize.sm }}
            stroke={axisStyle.stroke}
            tickMargin={6}
          />
          <YAxis
            tick={{ ...tickStyle, fontSize: oceanTheme.typography.fontSize.sm }}
            stroke={axisStyle.stroke}
            tickMargin={6}
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
            labelStyle={{ color: '#E5E7EB' }}
            itemStyle={{ color: '#ffffff' }}
          />
          <Legend wrapperStyle={{ color: oceanTheme.colors.text, fontSize: oceanTheme.typography.fontSize.sm }} />
          <Bar
            dataKey="count"
            name="Users Created"
            fill={`url(#${gradient.id})`}
            radius={[8, 8, 0, 0]}
            activeBar={{
              fill: oceanTheme.colors.primaryHover,
              stroke: oceanTheme.colors.primary,
              strokeWidth: 1
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
