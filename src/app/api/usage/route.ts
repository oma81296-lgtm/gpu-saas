import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import {
  APPWRITE_CONFIG,
  CreditLedgerDoc,
  PodDoc,
} from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import {
  getPartnerRentals,
  getPodGpuUtilization,
  isLiumConfigured,
  listLiumPods,
  sanitizeCustomerRef,
} from "@/lib/lium/client";

function extractGpuUtilPercent(raw: Record<string, unknown> | null): number | null {
  if (!raw) return null;
  const direct =
    raw.gpu_utilization ??
    raw.utilization ??
    raw.avg_gpu_utilization ??
    raw.gpu_util;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return Math.round(direct);
  }
  const gpus = raw.gpus ?? raw.data;
  if (Array.isArray(gpus) && gpus.length > 0) {
    const vals = gpus
      .map((g) => {
        if (!g || typeof g !== "object") return null;
        const rec = g as Record<string, unknown>;
        const v = rec.gpu_utilization ?? rec.utilization ?? rec.util;
        return typeof v === "number" ? v : null;
      })
      .filter((v): v is number => v !== null);
    if (vals.length > 0) {
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const daysParam = Number(req.nextUrl.searchParams.get("days") || "30");
    const days = Math.min(366, Math.max(1, Number.isFinite(daysParam) ? Math.trunc(daysParam) : 30));

    const now = new Date();
    const sinceDate = new Date(now.getTime() - (days - 1) * 86_400_000);
    const sinceDay = sinceDate.toISOString().slice(0, 10);
    const untilDay = now.toISOString().slice(0, 10);
    const sinceIso = `${sinceDay}T00:00:00.000Z`;

    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const [podsRes, ledgerRes] = await Promise.all([
      databases.listDocuments(databaseId, collections.pods, [
        Query.equal("user_id", ctx.userId),
        Query.orderDesc("started_at"),
        Query.limit(200),
      ]),
      databases.listDocuments(databaseId, collections.creditLedger, [
        Query.equal("user_id", ctx.userId),
        Query.equal("type", "pod_usage"),
        Query.greaterThanEqual("$createdAt", sinceIso),
        Query.orderDesc("$createdAt"),
        Query.limit(500),
      ]),
    ]);

    const allPods = podsRes.documents as unknown as PodDoc[];
    const windowPods = allPods.filter(
      (p) =>
        p.started_at >= sinceIso ||
        p.status === "running" ||
        p.status === "starting" ||
        (p.stopped_at && p.stopped_at >= sinceIso)
    );
    const usageEntries = ledgerRes.documents as unknown as CreditLedgerDoc[];

    // Query Lium for verified customer_ref GPU-hours, fault_closes, and live pod telemetry
    // (Never return Lium's wholesale usd_billed to end customers!)
    let liumVerifiedGpuHours: number | null = null;
    let liumVerifiedRentals: number | null = null;
    let liumFaultCloses = 0;
    const livePodStatusMap = new Map<
      string,
      { billingPaused: boolean; nodeOffline: boolean; gpuUtilPercent: number | null }
    >();

    if (isLiumConfigured()) {
      const customerRef = sanitizeCustomerRef(ctx.userId);
      const [partnerRes, livePodsRes] = await Promise.allSettled([
        getPartnerRentals({
          since: sinceDay,
          until: untilDay,
          groupBy: "customer_ref",
        }),
        listLiumPods(),
      ]);

      if (partnerRes.status === "fulfilled") {
        const row = partnerRes.value.rows.find((r) => r.bucket === customerRef);
        if (row) {
          liumVerifiedGpuHours = Number(row.gpu_hours.toFixed(2));
          liumVerifiedRentals = row.rentals;
          liumFaultCloses = row.fault_closes;
        } else {
          liumVerifiedGpuHours = 0;
          liumVerifiedRentals = 0;
        }
      }

      if (livePodsRes.status === "fulfilled") {
        const liveById = new Map(livePodsRes.value.map((lp) => [lp.id, lp]));
        const runningUserPods = windowPods.filter(
          (p) => p.status === "running" && liveById.has(p.lium_pod_id)
        );
        await Promise.all(
          runningUserPods.slice(0, 10).map(async (pod) => {
            const lp = liveById.get(pod.lium_pod_id)!;
            const utilRaw = await getPodGpuUtilization(pod.lium_pod_id);
            livePodStatusMap.set(pod.lium_pod_id, {
              billingPaused: Boolean(lp.billing_paused),
              nodeOffline: Boolean(lp.node_offline),
              gpuUtilPercent: extractGpuUtilPercent(utilRaw),
            });
          })
        );
      }
    }

    // Build daily buckets
    const dailyMap = new Map<
      string,
      { date: string; retailMicroUsd: number; gpuHours: number; podsCount: number }
    >();
    for (let i = 0; i < days; i++) {
      const d = new Date(sinceDate.getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      dailyMap.set(d, { date: d, retailMicroUsd: 0, gpuHours: 0, podsCount: 0 });
    }

    for (const entry of usageEntries) {
      const day = entry.$createdAt.slice(0, 10);
      const bucket = dailyMap.get(day);
      if (bucket) {
        bucket.retailMicroUsd += Math.abs(entry.amount_micro_usd);
      }
    }

    // Per-GPU-model & per-pod usage stats
    const byModelMap = new Map<
      string,
      { gpuModel: string; rentals: number; gpuHours: number; retailMicroUsd: number }
    >();
    let computedTotalGpuHours = 0;
    let totalRetailMicroUsd = 0;
    let activeBurnRateHrMicroUsd = 0;

    const podRows = windowPods.map((pod) => {
      const startMs = new Date(pod.started_at).getTime();
      const endMs = pod.stopped_at
        ? new Date(pod.stopped_at).getTime()
        : now.getTime();
      const durationHours = Math.max(0, (endMs - startMs) / 3_600_000);
      const gpuHours = durationHours * pod.gpu_count;
      computedTotalGpuHours += gpuHours;
      totalRetailMicroUsd += pod.total_billed_micro_usd;

      if (pod.status === "running" || pod.status === "starting") {
        activeBurnRateHrMicroUsd += pod.retail_rate_hr_micro_usd;
      }

      const startDay = pod.started_at.slice(0, 10);
      const dayBucket = dailyMap.get(startDay);
      if (dayBucket) {
        dayBucket.gpuHours += gpuHours;
        dayBucket.podsCount += 1;
      }

      const modelRow = byModelMap.get(pod.gpu_model) || {
        gpuModel: pod.gpu_model,
        rentals: 0,
        gpuHours: 0,
        retailMicroUsd: 0,
      };
      modelRow.rentals += 1;
      modelRow.gpuHours += gpuHours;
      modelRow.retailMicroUsd += pod.total_billed_micro_usd;
      byModelMap.set(pod.gpu_model, modelRow);

      const liveMeta = livePodStatusMap.get(pod.lium_pod_id);

      return {
        id: pod.$id,
        name: pod.name,
        gpuModel: pod.gpu_model,
        gpuCount: pod.gpu_count,
        templateName: pod.template_name || pod.custom_image || "Custom",
        status: pod.status,
        startedAt: pod.started_at,
        stoppedAt: pod.stopped_at || null,
        durationHours: Number(durationHours.toFixed(2)),
        gpuHours: Number(gpuHours.toFixed(2)),
        retailRateHrMicroUsd: pod.retail_rate_hr_micro_usd,
        totalBilledMicroUsd: pod.total_billed_micro_usd,
        stopReason: pod.stop_reason || null,
        gpuUtilPercent: liveMeta?.gpuUtilPercent ?? null,
        billingPaused: liveMeta?.billingPaused ?? false,
        nodeOffline: liveMeta?.nodeOffline ?? false,
      };
    });

    const daily = Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      retailMicroUsd: d.retailMicroUsd,
      gpuHours: Number(d.gpuHours.toFixed(2)),
      podsCount: d.podsCount,
    }));

    const byGpuModel = Array.from(byModelMap.values())
      .map((m) => ({
        ...m,
        gpuHours: Number(m.gpuHours.toFixed(2)),
      }))
      .sort((a, b) => b.retailMicroUsd - a.retailMicroUsd);

    return NextResponse.json({
      window: { days, since: sinceDay, until: untilDay },
      summary: {
        totalRetailMicroUsd,
        gpuHours:
          liumVerifiedGpuHours !== null && liumVerifiedGpuHours > 0
            ? liumVerifiedGpuHours
            : Number(computedTotalGpuHours.toFixed(2)),
        liumVerifiedGpuHours,
        totalRentals:
          liumVerifiedRentals !== null && liumVerifiedRentals > 0
            ? liumVerifiedRentals
            : windowPods.length,
        faultCloses: liumFaultCloses,
        activeBurnRateHrMicroUsd,
      },
      daily,
      byGpuModel,
      pods: podRows,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
