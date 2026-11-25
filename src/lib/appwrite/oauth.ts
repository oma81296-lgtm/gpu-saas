"use client";

import { OAuthProvider } from "appwrite";
import { getBrowserAccount, isAppwriteClientConfigured } from "./client";

export type OAuthProviderId = "github" | "google";

export type OAuthAuthSource = "login" | "register";

export interface OAuthProviderMeta {
  id: OAuthProviderId;
  label: string;
  appwriteProvider: OAuthProvider;
  scopes: string[];
}

export const OAUTH_PROVIDERS: Record<OAuthProviderId, OAuthProviderMeta> = {
  github: {
    id: "github",
    label: "GitHub",
    appwriteProvider: OAuthProvider.Github,
    // Ensures we receive both profile info and primary verified email even when private
    scopes: ["read:user", "user:email"],
  },
  google: {
    id: "google",
    label: "Google",
    appwriteProvider: OAuthProvider.Google,
    scopes: ["openid", "email", "profile"],
  },
};

const OAUTH_STATE_STORAGE_KEY = "voltgpu_oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface StoredOAuthState {
  provider: OAuthProviderId;
  next: string;
  source: OAuthAuthSource;
  startedAt: number;
}

/**
 * Prevents open redirects by allowing only relative same-origin paths.
 */
export function sanitizeNextPath(
  raw: string | null | undefined,
  fallback = "/console"
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\")
  ) {
    return fallback;
  }
  return trimmed;
}

export function isOAuthProviderId(
  value: string | null | undefined
): value is OAuthProviderId {
  return value === "github" || value === "google";
}

function saveOAuthState(state: StoredOAuthState): void {
  try {
    window.sessionStorage.setItem(
      OAUTH_STATE_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage quota or private-mode restrictions; URL params still carry state.
  }
}

export function consumeOAuthState(): StoredOAuthState | null {
  try {
    const raw = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredOAuthState>;
    if (
      !parsed ||
      !isOAuthProviderId(parsed.provider) ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.startedAt > OAUTH_STATE_TTL_MS) {
      return null;
    }
    return {
      provider: parsed.provider,
      next: sanitizeNextPath(parsed.next),
      source: parsed.source === "register" ? "register" : "login",
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

export interface StartOAuthOptions {
  next?: string | null;
  source?: OAuthAuthSource;
}

/**
 * Starts a cookie-resilient Appwrite OAuth2 token flow for GitHub or Google.
 *
 * Uses `createOAuth2Token` -> `/auth/callback` -> `createSession(userId, secret)`
 * instead of `createOAuth2Session` so authentication works reliably across Safari ITP,
 * Brave, Firefox ETP, localhost, and cross-origin Appwrite Cloud deployments.
 */
export function startOAuthFlow(
  provider: OAuthProviderId,
  options: StartOAuthOptions = {}
): void {
  if (!isAppwriteClientConfigured()) {
    throw new Error(
      "Configure NEXT_PUBLIC_APPWRITE_PROJECT_ID in .env.local first."
    );
  }

  const meta = OAUTH_PROVIDERS[provider];
  const origin = window.location.origin;
  const source: OAuthAuthSource =
    options.source === "register" ? "register" : "login";
  const safeNext = sanitizeNextPath(options.next);
  const hasCustomNext = Boolean(options.next && safeNext !== "/console");

  saveOAuthState({
    provider,
    next: safeNext,
    source,
    startedAt: Date.now(),
  });

  const successParams = new URLSearchParams({
    provider,
    source,
    next: safeNext,
  });

  const failureParams = new URLSearchParams({
    error: "oauth_failed",
    provider,
  });
  if (hasCustomNext) {
    failureParams.set("next", safeNext);
  }

  const successUrl = `${origin}/auth/callback?${successParams.toString()}`;
  const failureUrl = `${origin}/${source}?${failureParams.toString()}`;

  const account = getBrowserAccount();
  account.createOAuth2Token(
    meta.appwriteProvider,
    successUrl,
    failureUrl,
    meta.scopes
  );
}

/**
 * Completes the Appwrite OAuth2 token exchange on `/auth/callback`.
 * Handles stale active sessions gracefully by clearing and retrying once.
 */
export async function completeOAuthSession(
  userId: string,
  secret: string
): Promise<void> {
  const account = getBrowserAccount();
  try {
    await account.createSession(userId, secret);
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "type" in err
        ? String((err as { type?: unknown }).type)
        : "";
    const message = err instanceof Error ? err.message.toLowerCase() : "";

    // If an active session already exists in this browser, replace it cleanly.
    if (
      code === "user_session_already_exists" ||
      message.includes("session is active")
    ) {
      await account.deleteSession("current").catch(() => {});
      await account.createSession(userId, secret);
      return;
    }
    throw err;
  }
}

/**
 * Maps OAuth redirect error codes into user-friendly, actionable messages.
 */
export function getOAuthErrorMessage(
  errorCode: string | null | undefined,
  provider?: string | null
): string | null {
  if (!errorCode) return null;

  const providerLabel = isOAuthProviderId(provider)
    ? OAUTH_PROVIDERS[provider].label
    : "OAuth";

  switch (errorCode) {
    case "oauth_failed":
      return `${providerLabel} sign-in was cancelled or could not be completed. Verify that ${providerLabel} OAuth is enabled in your Appwrite project, or sign in with email.`;
    case "oauth_missing_params":
      return `${providerLabel} returned an incomplete authorization response. Please try signing in again.`;
    case "oauth_exchange_failed":
      return `Could not finalize your ${providerLabel} session. The authorization token may have expired—please try again.`;
    case "oauth_profile_failed":
      return `Signed in with ${providerLabel}, but we couldn't load your VoltGPU profile. Please try again.`;
    default:
      return `${providerLabel} authentication failed. Please try again or use email sign-in.`;
  }
}
