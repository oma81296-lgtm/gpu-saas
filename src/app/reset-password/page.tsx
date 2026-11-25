"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  getBrowserAccount,
  isAppwriteClientConfigured,
} from "@/lib/appwrite/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Input, Label } from "@/components/ui/primitives";

function ResetPasswordForm() {
  const searchParams = useSearchParams();

  // Capture recovery tokens on initial mount, then scrub from URL bar
  const [tokens] = useState(() => ({
    userId: searchParams.get("userId")?.trim() || "",
    secret: searchParams.get("secret")?.trim() || "",
  }));

  const hasValidParams = Boolean(tokens.userId && tokens.secret);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(
    hasValidParams
      ? null
      : "This password reset link is incomplete or invalid. Please request a new one."
  );

  useEffect(() => {
    try {
      const cleanUrl = new URL(window.location.href);
      if (
        cleanUrl.searchParams.has("userId") ||
        cleanUrl.searchParams.has("secret")
      ) {
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
  }, []);

  function handleKeyEvent(e: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasValidParams) {
      setError("Invalid or missing recovery token. Please request a new link.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isAppwriteClientConfigured()) {
      setError("Configure NEXT_PUBLIC_APPWRITE_PROJECT_ID in .env.local first.");
      return;
    }

    setSubmitting(true);
    try {
      const account = getBrowserAccount();
      await account.updateRecovery(tokens.userId, tokens.secret, password);
      setCompleted(true);
      toast.success("Password updated! You can now sign in.");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not reset password. The link may have expired.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between px-5 py-6 sm:px-8">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Sign in</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto my-auto w-full max-w-md py-10">
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/50 p-7 shadow-2xl shadow-black/25 backdrop-blur-md space-y-6">
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
              <KeyRound className="h-3 w-3 text-emerald-400" />
              New Password
            </span>
          </div>

          {completed ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="space-y-1">
                  <h1 className="text-sm font-semibold text-white">
                    Password updated
                  </h1>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Your password has been saved. You can now sign in with your
                    email and password, or continue using GitHub / Google.
                  </p>
                </div>
              </div>

              <Link href="/login" className="block w-full">
                <Button type="button" className="w-full h-10">
                  <span>Sign in to Console</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight text-white">
                  Choose a new password
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Use at least 8 characters. Your connected GitHub and Google
                  sign-in methods will remain linked.
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

              {!hasValidParams ? (
                <Link href="/forgot-password" className="block w-full">
                  <Button type="button" className="w-full h-10">
                    <span>Request a new reset link</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="new-password">New password</Label>
                      {capsLockOn && (
                        <span className="text-[11px] font-medium text-amber-400">
                          Caps Lock is on
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        autoFocus
                        required
                        minLength={8}
                        disabled={submitting}
                        value={password}
                        onKeyUp={handleKeyEvent}
                        onKeyDown={handleKeyEvent}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="Minimum 8 characters"
                        className="h-10 pl-9 pr-10 bg-zinc-950/60 border-zinc-800 focus-visible:border-emerald-500/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        disabled={submitting}
                        value={confirmPassword}
                        onKeyUp={handleKeyEvent}
                        onKeyDown={handleKeyEvent}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        placeholder="Re-enter your new password"
                        className="h-10 pl-9 bg-zinc-950/60 border-zinc-800 focus-visible:border-emerald-500/60"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-10 w-full font-semibold"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving password...</span>
                      </>
                    ) : (
                      <>
                        <span>Save new password</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between text-[11px] text-zinc-500">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <Link href="/login" className="hover:text-zinc-300 transition-colors">
          Sign in
        </Link>
      </footer>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Loading...</span>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
