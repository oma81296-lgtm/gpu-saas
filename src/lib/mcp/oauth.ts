import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { BRAND } from "@/lib/brand";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const usedCodeJtis = new Map<string, number>();

function getSigningKey(): Buffer {
  const raw =
    process.env.MCP_OAUTH_SECRET ||
    process.env.APPWRITE_API_KEY ||
    "voltgpu-dev-oauth-secret-change-me";
  return crypto.createHash("sha256").update(`voltgpu:mcp-oauth:${raw}`).digest();
}

function signData(data: string): string {
  return crypto
    .createHmac("sha256", getSigningKey())
    .update(data)
    .digest("base64url");
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getRequestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost}`.replace(/\/$/, "");
  }
  if (req.nextUrl?.origin && req.nextUrl.origin !== "null") {
    return req.nextUrl.origin.replace(/\/$/, "");
  }
  return BRAND.appUrl.replace(/\/$/, "");
}

/**
 * Validates OAuth 2.1 redirect URIs for MCP clients:
 * - HTTPS URLs
 * - Loopback HTTP (localhost, 127.0.0.1, [::1]) for local agents/CLI
 * - Native app custom URI schemes (e.g. cursor://, claude://, vscode://)
 */
export function isAllowedRedirectUri(rawUri: string): boolean {
  try {
    const parsed = new URL(rawUri);
    const proto = parsed.protocol.toLowerCase();
    if (
      proto === "javascript:" ||
      proto === "data:" ||
      proto === "vbscript:" ||
      proto === "file:"
    ) {
      return false;
    }
    if (proto === "https:") return true;
    if (proto === "http:") {
      const host = parsed.hostname.toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
    }
    // Custom native app schemes (e.g. cursor://, claude://, antigravity://)
    return /^[a-z][a-z0-9+.-]*:$/.test(proto);
  } catch {
    return false;
  }
}

export interface RegisteredClientPayload {
  clientName: string;
  redirectUris: string[];
  iat: number;
}

export function createRegisteredClientId(
  clientName: string,
  redirectUris: string[]
): string {
  const payload: RegisteredClientPayload = {
    clientName: clientName.slice(0, 80),
    redirectUris: redirectUris.slice(0, 10),
    iat: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = signData(`client:${encoded}`);
  return `mcpc_${encoded}.${sig}`;
}

export function parseRegisteredClientId(
  clientId: string
): RegisteredClientPayload | null {
  if (!clientId.startsWith("mcpc_")) return null;
  const body = clientId.slice(5);
  const dot = body.indexOf(".");
  if (dot === -1) return null;
  const encoded = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const expected = signData(`client:${encoded}`);
  if (!timingSafeEquals(sig, expected)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as RegisteredClientPayload;
    if (!Array.isArray(parsed.redirectUris)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthCodePayload {
  jti: string;
  userId: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scope: string;
  exp: number;
}

export function createAuthorizationCode(
  input: Omit<AuthCodePayload, "jti" | "exp">
): string {
  const payload: AuthCodePayload = {
    ...input,
    jti: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + AUTH_CODE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = signData(`code:${encoded}`);
  return `mcpcode_${encoded}.${sig}`;
}

export function consumeAuthorizationCode(code: string): AuthCodePayload | null {
  if (!code.startsWith("mcpcode_")) return null;
  const body = code.slice(8);
  const dot = body.indexOf(".");
  if (dot === -1) return null;
  const encoded = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const expected = signData(`code:${encoded}`);
  if (!timingSafeEquals(sig, expected)) return null;

  let parsed: AuthCodePayload;
  try {
    parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as AuthCodePayload;
  } catch {
    return null;
  }

  const now = Date.now();
  if (!parsed.exp || parsed.exp < now) return null;

  // Prune expired JTIs and enforce single-use
  for (const [k, exp] of usedCodeJtis.entries()) {
    if (exp < now) usedCodeJtis.delete(k);
  }
  if (usedCodeJtis.has(parsed.jti)) return null;
  usedCodeJtis.set(parsed.jti, parsed.exp);

  return parsed;
}

export function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string
): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  const computed = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return timingSafeEquals(computed, codeChallenge);
}
