import React from "react";

/**
 * PUBLIC_INTERFACE
 * UsersSummaryCards
 * Renders KPI summary cards with loading and empty fallbacks.
 */
type UsersSummaryCardsProps = {
  items: Array<{ label: string; value: number | null; color?: string }>;
  loading?: boolean;
};

const CardStat: React.FC<{ label: string; value: number | null; color?: string; loading?: boolean }> = ({
  label,
  value,
  color = "#2563EB",
  loading = false,
}) => {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-title" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</div>
      <div style={{ marginTop: 8, fontWeight: 800, fontSize: 22, color }}>
        {loading ? <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 6 }} /> : (value ?? 0)}
      </div>
    </div>
  );
};

const UsersSummaryCards: React.FC<UsersSummaryCardsProps> = ({ items, loading }) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
      {items.map((it, idx) => (
        <CardStat key={idx} label={it.label} value={it.value} color={it.color} loading={loading} />
      ))}
    </div>
  );
};

export default UsersSummaryCards;
