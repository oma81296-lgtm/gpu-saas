import { ID, Query } from "node-appwrite";
import { APPWRITE_CONFIG, PodDoc, UserProfileDoc } from "../appwrite/config";
import { createAdminAppwrite } from "../appwrite/server";
import { sendOperatorAlert } from "../alerts";
import { applyLedgerTransaction } from "../ledger";
import {
  deleteLiumPod,
  getAccountEvents,
  listLiumPods,
  LiumApiError,
} from "../lium/client";

export interface MeterRunSummary {
  checkedPods: number;
  billedPods: number;
  terminatedForCredits: number;
  faultClosed: number;
  lowBalanceWarnings: number;
}

/**
 * 1-minute prepaid metering & auto-stop worker.
 * - Syncs active pods with Lium
 * - Debits elapsed seconds * retail_rate_hr_micro_usd / 3600
 * - Auto-terminates user's pods when balance <= $0
 * - Detects provider faults and alerts operators
 */
export async function runPodMeteringCycle(): Promise<MeterRunSummary> {
  const { databases } = createAdminAppwrite();
  const { databaseId, collections } = APPWRITE_CONFIG;

  const summary: MeterRunSummary = {
    checkedPods: 0,
    billedPods: 0,
    terminatedForCredits: 0,
    faultClosed: 0,
    lowBalanceWarnings: 0,
  };

  const activeRes = await databases.listDocuments(databaseId, collections.pods, [
    Query.equal("status", ["starting", "running"]),
    Query.limit(200),
  ]);

  const activePods = activeRes.documents as unknown as PodDoc[];
  summary.checkedPods = activePods.length;
  if (activePods.length === 0) return summary;

  const livePods = await listLiumPods();
  const liveMap = new Map(livePods.map((p) => [p.id, p]));
  const now = new Date();
  const nowIso = now.toISOString();
  const minuteBucket = nowIso.slice(0, 16); // YYYY-MM-DDTHH:MM for idempotent billing

  const podsByUser = new Map<string, PodDoc[]>();

  for (const pod of activePods) {
    const live = liveMap.get(pod.lium_pod_id);

    // Case 1: Pod disappeared from Lium unexpectedly (possible provider fault)
    if (!live) {
      let isFault = false;
      try {
        const events = await getAccountEvents({ podId: pod.lium_pod_id });
        isFault = events.some((e) =>
          `${e.event_type} ${e.sub_event_type || ""} ${e.event || ""}`
            .toLowerCase()
            .includes("fault")
        );
      } catch {
        // ignore event lookup error
      }

      await databases.updateDocument(databaseId, collections.pods, pod.$id, {
        status: isFault ? "fault_closed" : "stopped",
        stopped_at: nowIso,
        stop_reason: isFault ? "provider_fault" : "unknown",
      });

      if (isFault) {
        summary.faultClosed++;
        await sendOperatorAlert({
          severity: "warning",
          title: "Provider Fault Closed Pod",
          message: `Pod "${pod.name}" (${pod.gpu_count}x ${pod.gpu_model}) ended due to a provider/platform fault.`,
          fields: {
            User: pod.user_id,
            "Lium Pod ID": pod.lium_pod_id,
          },
        });
      }
      continue;
    }

    // Case 2: Live pod exists — sync status & meter if running
    const liveStatus = (live.status || "").toLowerCase();
    const isRunning =
      liveStatus === "running" || liveStatus === "active" || liveStatus === "ready";

    const elapsedSec = Math.max(
      0,
      Math.floor((now.getTime() - new Date(pod.last_billed_at).getTime()) / 1000)
    );

    let charged = 0;
    if (isRunning && elapsedSec > 0) {
      charged = Math.floor((elapsedSec * pod.retail_rate_hr_micro_usd) / 3600);
      if (charged > 0) {
        const tx = await applyLedgerTransaction({
          userId: pod.user_id,
          type: "pod_usage",
          amountMicroUsd: -charged,
          referenceId: `meter_${pod.$id}_${minuteBucket}`,
          podId: pod.$id,
          note: `Metered ${elapsedSec}s on ${pod.name} (${pod.gpu_count}x ${pod.gpu_model})`,
        });
        if (!tx.duplicate) summary.billedPods++;
      }
    }

    await databases.updateDocument(databaseId, collections.pods, pod.$id, {
      status: isRunning ? "running" : "starting",
      ssh_command: live.ssh_connect_cmd || pod.ssh_command || null,
      jupyter_url: live.jupyter_url || pod.jupyter_url || null,
      last_billed_at: isRunning ? nowIso : pod.last_billed_at,
      total_billed_micro_usd: pod.total_billed_micro_usd + charged,
    });

    const userList = podsByUser.get(pod.user_id) || [];
    userList.push(pod);
    podsByUser.set(pod.user_id, userList);
  }

  // Per-user balance enforcement (warn <15 min, auto-terminate at <= $0)
  for (const [userId, userPods] of podsByUser.entries()) {
    const profileRes = await databases.listDocuments(
      databaseId,
      collections.userProfiles,
      [Query.equal("user_id", userId), Query.limit(1)]
    );
    if (profileRes.documents.length === 0) continue;
    const profile = profileRes.documents[0] as unknown as UserProfileDoc;

    const totalBurnHrMicro = userPods.reduce(
      (sum, p) => sum + p.retail_rate_hr_micro_usd,
      0
    );

    if (profile.balance_micro_usd <= 0) {
      for (const pod of userPods) {
        try {
          await deleteLiumPod(pod.lium_pod_id);
        } catch (err) {
          if (!(err instanceof LiumApiError && err.status === 404)) {
            console.error("[meter:terminate]", pod.lium_pod_id, err);
          }
        }
        await databases.updateDocument(databaseId, collections.pods, pod.$id, {
          status: "stopped",
          stopped_at: nowIso,
          stop_reason: "out_of_credits",
        });
        summary.terminatedForCredits++;
      }

      // Notify the user in their Notification Bar that pods were auto-stopped
      try {
        await databases.createDocument(
          databaseId,
          collections.notifications,
          ID.unique(),
          {
            title: "Pods Stopped — Out of Credits",
            message: `Your ${userPods.length} active pod(s) were automatically terminated because your credit balance reached $0.00.`,
            severity: "critical",
            target_user_id: userId,
            action_label: "Top Up Credits",
            action_url: "/billing",
            active: true,
            dismissible: true,
            expires_at: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
            created_by: "system:meter-pods",
          }
        );
      } catch (notifErr) {
        console.warn("[meter:notif:out_of_credits]", notifErr);
      }
    } else if (totalBurnHrMicro > 0) {
      const runwayMinutes =
        (profile.balance_micro_usd / totalBurnHrMicro) * 60;
      const recentlyWarned =
        profile.low_balance_warned_at &&
        now.getTime() - new Date(profile.low_balance_warned_at).getTime() <
          30 * 60_000;

      if (runwayMinutes < 15 && !recentlyWarned) {
        summary.lowBalanceWarnings++;
        await databases.updateDocument(
          databaseId,
          collections.userProfiles,
          profile.$id,
          { low_balance_warned_at: nowIso }
        );

        // Drop a targeted low-balance warning banner into the user's Notification Bar
        try {
          const minsLeft = Math.max(1, Math.floor(runwayMinutes));
          await databases.createDocument(
            databaseId,
            collections.notifications,
            ID.unique(),
            {
              title: "Low Balance Warning",
              message: `Less than ${minsLeft} minute(s) of credit remaining for your active pods. Top up now to prevent automatic pod termination.`,
              severity: "warning",
              target_user_id: userId,
              action_label: "Top Up Credits",
              action_url: "/billing",
              active: true,
              dismissible: true,
              expires_at: new Date(now.getTime() + 2 * 3_600_000).toISOString(),
              created_by: "system:meter-pods",
            }
          );
        } catch (notifErr) {
          console.warn("[meter:notif:low_balance]", notifErr);
        }
      }
    }
  }

  return summary;
}
