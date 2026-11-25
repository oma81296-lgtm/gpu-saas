import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { APPWRITE_CONFIG, BackupDoc, PodDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { restoreBackupToPod } from "@/lib/lium/client";

const restoreSchema = z.object({
  backupId: z.string().min(1),
  restorePath: z
    .string()
    .trim()
    .default("/root")
    .refine(
      (p) => p === "/root" || p.startsWith("/root/"),
      "Restore path must be /root or inside /root"
    ),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);
    const { id } = await context.params;
    const body = restoreSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const [pod, backup] = await Promise.all([
      databases.getDocument(
        databaseId,
        collections.pods,
        id
      ) as unknown as Promise<PodDoc>,
      databases.getDocument(
        databaseId,
        collections.backups,
        body.backupId
      ) as unknown as Promise<BackupDoc>,
    ]);

    if (
      (pod.user_id !== ctx.userId || backup.user_id !== ctx.userId) &&
      ctx.profile.role !== "admin"
    ) {
      throw new AuthError("Forbidden", 403);
    }

    if (backup.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed backups can be restored." },
        { status: 400 }
      );
    }

    const result = await restoreBackupToPod(pod.lium_pod_id, {
      backup_id: backup.lium_backup_log_id,
      restore_path: body.restorePath,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return handleApiError(err);
  }
}
