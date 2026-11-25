import crypto from "node:crypto";

const GPU_ID_PREFIX = "gpu_";

function getGpuIdKey(): Buffer {
  const raw =
    process.env.MCP_OAUTH_SECRET ||
    process.env.APPWRITE_API_KEY ||
    "voltgpu-dev-gpu-id-secret";
  return crypto.createHash("sha256").update(`voltgpu:gpu-id:${raw}`).digest();
}

/**
 * Deterministically encrypts an upstream executor UUID into an opaque VoltGPU
 * `gpu_...` identifier using AES-256-GCM. Deterministic IV keeps React list keys
 * stable across refreshes while preventing external reverse-lookup.
 */
export function encodeGpuId(rawExecutorId: string): string {
  const key = getGpuIdKey();
  const iv = crypto
    .createHmac("sha256", key)
    .update(rawExecutorId)
    .digest()
    .subarray(0, 12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(rawExecutorId, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${GPU_ID_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

/**
 * Decodes an opaque `gpu_...` identifier back to the upstream executor UUID.
 * Returns null if the token is malformed or fails GCM authentication.
 */
export function decodeGpuId(gpuId: string): string | null {
  if (!gpuId || !gpuId.startsWith(GPU_ID_PREFIX)) return null;
  try {
    const raw = Buffer.from(gpuId.slice(GPU_ID_PREFIX.length), "base64url");
    if (raw.length < 29) return null; // 12 IV + 16 tag + >=1 byte
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getGpuIdKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
