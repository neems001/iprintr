"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type PrintRecord = {
  id: string;
  prompt: string;
  imageUrl: string;
  engine: string;
  createdAt: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
};

type AuthContextType = {
  user: User | null;
  history: PrintRecord[];
  login: (email: string, name: string) => void;
  logout: () => void;
  signup: (email: string, name: string) => void;
  addPrintToHistory: (print: PrintRecord) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<PrintRecord[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("iprintr_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    const storedHistory = localStorage.getItem("iprintr_history");
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);

  // Save to local storage whenever they change
  useEffect(() => {
    if (user) {
      localStorage.setItem("iprintr_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("iprintr_user");
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem("iprintr_history", JSON.stringify(history));
  }, [history]);

  const login = (email: string, name: string) => {
    // Mock login
    setUser({ id: "usr_" + Date.now(), email, name });
  };

  const signup = (email: string, name: string) => {
    // Mock signup
    setUser({ id: "usr_" + Date.now(), email, name });
  };

  const logout = () => {
    setUser(null);
  };

  const addPrintToHistory = (print: PrintRecord) => {
    setHistory((prev) => [print, ...prev]);
  };

  return (
    <AuthContext.Provider value={{ user, history, login, logout, signup, addPrintToHistory }}>
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
