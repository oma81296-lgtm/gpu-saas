"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  completeOAuthSession,
  consumeOAuthState,
  getOAuthErrorMessage,
  isOAuthProviderId,
  OAUTH_PROVIDERS,
  sanitizeNextPath,
  startOAuthFlow,
  type OAuthAuthSource,
  type OAuthProviderId,
} from "@/lib/appwrite/oauth";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/primitives";

type CallbackStage = "exchanging" | "hydrating" | "redirecting" | "error";

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();

  // Guard against React Strict Mode double-execution consuming the single-use OAuth token twice
  const hasStartedRef = useRef(false);

  const userId = searchParams.get("userId")?.trim() || "";
  const secret = searchParams.get("secret")?.trim() || "";
  const hasTokenParams = Boolean(userId && secret);

  const [meta] = useState<{
    provider: OAuthProviderId | null;
    next: string;
    source: OAuthAuthSource;
  }>(() => {
    const stored = typeof window !== "undefined" ? consumeOAuthState() : null;
    const rawProvider = searchParams.get("provider");
    const provider: OAuthProviderId | null = isOAuthProviderId(rawProvider)
      ? rawProvider
      : stored?.provider ?? null;
    const next = sanitizeNextPath(
      searchParams.get("next") || stored?.next,
      "/console"
    );
    const source: OAuthAuthSource =
      searchParams.get("source") === "register" || stored?.source === "register"
        ? "register"
        : "login";
    return { provider, next, source };
  });

  const [stage, setStage] = useState<CallbackStage>(
    hasTokenParams ? "exchanging" : "error"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    hasTokenParams
      ? null
      : getOAuthErrorMessage("oauth_missing_params", meta.provider)
  );

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    // Immediately scrub sensitive userId & secret tokens from the browser URL bar
    try {
      const cleanUrl = new URL(window.location.href);
      if (cleanUrl.searchParams.has("userId") || cleanUrl.searchParams.has("secret")) {
        cleanUrl.searchParams.delete("userId");
        cleanUrl.searchParams.delete("secret");
        window.history.replaceState(
          {},
          document.title,
          cleanUrl.pathname + cleanUrl.search
        );
      }
    } catch {
      // Non-fatal
    }

    if (!hasTokenParams) return;

    const providerLabel = meta.provider
      ? OAUTH_PROVIDERS[meta.provider].label
      : "OAuth";

    async function runExchange() {
      try {
        await completeOAuthSession(userId, secret);

        setStage("hydrating");
        const status = await refreshProfile();

        if (status === "mfa_required") {
          setStage("redirecting");
          toast.info("Enter your 2FA code to complete sign-in.");
          router.replace(
            meta.next !== "/console"
              ? `/mfa-challenge?next=${encodeURIComponent(meta.next)}`
              : "/mfa-challenge"
          );
          return;
        }

        setStage("redirecting");
        toast.success(`Signed in with ${providerLabel}`);
        router.replace(meta.next);
      } catch (err) {
        const fallback =
          getOAuthErrorMessage("oauth_exchange_failed", meta.provider) ||
          "Could not complete OAuth sign-in.";
        const detail =
          err instanceof Error && err.message
            ? `${fallback} (${err.message})`
            : fallback;
        setErrorMessage(detail);
        setStage("error");
        toast.error(`Failed to complete ${providerLabel} sign-in`);
      }
    }

    void runExchange();
  }, [hasTokenParams, meta.next, meta.provider, refreshProfile, router, secret, userId]);

  const providerLabel = meta.provider
    ? OAUTH_PROVIDERS[meta.provider].label
    : "OAuth";

  const returnHref =
    meta.next !== "/console"
      ? `/${meta.source}?next=${encodeURIComponent(meta.next)}`
      : `/${meta.source}`;

  function handleRetry() {
    if (!meta.provider) {
      router.replace(returnHref);
      return;
    }
    try {
      startOAuthFlow(meta.provider, {
        next: meta.next,
        source: meta.source,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not restart OAuth sign-in"
      );
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-7 shadow-2xl shadow-black/25 backdrop-blur-md space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-base tracking-tight text-white">
              {BRAND.name}
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            OAuth 2.0
          </span>
        </div>

        {stage === "error" ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div className="space-y-1">
                <h1 className="text-sm font-semibold text-white">
                  {providerLabel} sign-in couldn&apos;t be completed
                </h1>
                <p className="text-xs text-red-400/90 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {meta.provider && (
                <Button type="button" onClick={handleRetry} className="w-full h-10">
                  <RefreshCw className="h-4 w-4" />
                  <span>Try again with {providerLabel}</span>
                </Button>
              )}
              <Link href={returnHref} className="w-full">
                <Button type="button" variant="outline" className="w-full h-10">
                  <ArrowLeft className="h-4 w-4" />
                  <span>
                    Back to {meta.source === "register" ? "Sign up" : "Sign in"}
                  </span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold text-white">
                {stage === "redirecting"
                  ? `Welcome to ${BRAND.name}`
                  : `Completing ${providerLabel} sign-in`}
              </h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {stage === "exchanging" &&
                  "Verifying your authorization token and establishing a secure session..."}
                {stage === "hydrating" &&
                  "Loading your GPU workspace, credit wallet, and SSH keys..."}
                {stage === "redirecting" &&
                  "Session verified! Redirecting you now..."}
              </p>
            </div>

            {/* Step progress indicators */}
            <div className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 text-xs">
              <div className="flex items-center gap-2.5">
                {stage === "exchanging" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
                <span
                  className={
                    stage === "exchanging" ? "text-white font-medium" : "text-zinc-400"
                  }
                >
                  Exchange {providerLabel} OAuth token
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {stage === "hydrating" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
                ) : stage === "redirecting" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-zinc-700 shrink-0" />
                )}
                <span
                  className={
                    stage === "hydrating"
                      ? "text-white font-medium"
                      : stage === "redirecting"
                        ? "text-zinc-400"
                        : "text-zinc-500"
                  }
                >
                  Provision &amp; hydrate {BRAND.name} profile
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Verifying sign-in...</span>
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
