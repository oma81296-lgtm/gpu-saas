import { NextRequest, NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG, PodDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import {
  createBackupConfig,
  deleteBackupConfig,
  getPodBackupConfigs,
  triggerPodBackup,
} from "@/lib/lium/client";

const backupActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("now"),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("schedule"),
    backupPath: z
      .string()
      .trim()
      .refine(
        (p) => p === "/root" || p.startsWith("/root/"),
        "Backup path must be /root or a subfolder inside /root (e.g. /root/checkpoints)"
      ),
    frequencyHours: z.number().int().min(1).max(168),
    retentionDays: z.number().int().min(1).max(365),
  }),
]);

async function loadOwnedPod(req: NextRequest, id: string) {
  const ctx = await requireAuth(req);
  const { databases } = createAdminAppwrite();
  const pod = (await databases.getDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.pods,
    id
  )) as unknown as PodDoc;

  if (pod.user_id !== ctx.userId && ctx.profile.role !== "admin") {
    throw new AuthError("Forbidden", 403);
  }
  return { ctx, pod };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { pod } = await loadOwnedPod(req, id);
    const configs = await getPodBackupConfigs(pod.lium_pod_id);
    return NextResponse.json({ configs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { ctx, pod } = await loadOwnedPod(req, id);
    const body = backupActionSchema.parse(await req.json());

    if (body.action === "schedule") {
      const config = await createBackupConfig({
        pod_id: pod.lium_pod_id,
        backup_path: body.backupPath,
        backup_frequency_hours: body.frequencyHours,
        retention_days: body.retentionDays,
      });
      return NextResponse.json({ config }, { status: 201 });
    }

    // Immediate manual backup
    const backupName =
      body.name || `${pod.name}-${new Date().toISOString().slice(0, 16)}`;
    const log = await triggerPodBackup(pod.lium_pod_id, {
      name: backupName,
      description: body.description,
    });

    const { databases } = createAdminAppwrite();
    const liumLogId = log.id || `pending-${Date.now()}`;
    const saved = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.backups,
      ID.unique(),
      {
        user_id: ctx.userId,
        pod_id: pod.$id,
        lium_pod_id: pod.lium_pod_id,
        pod_name: pod.name,
        lium_backup_log_id: liumLogId,
        name: backupName,
        description: body.description || null,
        backup_path: log.backup_path || "/root",
        size_bytes: Number(log.size_bytes ?? 0),
        status: "in_progress",
      }
    );

    return NextResponse.json({ backup: saved }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await loadOwnedPod(req, id);
    const configId = req.nextUrl.searchParams.get("configId");
    if (!configId) {
      return NextResponse.json({ error: "Missing configId" }, { status: 400 });
    }
    await deleteBackupConfig(configId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
