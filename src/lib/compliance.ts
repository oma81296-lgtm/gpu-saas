import { NextRequest } from "next/server";
import { AuthError } from "./appwrite/server";

/**
 * Embargoed jurisdictions prohibited under Lium.io Export Control & Sanctions Policy.
 * https://docs.lium.io/security/export-compliance
 */
const SANCTIONED_COUNTRY_CODES = new Set(["CU", "IR", "KP", "SY"]);

export function getRequestCountryCode(req: NextRequest): string | null {
  const raw =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-country-code") ||
    "";
  const code = raw.trim().toUpperCase();
  return code.length === 2 ? code : null;
}

export function assertNotSanctionedCountry(req: NextRequest): void {
  const code = getRequestCountryCode(req);
  if (code && SANCTIONED_COUNTRY_CODES.has(code)) {
    throw new AuthError(
      "Service is unavailable in your jurisdiction under Export Control and Sanctions Policy.",
      451
    );
  }
}

/**
 * Known cryptocurrency mining binaries, stratum protocols, mining pools, and
 * prohibited deepfake/face-swap images blocked under VoltGPU & Creem AUP.
 */
const BLOCKED_WORKLOAD_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(xmrig|lolminer|t-?rex-?miner|nbminer|gminer|phoenixminer|teamredminer|bzminer|srbminer|ethminer|cpuminer|ccminer|cgminer|bfgminer|claymore|kawpow|kaspa-?miner|alephium-?miner|rigel-?miner|onezerominer)\b/i,
    reason: "Cryptocurrency mining workloads are prohibited under our Acceptable Use Policy.",
  },
  {
    pattern: /stratum\+(tcp|ssl):\/\/|nicehash\.com|2miners\.com|nanopool\.org|f2pool\.com|ethermine\.org|hiveon\.net/i,
    reason: "Cryptocurrency mining pool connections are prohibited under our Acceptable Use Policy.",
  },
  {
    pattern: /\b(deepfacelab|facefusion|roop-unleashed|deepnude|undress)\b/i,
    reason: "Deepfake and non-consensual synthetic media tools are prohibited under our Acceptable Use Policy.",
  },
];

export function assertAllowedWorkload(input: {
  customDockerImage?: string;
  startupCommands?: string;
  customEnvVars?: Record<string, string>;
}): void {
  const combined = [
    input.customDockerImage || "",
    input.startupCommands || "",
    ...Object.entries(input.customEnvVars || {}).map(([k, v]) => `${k}=${v}`),
  ].join("\n");

  if (!combined.trim()) return;

  for (const rule of BLOCKED_WORKLOAD_PATTERNS) {
    if (rule.pattern.test(combined)) {
      throw new AuthError(rule.reason, 403);
    }
  }
}
