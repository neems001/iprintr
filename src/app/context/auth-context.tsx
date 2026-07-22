"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type PrintRecord = {
  id: string;
  prompt: string;
  imageUrl: string;
  engine: string;
  createdAt: string;
  userId?: string | null;
};

export type User = {
  id: string;
  email: string;
  name: string;
};

type AuthContextType = {
  user: User | null;
  history: PrintRecord[];
  login: (email: string, name: string) => Promise<void>;
  logout: () => void;
  signup: (email: string, name: string) => Promise<void>;
  addPrintToHistory: (print: PrintRecord) => void;
  refreshHistory: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<PrintRecord[]>([]);

  const fetchHistory = useCallback(async (currentUserId?: string | null) => {
    try {
      const url = currentUserId ? `/api/history?userId=${currentUserId}` : "/api/history";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Failed to fetch print history from database:", err);
    }
  }, []);

  // Fetch history from DB on initial mount or user change
  useEffect(() => {
    fetchHistory(user?.id);
  }, [user, fetchHistory]);

  const login = async (email: string, name: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", email, name }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    setUser(data.user);
    await fetchHistory(data.user.id);
  };

  const signup = async (email: string, name: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signup", email, name }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Signup failed");
    }

    setUser(data.user);
    await fetchHistory(data.user.id);
  };

  const logout = () => {
    setUser(null);
    fetchHistory(null);
  };

  const addPrintToHistory = (print: PrintRecord) => {
    setHistory((prev) => [print, ...prev]);
  };

  const refreshHistory = async () => {
    await fetchHistory(user?.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        history,
        login,
        logout,
        signup,
        addPrintToHistory,
        refreshHistory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
