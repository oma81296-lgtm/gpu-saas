"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { BRAND, formatMicroUsd } from "@/lib/brand";
import { useAuth } from "@/components/auth-provider";
import {
  Badge,
  Button,
  Card,
} from "@/components/ui/primitives";

function decodeClientNameFromId(clientId: string): string {
  if (!clientId.startsWith("mcpc_")) {
    return clientId.slice(0, 60) || "AI Agent";
  }
  try {
    const body = clientId.slice(5);
    const dot = body.indexOf(".");
    if (dot === -1) return "AI Agent";
    const encoded = body.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/");
    const pad = encoded.length % 4 === 0 ? "" : "=".repeat(4 - (encoded.length % 4));
    const parsed = JSON.parse(atob(encoded + pad)) as { clientName?: string };
    return parsed.clientName || "AI Agent";
  } catch {
    return "AI Agent";
  }
}

function OAuthAuthorizeInner() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading, authFetch } = useAuth();

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const responseType = searchParams.get("response_type") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "";
  const state = searchParams.get("state") || "";
  const scope = searchParams.get("scope") || "mcp:tools";

  const detectedClientName = useMemo(
    () => decodeClientNameFromId(clientId),
    [clientId]
  );

  const [submitting, setSubmitting] = useState(false);

  const validationError = useMemo(() => {
    if (!clientId) return "Missing required OAuth parameter: client_id";
    if (!redirectUri) return "Missing required OAuth parameter: redirect_uri";
    if (responseType !== "code")
      return "Unsupported response_type (expected 'code')";
    if (!codeChallenge)
      return "Missing required PKCE parameter: code_challenge";
    if (codeChallengeMethod !== "S256")
      return "Unsupported code_challenge_method (expected 'S256')";
    return null;
  }, [
    clientId,
    redirectUri,
    responseType,
    codeChallenge,
    codeChallengeMethod,
  ]);

  const currentRelativeUrl = useMemo(() => {
    const qs = searchParams.toString();
    return `/oauth/authorize${qs ? `?${qs}` : ""}`;
  }, [searchParams]);

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authFetch("/api/oauth/authorize", {
        method: "POST",
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state: state || undefined,
          scope,
          key_label: detectedClientName,
        }),
      });
      const data = (await res.json()) as {
        redirectUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || "Authorization failed");
      }
      window.location.href = data.redirectUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authorization failed");
      setSubmitting(false);
    }
  }

  function handleDeny() {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("error_description", "User denied authorization");
      if (state) url.searchParams.set("state", state);
      window.location.href = url.toString();
    } catch {
      toast.error("Invalid redirect URI");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg p-6 space-y-6 border-zinc-800/90">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-lg text-white">{BRAND.name}</span>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Badge variant="emerald">
              <Bot className="h-3 w-3" />
              MCP OAuth 2.1
            </Badge>
          </div>
          <h1 className="text-xl font-semibold text-white">
            Authorize {detectedClientName}
          </h1>
          <p className="text-xs text-zinc-400">
            An AI agent is requesting permission to control your {BRAND.name}{" "}
            GPUs via Remote MCP.
          </p>
        </div>

        {validationError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4 shrink-0" />
              Invalid Authorization Request
            </div>
            <p className="text-xs text-red-200/80">{validationError}</p>
          </div>
        ) : authLoading ? (
          <div className="py-8 text-center text-sm text-zinc-400">
            Checking your session...
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-xs text-zinc-300 space-y-1">
              <div className="font-medium text-white">
                Sign in required to continue
              </div>
              <p className="text-zinc-400">
                Sign in to your {BRAND.name} account and you&apos;ll be returned
                here automatically to approve{" "}
                <span className="text-zinc-200 font-medium">
                  {detectedClientName}
                </span>
                .
              </p>
            </div>
            <Link
              href={`/login?next=${encodeURIComponent(currentRelativeUrl)}`}
              className="block"
            >
              <Button className="w-full">Sign in to Authorize</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleApprove} className="space-y-5">
            {/* Signed-in account summary */}
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="text-zinc-400">Signed in as</div>
                <div className="font-medium text-white truncate">
                  {user.email}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-zinc-400">Credits</div>
                <div className="font-mono font-semibold text-emerald-400">
                  {formatMicroUsd(user.balanceMicroUsd)}
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Permissions Requested ({scope})
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Check credit balance, burn rate, and available GPUs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Deploy, inspect, and terminate GPU pods on your behalf
                </li>
                <li className="flex items-center gap-2 text-zinc-400">
                  <XCircle className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  Cannot create/revoke API keys or access admin tools
                </li>
              </ul>
            </div>

            <p className="text-[11px] text-zinc-500">
              Authorizing creates a connection under{" "}
              <Link href="/api-keys" className="text-emerald-400 hover:underline">
                API Keys
              </Link>{" "}
              where you can revoke access anytime.
            </p>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={handleDeny}
              >
                Deny
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Authorizing..." : "Authorize Access"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
          Loading authorization request...
        </div>
      }
    >
      <OAuthAuthorizeInner />
    </Suspense>
  );
}
