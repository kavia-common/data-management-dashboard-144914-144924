import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

/**
 * PUBLIC_INTERFACE
 * UsersActivityChart
 * Line chart for active users trend.
 */
export type UsersActivityChartProps = {
  data: Array<{ date: string; total: number }>;
  loading?: boolean;
};

const EmptyChart: React.FC = () => (
  <div className="screen-center" style={{ height: 280 }}>
    No trend data for the selected filters
  </div>
);

const UsersActivityChart: React.FC<UsersActivityChartProps> = ({ data = [], loading = false }) => {
  if (!loading && (!data || data.length === 0)) {
    return <EmptyChart />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ocean-grid)" />
        <XAxis dataKey="date" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="total" name="Active Users" stroke="#2563EB" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default UsersActivityChart;
