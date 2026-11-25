import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { APPWRITE_CONFIG, BackupDoc, PodDoc } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { isLiumConfigured, listAllBackupLogs } from "@/lib/lium/client";
import { getActivePricingRules } from "@/lib/pricing";

const WHOLESALE_GB_HR_USD = 0.00005;

function normalizeBackupStatus(raw?: string): BackupDoc["status"] {
  const s = (raw || "").toLowerCase();
  if (s === "completed" || s === "success" || s === "done") return "completed";
  if (s === "in_progress" || s === "running" || s === "uploading")
    return "in_progress";
  if (s === "failed" || s === "error" || s === "cancelled") return "failed";
  if (s === "deleted") return "deleted";
  return "pending";
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const [backupsRes, podsRes, rules] = await Promise.all([
      databases.listDocuments(databaseId, collections.backups, [
        Query.equal("user_id", ctx.userId),
        Query.notEqual("status", "deleted"),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]),
      databases.listDocuments(databaseId, collections.pods, [
        Query.equal("user_id", ctx.userId),
        Query.limit(200),
      ]),
      getActivePricingRules(),
    ]);

    const globalMarkup =
      rules.find((r) => r.scope === "global")?.markup_percent ?? 20;
    const retailPerGbMonthUsd = Number(
      (WHOLESALE_GB_HR_USD * 730 * (1 + globalMarkup / 100)).toFixed(4)
    );

    const backups = backupsRes.documents as unknown as BackupDoc[];
    const userPods = podsRes.documents as unknown as PodDoc[];
    const userPodByLiumId = new Map(userPods.map((p) => [p.lium_pod_id, p]));
    const existingByLiumBackupId = new Map(
      backups.map((b) => [b.lium_backup_log_id, b])
    );

    // Sync live status & sizes from Lium and import any scheduled backups for user's pods
    if (isLiumConfigured() && userPods.length > 0) {
      try {
        const liveLogs = await listAllBackupLogs();
        for (const log of liveLogs) {
          if (!log.id || !log.pod_id) continue;
          const ownedPod = userPodByLiumId.get(log.pod_id);
          if (!ownedPod) continue;

          const nextStatus = normalizeBackupStatus(log.status);
          const nextSize = Math.max(
            0,
            Math.trunc(Number(log.size_bytes ?? log.file_size_bytes ?? 0))
          );

          const existing = existingByLiumBackupId.get(log.id);
          if (existing) {
            if (
              existing.status !== nextStatus ||
              existing.size_bytes !== nextSize
            ) {
              await databases.updateDocument(
                databaseId,
                collections.backups,
                existing.$id,
                { status: nextStatus, size_bytes: nextSize }
              );
              existing.status = nextStatus;
              existing.size_bytes = nextSize;
            }
          } else if (nextStatus !== "deleted") {
            const created = (await databases.createDocument(
              databaseId,
              collections.backups,
              ID.unique(),
              {
                user_id: ctx.userId,
                pod_id: ownedPod.$id,
                lium_pod_id: ownedPod.lium_pod_id,
                pod_name: ownedPod.name,
                lium_backup_log_id: log.id,
                name: log.name || `Auto backup (${ownedPod.name})`,
                description: log.description || null,
                backup_path: log.backup_path || "/root",
                size_bytes: nextSize,
                status: nextStatus,
              }
            )) as unknown as BackupDoc;
            backups.unshift(created);
            existingByLiumBackupId.set(log.id, created);
          }
        }
      } catch (syncErr) {
        console.warn("[backups:sync]", syncErr);
      }
    }

    return NextResponse.json({
      retailPerGbMonthUsd,
      backups,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
