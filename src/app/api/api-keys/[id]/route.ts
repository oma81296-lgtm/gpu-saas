import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { APPWRITE_CONFIG, ApiKeyDoc } from "@/lib/appwrite/config";
import {
  AuthError,
  createAdminAppwrite,
  requireSessionAuth,
} from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { toPublicApiKey } from "@/lib/api-keys";

const updateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireSessionAuth(req);
    const { id } = await context.params;
    const body = updateApiKeySchema.parse(await req.json());
    const { databases } = createAdminAppwrite();

    const doc = (await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      id
    )) as unknown as ApiKeyDoc;

    if (doc.user_id !== ctx.userId) {
      throw new AuthError("Forbidden", 403);
    }

    const updated = (await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      id,
      { name: body.name }
    )) as unknown as ApiKeyDoc;

    return NextResponse.json({ key: toPublicApiKey(updated) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireSessionAuth(req);
    const { id } = await context.params;
    const { databases } = createAdminAppwrite();

    const doc = (await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      id
    )) as unknown as ApiKeyDoc;

    if (doc.user_id !== ctx.userId) {
      throw new AuthError("Forbidden", 403);
    }

    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.apiKeys,
      id,
      { revoked: true }
    );

    return NextResponse.json({ revoked: true });
  } catch (err) {
    return handleApiError(err);
  }
}
