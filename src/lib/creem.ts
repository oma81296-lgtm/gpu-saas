import crypto from "node:crypto";
import { BRAND, CREDIT_PACKS } from "./brand";

const CREEM_BASE = (
  process.env.CREEM_API_BASE_URL || "https://test-api.creem.io"
).replace(/\/$/, "");

export function getCreditPack(packId: string) {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) return null;
  const productId = process.env[pack.envKey] || pack.defaultProductId;
  return { ...pack, productId };
}

export async function createCreemCheckout(params: {
  packId: string;
  userId: string;
  email: string;
}): Promise<{ checkoutUrl: string; checkoutId: string }> {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey || apiKey === "creem_test_your_api_key_here") {
    throw new Error("CREEM_API_KEY is not configured on the server.");
  }

  const pack = getCreditPack(params.packId);
  if (!pack) {
    throw new Error(`Invalid credit pack: ${params.packId}`);
  }

  const res = await fetch(`${CREEM_BASE}/v1/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      product_id: pack.productId,
      success_url: `${BRAND.appUrl}/billing?status=success&pack=${pack.id}`,
      customer: {
        email: params.email,
      },
      metadata: {
        user_id: params.userId,
        pack_id: pack.id,
        credits_micro_usd: String(pack.microUsd),
      },
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    checkout_url?: string;
    message?: string;
  };

  if (!res.ok || !data.checkout_url) {
    throw new Error(data.message || `Creem checkout failed (${res.status})`);
  }

  return {
    checkoutUrl: data.checkout_url,
    checkoutId: data.id || "",
  };
}

/**
 * Verifies Creem webhook HMAC-SHA256 signature (`creem-signature` header).
 */
export function verifyCreemWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(computed, "utf8");
  const providedBuf = Buffer.from(signatureHeader.trim(), "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
