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

const USER_STORAGE_KEY = "iprintr_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<PrintRecord[]>([]);

  // Restore user session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        if (parsed.id && parsed.email && parsed.name) {
          setUser(parsed);
        } else {
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  const fetchHistory = useCallback(async (currentUserId?: string | null) => {
    // Guests don't fetch from DB — their history is client-side only
    if (!currentUserId) return;

    try {
      const res = await fetch(`/api/history?userId=${currentUserId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Failed to fetch print history from database:", err);
    }
  }, []);

  // Fetch history from DB when user changes (login, logout, or restored from localStorage)
  useEffect(() => {
    fetchHistory(user?.id);
  }, [user, fetchHistory]);

  // Shared login/signup logic — server does find-or-create either way
  const authenticate = async (email: string, name: string, action: "login" | "signup") => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email, name }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Authentication failed");
    }

    setUser(data.user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    // fetchHistory is triggered automatically by the useEffect on `user`
  };

  const login = async (email: string, name: string) => {
    await authenticate(email, name, "login");
  };

  const signup = async (email: string, name: string) => {
    await authenticate(email, name, "signup");
  };

  const logout = () => {
    setUser(null);
    setHistory([]);
    localStorage.removeItem(USER_STORAGE_KEY);
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
