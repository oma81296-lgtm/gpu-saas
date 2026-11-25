"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  getBrowserAccount,
  isAppwriteClientConfigured,
} from "@/lib/appwrite/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Input, Label } from "@/components/ui/primitives";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isAppwriteClientConfigured()) {
      const msg =
        "Configure NEXT_PUBLIC_APPWRITE_PROJECT_ID in .env.local first.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      const account = getBrowserAccount();
      const resetUrl = `${window.location.origin}/reset-password`;
      await account.createRecovery(trimmedEmail, resetUrl);
      setSentTo(trimmedEmail);
      toast.success("Password reset link sent! Check your inbox.");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not send password recovery email.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between px-5 py-6 sm:px-8">
      {/* Top Bar */}
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

      {/* Main Card */}
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
              Recovery
            </span>
          </div>

          {sentTo ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="space-y-1">
                  <h1 className="text-sm font-semibold text-white">
                    Check your inbox
                  </h1>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    We sent a secure password reset link to{" "}
                    <span className="font-mono font-medium text-white">
                      {sentTo}
                    </span>
                    . Open the link to choose a new password.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSentTo(null)}
                  className="w-full h-10"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Send to a different email</span>
                </Button>
                <Link href="/login" className="w-full">
                  <Button type="button" className="w-full h-10">
                    <span>Return to Sign in</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="text-xl font-semibold tracking-tight text-white">
                  Reset or set your password
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enter your account email and we&apos;ll send a one-time link to
                  reset your password—or to add a password if you originally
                  signed up with GitHub or Google.
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
                  <Label htmlFor="email">Account email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      disabled={submitting}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="you@company.com"
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
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send reset link</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
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

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Loading...</span>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
