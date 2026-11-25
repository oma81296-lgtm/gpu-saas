import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_CONFIG, BackupDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { deleteBackupLog, LiumApiError } from "@/lib/lium/client";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);
    const { id } = await context.params;
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const doc = (await databases.getDocument(
      databaseId,
      collections.backups,
      id
    )) as unknown as BackupDoc;

    if (doc.user_id !== ctx.userId && ctx.profile.role !== "admin") {
      throw new AuthError("Forbidden", 403);
    }

    try {
      await deleteBackupLog(doc.lium_backup_log_id);
    } catch (err) {
      if (!(err instanceof LiumApiError && err.status === 404)) {
        throw err;
      }
    }

    await databases.updateDocument(databaseId, collections.backups, doc.$id, {
      status: "deleted",
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
