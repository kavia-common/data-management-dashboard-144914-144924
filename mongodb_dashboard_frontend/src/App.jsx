import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import UsersPage from "./pages/Users";
import OverviewPage from "./pages/Overview";

// PUBLIC_INTERFACE
// App is the route host for the application. It renders top-level routes.
export default function App() {
  return (
    <Routes>
      {/* Default redirect to overview */}
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/users" element={<UsersPage />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
