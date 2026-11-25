"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  disableTotpMfa,
  isMfaRequiredError,
  regenerateMfaRecoveryCodes,
  startTotpEnrollment,
  verifyAndEnableTotp,
  type TotpSetupPayload,
} from "@/lib/appwrite/mfa";
import { BRAND } from "@/lib/brand";
import { Badge, Button, Card, Input, Label } from "@/components/ui/primitives";

export function TwoFactorSecurityCard() {
  const { user, refreshProfile } = useAuth();
  const mfaEnabled = Boolean(user?.auth?.mfaEnabled);
  const recoveryCodeEnabled = Boolean(user?.auth?.recoveryCodeEnabled);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [setupData, setSetupData] = useState<TotpSetupPayload | null>(null);
  const [setupOtp, setSetupOtp] = useState("");
  const [verifyingSetup, setVerifyingSetup] = useState(false);

  // Recovery codes display state (shown right after enable or regenerate)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // Regenerate / Disable interactive confirmation state
  const [activeAction, setActiveAction] = useState<
    "regenerate" | "disable" | null
  >(null);
  const [actionOtp, setActionOtp] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  async function handleStartEnrollment() {
    setEnrolling(true);
    try {
      const payload = await startTotpEnrollment();
      setSetupData(payload);
      setSetupOtp("");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not start authenticator setup."
      );
    } finally {
      setEnrolling(false);
    }
  }

  async function handleVerifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    const clean = setupOtp.replace(/\s+/g, "");
    if (clean.length !== 6) {
      toast.error("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifyingSetup(true);
    try {
      const { recoveryCodes: generated } = await verifyAndEnableTotp(clean);
      setSetupData(null);
      setSetupOtp("");
      if (generated.length > 0) {
        setRecoveryCodes(generated);
      }
      await refreshProfile();
      toast.success("Two-factor authentication is now enabled!");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Invalid verification code. Please try again."
      );
    } finally {
      setVerifyingSetup(false);
    }
  }

  async function handleRegenerateCodes(e: React.FormEvent) {
    e.preventDefault();
    setActionBusy(true);
    try {
      const codes = await regenerateMfaRecoveryCodes(
        actionOtp.trim() || undefined
      );
      setRecoveryCodes(codes);
      setActiveAction(null);
      setActionOtp("");
      await refreshProfile();
      toast.success("New backup recovery codes generated.");
    } catch (err) {
      if (isMfaRequiredError(err) && !actionOtp.trim()) {
        toast.error(
          "Enter a current 6-digit code from your authenticator app to confirm."
        );
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not regenerate recovery codes."
        );
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    setActionBusy(true);
    try {
      await disableTotpMfa(actionOtp.trim() || undefined);
      setActiveAction(null);
      setActionOtp("");
      setRecoveryCodes(null);
      await refreshProfile();
      toast.success("Two-factor authentication has been disabled.");
    } catch (err) {
      if (isMfaRequiredError(err) && !actionOtp.trim()) {
        toast.error(
          "Enter a current 6-digit code from your authenticator app to confirm disabling 2FA."
        );
      } else {
        toast.error(
          err instanceof Error ? err.message : "Could not disable 2FA."
        );
      }
    } finally {
      setActionBusy(false);
    }
  }

  function handleCopyRecoveryCodes() {
    if (!recoveryCodes) return;
    void navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast.success("Recovery codes copied to clipboard!");
  }

  function handleDownloadRecoveryCodes() {
    if (!recoveryCodes) return;
    const content = [
      `${BRAND.name} Two-Factor Authentication Recovery Codes`,
      `Account: ${user?.email || ""}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "Store these single-use codes in a safe place (e.g., password manager).",
      "",
      ...recoveryCodes,
      "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voltgpu-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded voltgpu-recovery-codes.txt");
  }

  return (
    <Card className="p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">
              Two-Factor Authentication (2FA)
            </h2>
            <Badge variant={mfaEnabled ? "emerald" : "default"}>
              {mfaEnabled ? "Enabled" : "Off"}
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
            Add an extra layer of protection to your GPU pods, SSH keys, and
            credit wallet using an authenticator app (Google Authenticator,
            1Password, Authy, or Bitwarden).
          </p>
        </div>

        {!mfaEnabled && !setupData && (
          <Button
            type="button"
            size="sm"
            disabled={enrolling}
            onClick={handleStartEnrollment}
          >
            {enrolling ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Smartphone className="h-3.5 w-3.5" />
                Enable 2FA
              </>
            )}
          </Button>
        )}
      </div>

      {/* Recovery Codes Display (right after enable or regenerate) */}
      {recoveryCodes && recoveryCodes.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                Save your backup recovery codes now
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                If you ever lose access to your authenticator app, each code
                below can be used once to sign in. Store them securely—they will
                not be shown again after you dismiss this panel.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/90 bg-zinc-950/90 p-3 font-mono text-xs text-zinc-100">
            {recoveryCodes.map((code) => (
              <div
                key={code}
                className="rounded bg-zinc-900/80 px-2.5 py-1.5 text-center tracking-wider"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCopyRecoveryCodes}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDownloadRecoveryCodes}
              >
                <Download className="h-3.5 w-3.5" />
                Download .txt
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setRecoveryCodes(null)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              I&apos;ve saved these codes
            </Button>
          </div>
        </div>
      )}

      {/* TOTP Enrollment Wizard */}
      {setupData && !mfaEnabled && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr] items-start">
            {/* QR Code in crisp white card for reliable dark-mode scanning */}
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl bg-white p-3 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={setupData.qrUrl}
                  alt="Scan this QR code with your authenticator app"
                  width={176}
                  height={176}
                  className="h-44 w-44 block"
                />
              </div>
              <span className="text-[11px] text-zinc-400">
                Scan with your authenticator app
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-white">
                  1. Scan the QR code or enter the setup key
                </p>
                <p className="text-xs text-zinc-400">
                  Open Google Authenticator, 1Password, Authy, or Apple
                  Passwords and add a new account.
                </p>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 font-mono text-xs text-zinc-200">
                  <span className="truncate select-all">{setupData.secret}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(setupData.secret);
                      toast.success("Setup key copied!");
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
              </div>

              <form onSubmit={handleVerifyEnrollment} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="totp-verify-code">
                    2. Enter the 6-digit verification code
                  </Label>
                  <Input
                    id="totp-verify-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    disabled={verifyingSetup}
                    value={setupOtp}
                    onChange={(e) =>
                      setSetupOtp(
                        e.target.value.replace(/[^\d\s]/g, "").slice(0, 7)
                      )
                    }
                    placeholder="123456"
                    className="h-10 max-w-[200px] text-center font-mono text-base tracking-[0.25em]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={verifyingSetup}
                  >
                    {verifyingSetup ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Enable 2FA"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={verifyingSetup}
                    onClick={() => {
                      setSetupData(null);
                      setSetupOtp("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Active 2FA Management Controls */}
      {mfaEnabled && (
        <div className="space-y-3">
          <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800/80 bg-zinc-950/50">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Authenticator App (TOTP)
                  </p>
                  <p className="text-xs text-zinc-400">
                    Required on every new sign-in (Email/Password, GitHub, and
                    Google).
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setActiveAction((prev) =>
                    prev === "disable" ? null : "disable"
                  );
                  setActionOtp("");
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Disable 2FA
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-emerald-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">
                      Backup Recovery Codes
                    </p>
                    <Badge variant={recoveryCodeEnabled ? "emerald" : "default"}>
                      {recoveryCodeEnabled ? "Active" : "Not generated"}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Single-use fallback codes in case you lose your device.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveAction((prev) =>
                    prev === "regenerate" ? null : "regenerate"
                  );
                  setActionOtp("");
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate codes
              </Button>
            </div>
          </div>

          {/* Inline Confirmation Form for Regenerate or Disable */}
          {activeAction && (
            <form
              onSubmit={
                activeAction === "disable"
                  ? handleDisableMfa
                  : handleRegenerateCodes
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">
                  {activeAction === "disable"
                    ? "Confirm disabling Two-Factor Authentication"
                    : "Regenerate backup recovery codes"}
                </p>
                <p className="text-xs text-zinc-400">
                  {activeAction === "disable"
                    ? "Enter a current 6-digit code from your authenticator app to confirm removing 2FA protection."
                    : "This invalidates any previous recovery codes. Enter a current 6-digit authenticator code to confirm."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  disabled={actionBusy}
                  value={actionOtp}
                  onChange={(e) =>
                    setActionOtp(
                      e.target.value.replace(/[^\d\s]/g, "").slice(0, 7)
                    )
                  }
                  placeholder="123456"
                  className="h-9 w-40 text-center font-mono tracking-[0.2em]"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant={
                    activeAction === "disable" ? "destructive" : "default"
                  }
                  disabled={actionBusy}
                >
                  {actionBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Confirming...
                    </>
                  ) : activeAction === "disable" ? (
                    "Confirm Disable 2FA"
                  ) : (
                    "Generate New Codes"
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={actionBusy}
                  onClick={() => {
                    setActiveAction(null);
                    setActionOtp("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
