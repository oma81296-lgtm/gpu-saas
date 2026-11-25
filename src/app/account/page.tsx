"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GitHubIcon, GoogleIcon } from "@/components/auth/oauth-buttons";
import { TwoFactorSecurityCard } from "@/components/auth/two-factor-card";
import { getBrowserAccount } from "@/lib/appwrite/client";
import { startOAuthFlow, type OAuthProviderId } from "@/lib/appwrite/oauth";
import { Badge, Button, Card, Input, Label } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountSecurityPage() {
  const { user, loading, refreshProfile } = useAuth();

  const [connecting, setConnecting] = useState<OAuthProviderId | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [sendingRecovery, setSendingRecovery] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const auth = user?.auth;
  const identities = auth?.identities || [];
  const hasPassword = Boolean(auth?.hasPassword);
  const githubIdentity = identities.find((i) => i.provider === "github");
  const googleIdentity = identities.find((i) => i.provider === "google");

  // Prevent user from removing their last remaining sign-in method
  const totalAuthMethods = (hasPassword ? 1 : 0) + identities.length;
  const canDisconnectIdentity = totalAuthMethods > 1;

  function handleConnectProvider(provider: OAuthProviderId) {
    setConnecting(provider);
    try {
      startOAuthFlow(provider, { next: "/account", source: "login" });
    } catch (err) {
      setConnecting(null);
      toast.error(
        err instanceof Error
          ? err.message
          : `Could not connect ${provider === "github" ? "GitHub" : "Google"}`
      );
    }
  }

  async function handleDisconnectIdentity(identityId: string, label: string) {
    if (!canDisconnectIdentity) {
      toast.error(
        "Set a password or connect another provider before disconnecting your only sign-in method."
      );
      return;
    }
    setDisconnectingId(identityId);
    try {
      const account = getBrowserAccount();
      await account.deleteIdentity(identityId);
      await refreshProfile();
      toast.success(`${label} disconnected from your account.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Could not disconnect ${label}.`
      );
    } finally {
      setDisconnectingId(null);
    }
  }

  async function handleSendSetPasswordEmail() {
    if (!user?.email) return;
    setSendingRecovery(true);
    try {
      const account = getBrowserAccount();
      await account.createRecovery(
        user.email,
        `${window.location.origin}/reset-password`
      );
      toast.success(
        `Password setup link sent to ${user.email}. Check your inbox!`
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not send password setup email."
      );
    } finally {
      setSendingRecovery(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const account = getBrowserAccount();
      await account.updatePassword(newPassword, currentPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowChangePassword(false);
      await refreshProfile();
      toast.success("Password updated successfully.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update password."
      );
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Account &amp; Security
          </h1>
          <p className="text-sm text-zinc-400">
            Manage your profile identity, password, and linked OAuth providers.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-xl bg-zinc-900" />
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-900" />
          </div>
        ) : !user ? (
          <Card className="p-6 text-center space-y-3">
            <p className="text-sm text-zinc-300">
              Sign in to view and manage your connected accounts.
            </p>
            <Link href="/login?next=/account">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : (
          <>
            {/* Profile Summary */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Account Identity
                  </h2>
                </div>
                <Badge
                  variant={user.role === "admin" ? "violet" : "emerald"}
                  className="capitalize"
                >
                  {user.role}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 space-y-1">
                  <p className="text-zinc-500">Display Name</p>
                  <p className="font-medium text-white">
                    {user.name || "Not set"}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-500">Email Address</p>
                    {auth?.emailVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-white truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-xs">
                <span className="text-zinc-400">
                  Account ID:{" "}
                  <span className="font-mono text-zinc-200">{user.userId}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(user.userId);
                    toast.success("Account ID copied!");
                  }}
                  className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            </Card>

            {/* Connected Sign-In Methods */}
            <Card className="p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Connected Sign-In Methods
                  </h2>
                </div>
                <p className="text-xs text-zinc-400">
                  Providers sharing the same verified email automatically sign
                  into this exact account without losing credits or pods.
                </p>
              </div>

              <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800/80 bg-zinc-950/50">
                {/* Email & Password Row */}
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-emerald-400">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            Email &amp; Password
                          </p>
                          <Badge variant={hasPassword ? "emerald" : "default"}>
                            {hasPassword ? "Enabled" : "Not set"}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {hasPassword
                            ? `Sign in with ${user.email} and your password.`
                            : "You signed up with OAuth. Set a password anytime via email."}
                        </p>
                      </div>
                    </div>

                    {hasPassword ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setShowChangePassword((prev) => !prev)
                        }
                      >
                        {showChangePassword ? "Cancel" : "Change password"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={sendingRecovery}
                        onClick={handleSendSetPasswordEmail}
                      >
                        {sendingRecovery ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        <span>Set password via email</span>
                      </Button>
                    )}
                  </div>

                  {showChangePassword && hasPassword && (
                    <form
                      onSubmit={handleChangePassword}
                      className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 sm:grid-cols-3"
                    >
                      <div className="space-y-1">
                        <Label htmlFor="current-pw">Current password</Label>
                        <Input
                          id="current-pw"
                          type="password"
                          required
                          disabled={updatingPassword}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="next-pw">New password</Label>
                        <Input
                          id="next-pw"
                          type="password"
                          required
                          minLength={8}
                          disabled={updatingPassword}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 8 chars"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="confirm-pw">Confirm new</Label>
                        <Input
                          id="confirm-pw"
                          type="password"
                          required
                          minLength={8}
                          disabled={updatingPassword}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-center justify-between pt-1">
                        <Link
                          href={`/forgot-password?email=${encodeURIComponent(user.email)}`}
                          className="text-xs text-emerald-400 hover:underline"
                        >
                          Forgot current password?
                        </Link>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={updatingPassword}
                        >
                          {updatingPassword ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Update password"
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                {/* GitHub OAuth Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-white">
                      <GitHubIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">GitHub</p>
                        <Badge variant={githubIdentity ? "emerald" : "default"}>
                          {githubIdentity ? "Connected" : "Not connected"}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {githubIdentity
                          ? githubIdentity.providerEmail || "Linked GitHub account"
                          : "Connect GitHub for one-click developer sign-in."}
                      </p>
                    </div>
                  </div>

                  {githubIdentity ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        !canDisconnectIdentity ||
                        disconnectingId === githubIdentity.id
                      }
                      title={
                        canDisconnectIdentity
                          ? "Disconnect GitHub"
                          : "Add another sign-in method before disconnecting"
                      }
                      onClick={() =>
                        handleDisconnectIdentity(githubIdentity.id, "GitHub")
                      }
                    >
                      {disconnectingId === githubIdentity.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )}
                      <span>Disconnect</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={connecting !== null}
                      onClick={() => handleConnectProvider("github")}
                    >
                      {connecting === "github" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <GitHubIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Connect GitHub</span>
                    </Button>
                  )}
                </div>

                {/* Google OAuth Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80">
                      <GoogleIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">Google</p>
                        <Badge variant={googleIdentity ? "emerald" : "default"}>
                          {googleIdentity ? "Connected" : "Not connected"}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {googleIdentity
                          ? googleIdentity.providerEmail || "Linked Google account"
                          : "Connect Google for fast workspace sign-in."}
                      </p>
                    </div>
                  </div>

                  {googleIdentity ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        !canDisconnectIdentity ||
                        disconnectingId === googleIdentity.id
                      }
                      title={
                        canDisconnectIdentity
                          ? "Disconnect Google"
                          : "Add another sign-in method before disconnecting"
                      }
                      onClick={() =>
                        handleDisconnectIdentity(googleIdentity.id, "Google")
                      }
                    >
                      {disconnectingId === googleIdentity.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )}
                      <span>Disconnect</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={connecting !== null}
                      onClick={() => handleConnectProvider("google")}
                    >
                      {connecting === "google" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <GoogleIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Connect Google</span>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
            {/* Two-Factor Authentication */}
            <TwoFactorSecurityCard />
          </>
        )}
      </div>
    </AppShell>
  );
}
