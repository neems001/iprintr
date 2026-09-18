"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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

type SessionResponse = {
  user: User | null;
  history: PrintRecord[];
  oauthConfigured: boolean;
  error?: string;
};

type AuthContextType = {
  user: User | null;
  history: PrintRecord[];
  isLoading: boolean;
  oauthConfigured: boolean;
  addPrintToHistory: (print: PrintRecord) => void;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadSession() {
  const response = await fetch("/api/session", { cache: "no-store" });
  const data = (await response.json()) as SessionResponse;
  if (!response.ok) throw new Error(data.error || "Session request failed");
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<PrintRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [oauthConfigured, setOAuthConfigured] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const data = await loadSession();
      setUser(data.user);
      setHistory(data.history);
      setOAuthConfigured(data.oauthConfigured);
    } catch (error) {
      console.error(
        "Failed to load the session:",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void loadSession()
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        setHistory(data.history);
        setOAuthConfigured(data.oauthConfigured);
      })
      .catch((error) => {
        console.error(
          "Failed to load the session:",
          error instanceof Error ? error.message : "Unknown error",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const addPrintToHistory = useCallback((print: PrintRecord) => {
    setHistory((previous) => [print, ...previous]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        history,
        isLoading,
        oauthConfigured,
        addPrintToHistory,
        refreshSession,
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
