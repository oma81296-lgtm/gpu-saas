import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_CONFIG, PodDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { applyLedgerTransaction } from "@/lib/ledger";
import { deleteLiumPod, LiumApiError } from "@/lib/lium/client";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);
    const { id } = await context.params;
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const pod = (await databases.getDocument(
      databaseId,
      collections.pods,
      id
    )) as unknown as PodDoc;

    if (pod.user_id !== ctx.userId && ctx.profile.role !== "admin") {
      throw new AuthError("Forbidden", 403);
    }

    if (pod.status === "stopped" || pod.status === "fault_closed") {
      return NextResponse.json({ pod, alreadyStopped: true });
    }

    // Terminate on Lium (ignore 404 if already gone)
    try {
      await deleteLiumPod(pod.lium_pod_id);
    } catch (err) {
      if (!(err instanceof LiumApiError && err.status === 404)) {
        throw err;
      }
    }

    // Final per-second billing settlement
    const now = new Date();
    const lastBilledMs = new Date(pod.last_billed_at).getTime();
    const elapsedSec = Math.max(0, Math.floor((now.getTime() - lastBilledMs) / 1000));
    const finalCharge = Math.floor(
      (elapsedSec * pod.retail_rate_hr_micro_usd) / 3600
    );

    if (finalCharge > 0) {
      await applyLedgerTransaction({
        userId: pod.user_id,
        type: "pod_usage",
        amountMicroUsd: -finalCharge,
        referenceId: `final_${pod.$id}`,
        podId: pod.$id,
        note: `Final settlement (${elapsedSec}s) on ${pod.name}`,
      });
    }

    const updated = await databases.updateDocument(
      databaseId,
      collections.pods,
      pod.$id,
      {
        status: "stopped",
        stopped_at: now.toISOString(),
        last_billed_at: now.toISOString(),
        total_billed_micro_usd: pod.total_billed_micro_usd + finalCharge,
        stop_reason: "user_terminated",
      }
    );

    return NextResponse.json({ pod: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
