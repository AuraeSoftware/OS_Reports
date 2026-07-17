import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../AuthContext.jsx";
import { useToast } from "../ToastContext.jsx";
import { initials, RolePill } from "../utils.jsx";

export default function Users() {
  const [users, setUsers] = useState([]);
  const { user: currentUser } = useAuth();
  const toast = useToast();

  function load() {
    api.admin.users().then(setUsers);
  }
  useEffect(load, []);

  async function handleRoleChange(userId, role) {
    try {
      await api.admin.updateRole(userId, role);
      toast("Role updated", "success");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
        <p>Manage roles across the team. The first person to sign up is always an admin.</p>
      </div>
      {users.map((u) => (
        <div key={u.id} className="user-row">
          <div className="user-avatar" style={{ background: "var(--amber)", color: "var(--amber-ink)" }}>
            {initials(u.full_name)}
          </div>
          <div className="user-row-meta">
            <div className="user-row-name">{u.full_name}</div>
            <div className="user-row-email">
              {u.email} · {u.report_count} report{u.report_count === 1 ? "" : "s"}
            </div>
          </div>
          <RolePill role={u.role} />
          <select
            className="role-select"
            value={u.role}
            disabled={u.id === currentUser.id}
            title={u.id === currentUser.id ? "You cannot change your own role" : ""}
            onChange={(e) => handleRoleChange(u.id, e.target.value)}
          >
            <option value="user">User</option>
            <option value="reviewer">Reviewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      ))}
    </>
  );
}
