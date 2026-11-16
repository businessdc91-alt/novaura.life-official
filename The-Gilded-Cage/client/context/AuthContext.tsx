import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

// Builds without a server address (the copy bundled in Novaura Sovereign OS)
// play offline: the player gets a local profile and saves stay on the device.
const OFFLINE = !process.env.EXPO_PUBLIC_DOMAIN;
const LOCAL_USER_KEY = "@gilded_cage/local_user";
const localUser = (username?: string): AuthUser => ({ id: "local", username: (username || "").trim().slice(0, 24) || "Traveller" });

interface AuthUser {
  id: string;
  username: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    if (OFFLINE) {
      try {
        const saved = await AsyncStorage.getItem(LOCAL_USER_KEY);
        setUser(saved ? localUser(JSON.parse(saved).username) : localUser());
      } catch {
        setUser(localUser());
      } finally {
        setIsLoading(false);
      }
      return;
    }
    try {
      const url = new URL("/api/auth/me", getApiUrl()).toString();
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signInLocally = async (username: string) => {
    const u = localUser(username.startsWith("guest_") ? "" : username);
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u)).catch(() => {});
    setUser(u);
  };

  const login = async (username: string, password: string) => {
    if (OFFLINE) return signInLocally(username);
    const url = new URL("/api/auth/login", getApiUrl()).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }
    setUser(data);
  };

  const register = async (username: string, password: string) => {
    if (OFFLINE) return signInLocally(username);
    const url = new URL("/api/auth/register", getApiUrl()).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Registration failed");
    }
    setUser(data);
  };

  const logout = async () => {
    if (OFFLINE) {
      await AsyncStorage.removeItem(LOCAL_USER_KEY).catch(() => {});
      setUser(null);
      return;
    }
    const url = new URL("/api/auth/logout", getApiUrl()).toString();
    await fetch(url, { method: "POST", credentials: "include" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
