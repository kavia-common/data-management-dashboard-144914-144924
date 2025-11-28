import React from "react";

/**
 * PUBLIC_INTERFACE
 * GatewayErrorHint
 * Small inline hint offering a "Try smaller page size" action for 5xx/timeout issues.
 *
 * Props:
 * - onTrySmaller?: () => void
 */
export default function GatewayErrorHint({ onTrySmaller }) {
  return (
    <div
      role="note"
      style={{
        marginTop: 6,
        fontSize: 12,
        color: "var(--text-secondary, #374151)",
      }}
    >
      Tip: If the server is busy, try a smaller page size or a narrower time range.
      {" "}
      {onTrySmaller ? (
        <button
          type="button"
          onClick={onTrySmaller}
          className="link"
          style={{
            marginLeft: 6,
            color: "#2563EB",
            textDecoration: "underline",
            background: "transparent",
            border: 0,
            cursor: "pointer",
            padding: 0,
          }}
          aria-label="Try smaller page size"
        >
          Try smaller page size
        </button>
      ) : null}
    </div>
  );
}
