import React from "react";
import PropTypes from "prop-types";

/**
 * PUBLIC_INTERFACE
 * Card
 * Lightweight themed card wrapper providing header, subtitle, optional actions, and content slots.
 */
export default function Card({ title, subtitle, actions, children, className, style, ariaLabel }) {
  return (
    <div
      className={className ? `card ${className}` : "card"}
      style={{ position: "relative", ...style }}
      aria-label={ariaLabel}
    >
      {(title || subtitle || actions) && (
        <div
          className="card-header"
          style={{
            paddingBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            {title && <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions ? (
            <div
              className="card-actions"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginLeft: "auto",
              }}
            >
              {actions}
            </div>
          ) : null}
        </div>
      )}
      <div className="card-content" style={{ position: "relative", zIndex: 0 }}>{children}</div>
    </div>
  );
}

Card.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
  ariaLabel: PropTypes.string,
};
