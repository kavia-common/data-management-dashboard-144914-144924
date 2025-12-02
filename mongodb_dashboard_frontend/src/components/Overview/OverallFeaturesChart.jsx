import React from "react";

/**
 * Simple horizontal bar chart using divs (no external deps).
 * Props:
 *  - data: [{label, count}]
 *  - mostLabel, leastLabel for highlighting
 *  - colors: { primary, secondary, error }
 *  - loading, error, empty message handling delegated by parent
 */
export default function OverallFeaturesChart({ data, most, least, colors }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center">
        No service usage found for selected period
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = `${Math.round((item.count / max) * 100)}%`;
        const isMost = most && item.label === most.label;
        const isLeast = least && item.label === least.label;
        const barColor = isMost
          ? colors.primary
          : isLeast
          ? "#FEE2E2" // light error background for least
          : "#E5E7EB"; // neutral for others

        const textColor = isMost ? "#ffffff" : "#111827";

        return (
          <div key={item.label} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-sm text-gray-700 truncate" title={item.label}>
              {item.label || "Unknown"}
            </div>
            <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
              <div
                className="h-6 rounded transition-all duration-300 ease-out flex items-center px-2"
                style={{
                  width,
                  backgroundColor: isLeast ? barColor : isMost ? colors.primary : colors.secondary + "22",
                  color: textColor,
                }}
                title={`${item.count}`}
              >
                <span className="text-xs font-medium">
                  {item.count}
                </span>
              </div>
            </div>
            <div className="w-24 text-right text-xs text-gray-500">{item.count}</div>
          </div>
        );
      })}
      <div className="pt-2 flex gap-2 items-center">
        {most ? (
          <span className="text-xs rounded px-2 py-1" style={{ background: colors.primary, color: "#fff" }}>
            Most: {most.label} ({most.count})
          </span>
        ) : null}
        {least ? (
          <span className="text-xs rounded px-2 py-1" style={{ background: "#FEE2E2", color: "#991B1B" }}>
            Least: {least.label} ({least.count})
          </span>
        ) : null}
      </div>
    </div>
  );
}
