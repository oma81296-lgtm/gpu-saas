"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  completeMfaChallenge,
  listAvailableMfaFactors,
  type MfaChallengeMode,
} from "@/lib/appwrite/mfa";
import { sanitizeNextPath } from "@/lib/appwrite/oauth";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Input, Label } from "@/components/ui/primitives";

function MfaChallengeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshProfile, logout } = useAuth();

  const safeNext = sanitizeNextPath(searchParams.get("next"), "/console");

  const [mode, setMode] = useState<MfaChallengeMode>("totp");
  const [hasRecoveryCode, setHasRecoveryCode] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(safeNext);
    }
  }, [authLoading, router, safeNext, user]);

  useEffect(() => {
    let active = true;
    void listAvailableMfaFactors()
      .then((factors) => {
        if (!active) return;
        setHasRecoveryCode(Boolean(factors.recoveryCode));
        if (!factors.totp && factors.recoveryCode) {
          setMode("recoverycode");
        }
      })
      .catch(() => {
        // Default to totp + recovery toggle if factors endpoint isn't reachable
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setError(
        mode === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter one of your backup recovery codes."
      );
      return;
    }

    setSubmitting(true);
    try {
      await completeMfaChallenge(mode, trimmed);
      const status = await refreshProfile();
      if (status === "authenticated") {
        toast.success("Two-factor authentication verified!");
        router.replace(safeNext);
      } else {
        setError(
          "Verification succeeded, but your session could not be loaded. Please sign in again."
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Invalid verification code. Please check your authenticator app and try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelAndSignOut() {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between px-5 py-6 sm:px-8">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Zap className="h-4 w-4" />
          </span>
          <span className="text-base tracking-tight text-white">
            {BRAND.name}
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto my-auto w-full max-w-md py-10">
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-7 shadow-2xl shadow-black/25 backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
              {mode === "totp" ? (
                <Smartphone className="h-5 w-5" />
              ) : (
                <KeyRound className="h-5 w-5" />
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              2FA Required
            </span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Two-factor verification
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {mode === "totp"
                ? "Enter the 6-digit code generated by your authenticator app (Google Authenticator, 1Password, Authy, etc.)."
                : "Enter one of your single-use backup recovery codes to access your account."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs text-red-400"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code">
                {mode === "totp" ? "6-digit authentication code" : "Recovery code"}
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode={mode === "totp" ? "numeric" : "text"}
                autoComplete="one-time-code"
                autoFocus
                required
                disabled={submitting}
                value={code}
                onChange={(e) => {
                  const val =
                    mode === "totp"
                      ? e.target.value.replace(/[^\d\s]/g, "").slice(0, 7)
                      : e.target.value;
                  setCode(val);
                  if (error) setError(null);
                }}
                placeholder={mode === "totp" ? "123456" : "xxxxx-xxxxx"}
                className="h-11 text-center font-mono text-base tracking-[0.25em] bg-zinc-950/60 border-zinc-800 focus-visible:border-emerald-500/60"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-10 w-full font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify &amp; Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="space-y-2.5 border-t border-zinc-800/80 pt-4 text-center">
            {hasRecoveryCode && (
              <button
                type="button"
                onClick={() => {
                  setMode((prev) =>
                    prev === "totp" ? "recoverycode" : "totp"
                  );
                  setCode("");
                  setError(null);
                }}
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                {mode === "totp"
                  ? "Use a backup recovery code instead"
                  : "Use authenticator app code instead"}
              </button>
            )}

            <div>
              <button
                type="button"
                disabled={signingOut}
                onClick={handleCancelAndSignOut}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>
                  {signingOut ? "Signing out..." : "Cancel & sign in with another account"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between text-[11px] text-zinc-500">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <span>Protected by TOTP 2FA</span>
      </footer>
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Loading verification...</span>
        </div>
      }
    >
      <MfaChallengeInner />
    </Suspense>
  );
}
