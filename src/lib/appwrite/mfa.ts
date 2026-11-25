"use client";

import {
  AuthenticationFactor,
  AuthenticatorType,
  Avatars,
  type Models,
} from "appwrite";
import { getBrowserAccount, getBrowserAppwriteClient } from "./client";

export type MfaChallengeMode = "totp" | "recoverycode";

/**
 * Detects Appwrite's `user_more_factors_required` error thrown when an AAL1 session
 * must complete an MFA challenge before accessing account/API resources.
 */
export function isMfaRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const type =
    "type" in err ? String((err as { type?: unknown }).type || "") : "";
  if (type === "user_more_factors_required") return true;
  const message =
    err instanceof Error ? err.message.toLowerCase() : "";
  return message.includes("more factors") || message.includes("mfa");
}

/**
 * Generates a scannable QR code URL via Appwrite's built-in Avatars QR endpoint.
 */
export function getTotpQrUrl(uri: string, size = 220): string {
  const avatars = new Avatars(getBrowserAppwriteClient());
  return avatars.getQR({ text: uri, size, margin: 2 });
}

export interface TotpSetupPayload {
  secret: string;
  uri: string;
  qrUrl: string;
}

/**
 * Step 1 of TOTP enrollment: creates an unverified TOTP authenticator and returns
 * the secret + otpauth:// URI + scannable QR image URL.
 */
export async function startTotpEnrollment(): Promise<TotpSetupPayload> {
  const account = getBrowserAccount();
  const res = await account.createMfaAuthenticator({
    type: AuthenticatorType.Totp,
  });
  return {
    secret: res.secret,
    uri: res.uri,
    qrUrl: getTotpQrUrl(res.uri),
  };
}

/**
 * Step 2 of TOTP enrollment: verifies the 6-digit code, generates backup recovery
 * codes before MFA enforcement locks the session, and then enables MFA.
 */
export async function verifyAndEnableTotp(
  otp: string
): Promise<{ recoveryCodes: string[] }> {
  const account = getBrowserAccount();
  const cleanOtp = otp.replace(/\s+/g, "");

  await account.updateMfaAuthenticator({
    type: AuthenticatorType.Totp,
    otp: cleanOtp,
  });

  // Generate backup recovery codes BEFORE turning on MFA enforcement so the
  // current session does not hit `user_more_factors_required` on first setup.
  let recoveryCodes: string[] = [];
  try {
    const codesRes = await account.createMfaRecoveryCodes();
    recoveryCodes = codesRes.recoveryCodes || [];
  } catch (err) {
    const type =
      err && typeof err === "object" && "type" in err
        ? String((err as { type?: unknown }).type || "")
        : "";
    if (type === "user_recovery_codes_already_exists") {
      try {
        const existing = await account.getMfaRecoveryCodes();
        recoveryCodes = existing.recoveryCodes || [];
      } catch {
        recoveryCodes = [];
      }
    }
  }

  await account.updateMFA({ mfa: true });
  return { recoveryCodes };
}

/**
 * Completes an MFA challenge using either a 6-digit TOTP code or a backup recovery code.
 */
export async function completeMfaChallenge(
  mode: MfaChallengeMode,
  code: string
): Promise<Models.Session> {
  const account = getBrowserAccount();
  const factor =
    mode === "recoverycode"
      ? AuthenticationFactor.Recoverycode
      : AuthenticationFactor.Totp;

  const challenge = await account.createMfaChallenge({ factor });
  const cleanCode = code.trim().replace(/\s+/g, "");
  return account.updateMfaChallenge({
    challengeId: challenge.$id,
    otp: cleanCode,
  });
}

/**
 * Lists the MFA factors currently available on the signed-in account.
 */
export async function listAvailableMfaFactors(): Promise<Models.MfaFactors> {
  const account = getBrowserAccount();
  return account.listMfaFactors();
}

/**
 * Regenerates backup recovery codes. If the current session needs a fresh MFA challenge,
 * an optional TOTP code can be provided to satisfy AAL2 first.
 */
export async function regenerateMfaRecoveryCodes(
  verificationOtp?: string
): Promise<string[]> {
  const account = getBrowserAccount();
  if (verificationOtp) {
    await completeMfaChallenge("totp", verificationOtp);
  }
  try {
    const res = await account.updateMfaRecoveryCodes();
    return res.recoveryCodes || [];
  } catch (err) {
    const type =
      err && typeof err === "object" && "type" in err
        ? String((err as { type?: unknown }).type || "")
        : "";
    if (type === "user_recovery_codes_not_found") {
      const created = await account.createMfaRecoveryCodes();
      return created.recoveryCodes || [];
    }
    throw err;
  }
}

/**
 * Disables MFA and removes the TOTP authenticator from the account.
 * Accepts an optional 6-digit TOTP code to elevate the session if Appwrite requires AAL2.
 */
export async function disableTotpMfa(verificationOtp?: string): Promise<void> {
  const account = getBrowserAccount();
  if (verificationOtp) {
    await completeMfaChallenge("totp", verificationOtp);
  }
  await account.updateMFA({ mfa: false });
  await account
    .deleteMfaAuthenticator({ type: AuthenticatorType.Totp })
    .catch(() => {});
}
