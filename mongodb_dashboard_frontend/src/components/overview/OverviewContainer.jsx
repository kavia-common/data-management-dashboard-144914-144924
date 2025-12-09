import React from 'react';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer
 * Minimal container applying overview grid spacing and background.
 */
export default function OverviewContainer({ children }) {
  return <div className="overview-container overview-page">{children}</div>;
}
