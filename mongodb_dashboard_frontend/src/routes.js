import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AgentsAnalytics from './pages/AgentsAnalytics';
import TenantSelection from './pages/TenantSelection';

// PUBLIC_INTERFACE
export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/agents" replace />} />
        <Route path="/agents" element={<AgentsAnalytics />} />
        <Route path="/tenant" element={<TenantSelection />} />
      </Routes>
    </Router>
  );
}
