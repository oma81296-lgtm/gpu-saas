import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAdmin } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import {
  getMasterAccount,
  getPartnerRentals,
  isLiumConfigured,
} from "@/lib/lium/client";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const since =
      req.nextUrl.searchParams.get("since") ||
      new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const until =
      req.nextUrl.searchParams.get("until") ||
      new Date().toISOString().slice(0, 10);

    const [usersRes, activePodsRes, reconRes, usageLedgerRes] =
      await Promise.all([
        databases.listDocuments(databaseId, collections.userProfiles, [
          Query.limit(1),
        ]),
        databases.listDocuments(databaseId, collections.pods, [
          Query.equal("status", ["starting", "running"]),
          Query.limit(100),
        ]),
        databases.listDocuments(databaseId, collections.reconciliationRuns, [
          Query.orderDesc("window_end"),
          Query.limit(14),
        ]),
        databases.listDocuments(databaseId, collections.creditLedger, [
          Query.equal("type", "pod_usage"),
          Query.greaterThanEqual("$createdAt", `${since}T00:00:00.000Z`),
          Query.limit(500),
        ]),
      ]);

    const platformBilledMicro = usageLedgerRes.documents.reduce(
      (sum, doc) => sum + Math.abs(Number(doc.amount_micro_usd || 0)),
      0
    );
    const platformUsdBilled = platformBilledMicro / 1_000_000;

    let masterBalanceUsd: number | null = null;
    let partnerRentals = null;
    let liumError: string | null = null;

    if (isLiumConfigured()) {
      try {
        const [master, rentals] = await Promise.all([
          getMasterAccount(),
          getPartnerRentals({ since, until, groupBy: "customer_ref" }),
        ]);
        masterBalanceUsd = master.balanceUsd;
        partnerRentals = rentals;
      } catch (err) {
        liumError = err instanceof Error ? err.message : "Failed to query Lium";
      }
    } else {
      liumError = "LIUM_API_KEY not configured";
    }

    const liumUsdBilled = partnerRentals
      ? partnerRentals.rows.reduce((s, r) => s + r.usd_billed, 0)
      : 0;
    const faultCloses = partnerRentals
      ? partnerRentals.rows.reduce((s, r) => s + r.fault_closes, 0)
      : 0;

    return NextResponse.json({
      window: { since, until },
      masterBalanceUsd,
      liumError,
      totalUsers: usersRes.total,
      activePodsCount: activePodsRes.total,
      liumUsdBilled,
      platformUsdBilled,
      grossMarginUsd: Number((platformUsdBilled - liumUsdBilled).toFixed(4)),
      faultCloses,
      partnerRentals,
      reconciliationRuns: reconRes.documents,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
