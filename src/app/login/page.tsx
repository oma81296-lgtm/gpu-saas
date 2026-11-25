"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import {
  getBrowserAccount,
  isAppwriteClientConfigured,
} from "@/lib/appwrite/client";
import {
  getOAuthErrorMessage,
  sanitizeNextPath,
  type OAuthProviderId,
} from "@/lib/appwrite/oauth";
import { useAuth } from "@/components/auth-provider";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Input, Label } from "@/components/ui/primitives";

const PLATFORM_HIGHLIGHTS = [
  {
    icon: Cpu,
    title: "Dedicated Secure-Tier Silicon",
    description:
      "Isolated NVIDIA H100, H200, B200 & RTX 5090 pods with guaranteed VRAM.",
  },
  {
    icon: Gauge,
    title: "Per-Second Prepaid Billing",
    description:
      "Strict credit wallet controls with zero surprise invoices or idle lock-in.",
  },
  {
    icon: Terminal,
    title: "SSH, Templates & Native MCP",
    description:
      "Launch PyTorch, vLLM, or ComfyUI in seconds—or orchestrate via MCP.",
  },
] as const;

function BrandShowcasePanel() {
  return (
    <aside className="relative hidden lg:flex lg:w-[54%] xl:w-[56%] flex-col justify-between overflow-hidden border-r border-zinc-800/80 bg-zinc-900/40 p-10 xl:p-14">
      {/* Subtle architectural grid & ambient radial light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--color-zinc-700) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-24 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"
      />

      {/* Top brand lockup */}
      <div className="relative z-10 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-semibold group"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm transition-transform group-hover:scale-105">
            <Zap className="h-4 w-4" />
          </span>
          <span className="text-lg tracking-tight text-white">{BRAND.name}</span>
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          All GPU Regions Operational
        </span>
      </div>

      {/* Center hero + live pod telemetry card */}
      <div className="relative z-10 my-auto py-10 space-y-8 max-w-xl">
        <div className="space-y-3.5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Enterprise AI Infrastructure
          </p>
          <h2 className="text-3xl xl:text-4xl font-semibold tracking-tight text-white leading-[1.15]">
            Spin up dedicated NVIDIA clusters in{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              seconds
            </span>
            .
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
            {BRAND.tagline}. Manage bare-metal speed pods, persistent volumes,
            and API keys from one unified control plane.
          </p>
        </div>

        {/* Sleek Compute Node Preview Card */}
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/85 p-5 shadow-2xl shadow-black/20 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                <Cpu className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  8× NVIDIA H100 SXM5
                </p>
                <p className="text-[11px] font-mono text-zinc-400">
                  pod-8f2a9c • Secure Tier • us-east
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Running
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 py-3.5 border-b border-zinc-800/80">
            <div>
              <p className="text-[11px] text-zinc-500">Total VRAM</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-white">
                640 GB
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Cold Start</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-white">
                14.2s
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Metering</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-400">
                Per-Second
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 font-mono text-xs text-zinc-300">
            <span className="truncate">
              <span className="text-emerald-400 select-none">$ </span>
              ssh root@pod-8f2a9c.voltgpu.io -p 22014
            </span>
            <span className="ml-2 shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              ED25519
            </span>
          </div>
        </div>

        {/* Platform Highlights */}
        <div className="grid grid-cols-1 gap-3.5 pt-1">
          {PLATFORM_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/80 text-emerald-400">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Trust Strip */}
      <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-zinc-800/80 pt-5 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          TLS 1.3 &amp; Isolated Tenants
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
          Short-Lived JWT Sessions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          No Subscriptions Required
        </span>
      </div>
    </aside>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, mfaRequired, refreshProfile } = useAuth();

  const rawNext = searchParams.get("next") || "";
  const safeNext = sanitizeNextPath(rawNext, "/console");
  const hasCustomNext = Boolean(rawNext && safeNext !== "/console");
  const oauthErrorParam = searchParams.get("error");
  const oauthProviderParam = searchParams.get("provider");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProviderId | null>(null);
  const [formError, setFormError] = useState<string | null>(
    getOAuthErrorMessage(oauthErrorParam, oauthProviderParam)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!isAppwriteClientConfigured()) {
      const msg =
        "Configure NEXT_PUBLIC_APPWRITE_PROJECT_ID in .env.local first.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const account = getBrowserAccount();
      await account.createEmailPasswordSession(email.trim(), password);
      const status = await refreshProfile();
      if (status === "mfa_required") {
        toast.info("Enter your 2FA verification code to finish signing in.");
        router.push(
          safeNext !== "/console"
            ? `/mfa-challenge?next=${encodeURIComponent(safeNext)}`
            : "/mfa-challenge"
        );
        return;
      }
      toast.success("Welcome back!");
      router.push(safeNext);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please try again.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePasswordKeyEvent(e: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }

  const isBusy = submitting || oauthLoading !== null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col lg:flex-row">
      {/* Left Brand Showcase Panel (Desktop) */}
      <BrandShowcasePanel />

      {/* Right Authentication Surface */}
      <main className="relative flex flex-1 flex-col justify-between px-5 py-6 sm:px-8 lg:px-12 xl:px-16">
        {/* Top Utility Bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
            <span className="h-3.5 w-px bg-zinc-800 lg:hidden" />
            <Link
              href="/"
              className="inline-flex lg:hidden items-center gap-2 font-semibold"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm text-white">{BRAND.name}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/marketplace"
              className="hidden sm:inline-flex text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Live GPUs
            </Link>
            <ThemeToggle />
          </div>
        </header>

        {/* Centered Auth Form Container */}
        <div className="mx-auto w-full max-w-[400px] py-10">
          {/* Pending 2FA Verification Banner */}
          {!authLoading && mfaRequired && (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-300">
                  2FA verification required
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  Complete two-factor verification to unlock your session.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  router.push(
                    safeNext !== "/console"
                      ? `/mfa-challenge?next=${encodeURIComponent(safeNext)}`
                      : "/mfa-challenge"
                  )
                }
                className="shrink-0"
              >
                Verify 2FA
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Active Session Quick-Continue Banner */}
          {!authLoading && user && (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-300">
                  Signed in as {user.email}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  Your session is active. Continue straight to the console.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => router.push(safeNext)}
                className="shrink-0"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Heading */}
          <div className="space-y-2">
            {hasCustomNext && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                <Lock className="h-3 w-3 text-emerald-400" />
                Sign in to continue to{" "}
                <span className="font-mono text-white">{safeNext}</span>
              </span>
            )}
            <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-white">
              Welcome back
            </h1>
            <p className="text-sm text-zinc-400">
              Sign in to access your GPU pods, SSH keys, and prepaid wallet.
            </p>
          </div>

          {/* Inline Error Alert */}
          {formError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs text-red-400"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1 leading-relaxed">{formError}</p>
              <button
                type="button"
                onClick={() => setFormError(null)}
                aria-label="Dismiss error"
                className="shrink-0 rounded p-0.5 text-red-400/80 hover:text-red-300 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* OAuth Providers */}
          <div className="mt-6">
            <OAuthButtons
              source="login"
              next={safeNext}
              disabled={submitting}
              onError={(msg) => setFormError(msg)}
              onLoadingChange={(p) => {
                if (p) setFormError(null);
                setOauthLoading(p);
              }}
            />
          </div>

          {/* Divider */}
          <div className="relative my-6 flex items-center">
            <div className="flex-1 border-t border-zinc-800" />
            <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              or with email
            </span>
            <div className="flex-1 border-t border-zinc-800" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-zinc-300">
                Work or personal email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={isBusy}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="you@company.com"
                  className="h-10 pl-9 bg-zinc-900/40 border-zinc-800 focus-visible:border-emerald-500/60"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium text-zinc-300"
                >
                  Password
                </Label>
                <div className="flex items-center gap-2.5">
                  {capsLockOn && (
                    <span className="text-[11px] font-medium text-amber-400">
                      Caps Lock is on
                    </span>
                  )}
                  <Link
                    href={
                      email.trim()
                        ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                        : "/forgot-password"
                    }
                    className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={isBusy}
                  value={password}
                  onKeyUp={handlePasswordKeyEvent}
                  onKeyDown={handlePasswordKeyEvent}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Enter your password"
                  className="h-10 pl-9 pr-10 bg-zinc-900/40 border-zinc-800 focus-visible:border-emerald-500/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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

            <Button
              type="submit"
              disabled={isBusy}
              className="mt-2 h-10 w-full font-semibold shadow-sm shadow-emerald-500/10"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in to Console</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Sign up prompt */}
          <p className="mt-6 text-center text-xs text-zinc-400">
            New to {BRAND.name}?{" "}
            <Link
              href={
                hasCustomNext
                  ? `/register?next=${encodeURIComponent(safeNext)}`
                  : "/register"
              }
              className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Create a free account
            </Link>
          </p>
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/70 pt-4 text-[11px] text-zinc-500">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy
            </Link>
            <Link href="/aup" className="hover:text-zinc-300 transition-colors">
              Acceptable Use
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Loading sign in...</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
