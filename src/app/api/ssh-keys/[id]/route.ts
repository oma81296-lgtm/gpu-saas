import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_CONFIG, SshKeyDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);
    const { id } = await context.params;
    const { databases } = createAdminAppwrite();

    const doc = (await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sshKeys,
      id
    )) as unknown as SshKeyDoc;

    if (doc.user_id !== ctx.userId && ctx.profile.role !== "admin") {
      throw new AuthError("Forbidden", 403);
    }

    await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sshKeys,
      id
    );

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
