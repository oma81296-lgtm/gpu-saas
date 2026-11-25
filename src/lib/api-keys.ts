import crypto from "node:crypto";
import type { ApiKeyDoc } from "./appwrite/config";

export const API_KEY_PREFIX = "vgpu_live_";

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): {
  plaintext: string;
  keyPrefix: string;
  keyHash: string;
} {
  const randomPart = crypto.randomBytes(24).toString("hex"); // 48 hex chars
  const plaintext = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = plaintext.slice(0, API_KEY_PREFIX.length + 8);
  const keyHash = hashApiKey(plaintext);
  return { plaintext, keyPrefix, keyHash };
}

export interface PublicApiKey {
  $id: string;
  $createdAt: string;
  name: string;
  key_prefix: string;
  revoked: boolean;
  last_used_at: string | null;
  expires_at: string | null;
}

export function toPublicApiKey(doc: ApiKeyDoc): PublicApiKey {
  return {
    $id: doc.$id,
    $createdAt: doc.$createdAt,
    name: doc.name,
    key_prefix: doc.key_prefix,
    revoked: Boolean(doc.revoked),
    last_used_at: doc.last_used_at || null,
    expires_at: doc.expires_at || null,
  };
}
