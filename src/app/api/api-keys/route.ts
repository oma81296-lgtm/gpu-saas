import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG, ApiKeyDoc } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireSessionAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { generateApiKey, toPublicApiKey } from "@/lib/api-keys";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Key label is required").max(100),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .nullable()
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSessionAuth(req);
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      [
        Query.equal("user_id", ctx.userId),
        Query.equal("revoked", false),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]
    );

    const keys = (res.documents as unknown as ApiKeyDoc[]).map(toPublicApiKey);
    return NextResponse.json({ keys });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSessionAuth(req);
    const body = createApiKeySchema.parse(await req.json());
    const { databases } = createAdminAppwrite();

    const existing = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      [
        Query.equal("user_id", ctx.userId),
        Query.equal("revoked", false),
        Query.limit(20),
      ]
    );

    if (existing.total >= 10) {
      return NextResponse.json(
        { error: "Maximum of 10 active API keys allowed. Revoke an unused key first." },
        { status: 400 }
      );
    }

    const { plaintext, keyPrefix, keyHash } = generateApiKey();
    const expiresAt =
      body.expiresInDays && body.expiresInDays > 0
        ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const doc = (await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      ID.unique(),
      {
        user_id: ctx.userId,
        name: body.name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        max_hourly_usd: 0,
        revoked: false,
        last_used_at: null,
        expires_at: expiresAt,
      }
    )) as unknown as ApiKeyDoc;

    return NextResponse.json(
      {
        key: toPublicApiKey(doc),
        secret: plaintext,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
