import React from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import UsersDashboard from "../dashboard/Users.jsx";
import Analytics from "./Analytics.jsx";

function TabLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname.endsWith(to) || (to === "" && /\/users\/?$/.test(location.pathname));
  return (
    <Link
      to={to}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: `1px solid ${isActive ? "#2563EB" : "#e5e7eb"}`,
        color: isActive ? "#2563EB" : "#111827",
        textDecoration: "none",
        background: isActive ? "rgba(37,99,235,0.08)" : "#fff"
      }}
    >
      {children}
    </Link>
  );
}

/**
 * PUBLIC_INTERFACE
 * UsersIndex with sub-navigation for Analytics
 */
export default function UsersIndex() {
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <TabLink to="">Users</TabLink>
        <TabLink to="analytics">Analytics</TabLink>
      </div>
      <Routes>
        <Route index element={<UsersDashboard />} />
        <Route path="analytics" element={<Analytics />} />
      </Routes>
    </div>
  );
}
