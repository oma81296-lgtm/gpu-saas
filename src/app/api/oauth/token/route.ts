import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite } from "@/lib/appwrite/server";
import { generateApiKey } from "@/lib/api-keys";
import { consumeAuthorizationCode, verifyPkceS256 } from "@/lib/mcp/oauth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: CORS }
  );
}

async function parseTokenBody(
  req: NextRequest
): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await req.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

/**
 * OAuth 2.1 Token Endpoint (Authorization Code + PKCE S256).
 * Exchanges a verified authorization code for a scoped Personal API Key (`vgpu_live_...`)
 * stored in the user's `api_keys` collection so they can edit its spend cap or revoke it anytime.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await parseTokenBody(req);
    const grantType = body.grant_type;
    const code = body.code;
    const codeVerifier = body.code_verifier;
    const redirectUri = body.redirect_uri;
    const clientId = body.client_id;

    if (grantType !== "authorization_code") {
      return oauthError(
        "unsupported_grant_type",
        "Only grant_type=authorization_code is supported"
      );
    }

    if (!code || !codeVerifier || !redirectUri || !clientId) {
      return oauthError(
        "invalid_request",
        "Missing required parameters: code, code_verifier, redirect_uri, client_id"
      );
    }

    const payload = consumeAuthorizationCode(code);
    if (!payload) {
      return oauthError(
        "invalid_grant",
        "Authorization code is invalid, expired, or already used"
      );
    }

    if (payload.clientId !== clientId) {
      return oauthError("invalid_grant", "client_id mismatch");
    }

    if (payload.redirectUri !== redirectUri) {
      return oauthError("invalid_grant", "redirect_uri mismatch");
    }

    if (!verifyPkceS256(codeVerifier, payload.codeChallenge)) {
      return oauthError("invalid_grant", "Invalid PKCE code_verifier");
    }

    // Mint a real Personal API Key in Appwrite so the user can view/edit/revoke it on /api-keys
    const { databases } = createAdminAppwrite();
    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      [
        Query.equal("user_id", payload.userId),
        Query.equal("revoked", false),
        Query.limit(20),
      ]
    );

    if (existing.total >= 10) {
      return oauthError(
        "invalid_grant",
        "Maximum of 10 active API keys reached. Revoke an unused key on /api-keys and retry."
      );
    }

    const { plaintext, keyPrefix, keyHash } = generateApiKey();
    const label = payload.clientName.startsWith("MCP:")
      ? payload.clientName
      : `MCP: ${payload.clientName}`;

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      ID.unique(),
      {
        user_id: payload.userId,
        name: label.slice(0, 100),
        key_prefix: keyPrefix,
        key_hash: keyHash,
        max_hourly_usd: 0,
        revoked: false,
        last_used_at: new Date().toISOString(),
        expires_at: null,
      }
    );

    return NextResponse.json(
      {
        access_token: plaintext,
        token_type: "Bearer",
        scope: payload.scope || "mcp:tools",
      },
      { status: 200, headers: CORS }
    );
  } catch (err) {
    console.error("[oauth:token]", err);
    return oauthError(
      "server_error",
      err instanceof Error ? err.message : "Token exchange failed",
      500
    );
  }
}
