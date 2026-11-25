"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getAuthHeaders,
  getBrowserAccount,
  isAppwriteClientConfigured,
} from "@/lib/appwrite/client";
import { isMfaRequiredError } from "@/lib/appwrite/mfa";

export interface ConnectedIdentity {
  id: string;
  provider: string;
  providerEmail: string;
  createdAt: string;
}

export interface UserAuthInfo {
  hasPassword: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  totpEnabled: boolean;
  recoveryCodeEnabled: boolean;
  identities: ConnectedIdentity[];
}

export type AuthRefreshResult =
  | "authenticated"
  | "mfa_required"
  | "unauthenticated";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: "user" | "admin";
  balanceMicroUsd: number;
  maxConcurrentPods: number;
  activePodCount: number;
  burnRateHrMicroUsd: number;
  auth?: UserAuthInfo;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  configured: boolean;
  mfaRequired: boolean;
  refreshProfile: () => Promise<AuthRefreshResult>;
  logout: () => Promise<void>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const configured = isAppwriteClientConfigured();

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const headers = await getAuthHeaders();
    return fetch(input, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
    });
  }, []);

  const refreshProfile = useCallback(async (): Promise<AuthRefreshResult> => {
    if (!configured) {
      setUser(null);
      setMfaRequired(false);
      setLoading(false);
      return "unauthenticated";
    }
    try {
      const account = getBrowserAccount();
      // Enforce 3-day max session policy even on older pre-policy sessions
      const MAX_SESSION_MS = 3 * 24 * 60 * 60 * 1000;
      const session = await account.getSession("current");
      const createdAtMs = new Date(session.$createdAt).getTime();
      const expireAtMs = new Date(session.expire).getTime();
      const nowMs = Date.now();
      if (
        nowMs - createdAtMs > MAX_SESSION_MS ||
        expireAtMs - createdAtMs > MAX_SESSION_MS + 60_000
      ) {
        await account.deleteSession("current");
        setUser(null);
        setMfaRequired(false);
        return "unauthenticated";
      }

      try {
        await account.get();
      } catch (err) {
        if (isMfaRequiredError(err)) {
          setUser(null);
          setMfaRequired(true);
          return "mfa_required";
        }
        throw err;
      }

      const res = await authFetch("/api/me");
      if (res.ok) {
        const data = (await res.json()) as { user: SessionUser };
        setUser(data.user);
        setMfaRequired(false);
        return "authenticated";
      } else {
        setUser(null);
        setMfaRequired(false);
        return "unauthenticated";
      }
    } catch (err) {
      if (isMfaRequiredError(err)) {
        setUser(null);
        setMfaRequired(true);
        return "mfa_required";
      }
      setUser(null);
      setMfaRequired(false);
      return "unauthenticated";
    } finally {
      setLoading(false);
    }
  }, [authFetch, configured]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    try {
      if (configured) {
        await getBrowserAccount().deleteSession("current");
      }
    } finally {
      setUser(null);
      setMfaRequired(false);
    }
  }, [configured]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured,
        mfaRequired,
        refreshProfile,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
