"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ID } from "appwrite";
import { toast } from "sonner";
import { AlertCircle, Loader2, X, Zap } from "lucide-react";
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
import { Button, Card, Input, Label } from "@/components/ui/primitives";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();

  const rawNext = searchParams.get("next") || "";
  const safeNext = sanitizeNextPath(rawNext, "/console");
  const hasCustomNext = Boolean(rawNext && safeNext !== "/console");
  const oauthErrorParam = searchParams.get("error");
  const oauthProviderParam = searchParams.get("provider");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedCompliance, setAcceptedCompliance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProviderId | null>(null);
  const [formError, setFormError] = useState<string | null>(
    getOAuthErrorMessage(oauthErrorParam, oauthProviderParam)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!acceptedCompliance) {
      const msg =
        "Please accept the Terms of Service, Acceptable Use Policy, and Export Control terms.";
      setFormError(msg);
      toast.error(msg);
      return;
    }
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
      await account.create(ID.unique(), email.trim(), password, name.trim());
      await account.createEmailPasswordSession(email.trim(), password);
      await refreshProfile();
      toast.success("Account created! Top up credits to launch your first GPU.");
      router.push(safeNext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const isBusy = submitting || oauthLoading !== null;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-lg text-white">{BRAND.name}</span>
          </Link>
          <h1 className="text-xl font-semibold text-white">Create your account</h1>
          <p className="text-xs text-zinc-400">
            Starts at $0 balance. Top up prepaid credits anytime—no subscriptions.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs text-red-400"
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

        <OAuthButtons
          source="register"
          next={safeNext}
          disabled={submitting}
          onError={(msg) => setFormError(msg)}
          onLoadingChange={(p) => {
            if (p) setFormError(null);
            setOauthLoading(p);
          }}
        />

        <div className="relative flex items-center">
          <div className="flex-1 border-t border-zinc-800" />
          <span className="px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            or with email
          </span>
          <div className="flex-1 border-t border-zinc-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              disabled={isBusy}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              disabled={isBusy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password (min 8 chars)</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              disabled={isBusy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <label className="flex items-start gap-2.5 text-xs text-zinc-400 cursor-pointer leading-relaxed">
            <input
              type="checkbox"
              required
              disabled={isBusy}
              checked={acceptedCompliance}
              onChange={(e) => setAcceptedCompliance(e.target.checked)}
              className="mt-0.5 accent-emerald-500"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-emerald-400 hover:underline">
                Terms
              </Link>
              ,{" "}
              <Link href="/privacy" className="text-emerald-400 hover:underline">
                Privacy Policy
              </Link>
              ,{" "}
              <Link href="/refunds" className="text-emerald-400 hover:underline">
                Refund Policy
              </Link>
              , and{" "}
              <Link href="/aup" className="text-emerald-400 hover:underline">
                Acceptable Use &amp; Export Control Policy
              </Link>{" "}
              (no crypto mining, no prohibited workloads, and not in a sanctioned
              jurisdiction).
            </span>
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={isBusy || !acceptedCompliance}
          >
            {submitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-xs text-zinc-400">
          Already have an account?{" "}
          <Link
            href={
              hasCustomNext
                ? `/login?next=${encodeURIComponent(safeNext)}`
                : "/login"
            }
            className="text-emerald-400 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Loading...</span>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
