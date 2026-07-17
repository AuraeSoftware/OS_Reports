import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api.me();
      setUser(me);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function logout() {
    await api.logout();
    setUser(null);
  }

  const isStaff = user && (user.role === "admin" || user.role === "reviewer");
  const isAdmin = user && user.role === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, isStaff, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
