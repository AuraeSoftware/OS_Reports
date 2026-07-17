import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { Icon } from "./Icon.jsx";
import { initials } from "../utils.jsx";

export default function Shell() {
  const { user, isAdmin, isStaff, logout } = useAuth();

  const navItems = [
    ...(isAdmin ? [{ to: "/overview", label: "Overview", Icon: Icon.Overview }] : []),
    { to: "/dashboard", label: isStaff ? "Team Reports" : "Reports", Icon: Icon.Dashboard },
    { to: "/templates", label: "Templates", Icon: Icon.Templates },
    ...(isAdmin ? [{ to: "/users", label: "Users", Icon: Icon.Users }] : []),
  ];

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">OR</div>
          <div className="brand-name">OS Reports</div>
        </div>
        <div className="user-avatar">{initials(user?.fullName)}</div>
      </div>
      <div className="shell">
        <div className="sidebar">
          <div className="brand">
            <div className="brand-mark">OR</div>
            <div>
              <div className="brand-name">OS Reports</div>
              <div className="brand-sub">OS2 Studio</div>
            </div>
          </div>
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <n.Icon width={18} height={18} />
              <span>{n.label}</span>
            </NavLink>
          ))}
          <NavLink to="/new-report" className="nav-item" style={{ marginTop: 6 }}>
            <Icon.Plus width={18} height={18} />
            <span>New report</span>
          </NavLink>
          <div className="sidebar-foot">
            <div className="user-chip">
              <div className="user-avatar">{initials(user?.fullName)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="user-name">{user?.fullName}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
        <div className="main">
          <div className="container">
            <Outlet />
          </div>
        </div>
      </div>
      <div className="bottom-nav">
        {navItems.slice(0, 3).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
            <n.Icon width={20} height={20} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <NavLink to="/new-report" className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}>
          <Icon.Plus width={20} height={20} />
          <span>New</span>
        </NavLink>
      </div>
    </div>
  );
}
