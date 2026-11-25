import { ID, Query } from "node-appwrite";
import { APPWRITE_CONFIG, VolumeDoc } from "../appwrite/config";
import { createAdminAppwrite } from "../appwrite/server";
import { getOperatorAlertSettings, sendOperatorAlert } from "../alerts";
import { usdToMicroUsd } from "../brand";
import { applyLedgerTransaction } from "../ledger";
import {
  getLiumVolumeCosts,
  getMasterAccount,
  getPartnerRentals,
} from "../lium/client";
import { getActivePricingRules } from "../pricing";

export async function runReconciliationCycle() {
  const { databases } = createAdminAppwrite();
  const { databaseId, collections } = APPWRITE_CONFIG;

  const today = new Date().toISOString().slice(0, 10);
  const windowStart = `${today}T00:00:00.000Z`;
  const windowEnd = new Date().toISOString();

  const [master, rentals, usageRes, alertSettings] = await Promise.all([
    getMasterAccount(),
    getPartnerRentals({ since: today, until: today, groupBy: "customer_ref" }),
    databases.listDocuments(databaseId, collections.creditLedger, [
      Query.equal("type", "pod_usage"),
      Query.greaterThanEqual("$createdAt", windowStart),
      Query.limit(500),
    ]),
    getOperatorAlertSettings(),
  ]);

  const liumUsdBilled = rentals.rows.reduce((s, r) => s + r.usd_billed, 0);
  const faultClosesCount = rentals.rows.reduce((s, r) => s + r.fault_closes, 0);
  const platformUsdBilled =
    usageRes.documents.reduce(
      (s, doc) => s + Math.abs(Number(doc.amount_micro_usd || 0)),
      0
    ) / 1_000_000;
  const grossMarginUsd = Number((platformUsdBilled - liumUsdBilled).toFixed(4));

  const run = await databases.createDocument(
    databaseId,
    collections.reconciliationRuns,
    ID.unique(),
    {
      window_start: windowStart,
      window_end: windowEnd,
      master_balance_usd: master.balanceUsd,
      lium_usd_billed: liumUsdBilled,
      platform_usd_billed: platformUsdBilled,
      gross_margin_usd: grossMarginUsd,
      fault_closes_count: faultClosesCount,
      details_json: JSON.stringify(rentals.rows).slice(0, 16000),
    }
  );

  const threshold = alertSettings?.master_balance_alert_threshold_usd ?? 100;
  if (master.balanceUsd < threshold) {
    await sendOperatorAlert({
      severity: "critical",
      title: "Master Lium Balance Low",
      message: `Your wholesale Lium balance ($${master.balanceUsd.toFixed(2)}) dropped below the alert threshold ($${threshold.toFixed(2)}). Top up immediately to avoid interrupting customer pods.`,
      fields: {
        "Master Balance": `$${master.balanceUsd.toFixed(2)}`,
        Threshold: `$${threshold.toFixed(2)}`,
      },
    });
  }

  if (faultClosesCount > 0) {
    await sendOperatorAlert({
      severity: "warning",
      title: "Provider Fault Closes Detected Today",
      message: `${faultClosesCount} rental(s) closed due to provider/platform faults today (${today}).`,
      fields: {
        "Lium Wholesale Billed": `$${liumUsdBilled.toFixed(2)}`,
        "Platform Retail Billed": `$${platformUsdBilled.toFixed(2)}`,
      },
    });
  }

  // Bill yesterday's finalized Lium persistent volume costs (idempotent per volume/day)
  let volumesBilledCount = 0;
  try {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const [volCosts, rules, volDocsRes] = await Promise.all([
      getLiumVolumeCosts({ startDate: yesterday, endDate: yesterday }),
      getActivePricingRules(),
      databases.listDocuments(databaseId, collections.volumes, [Query.limit(200)]),
    ]);

    const globalMarkup =
      rules.find((r) => r.scope === "global")?.markup_percent ?? 20;
    const volByLiumId = new Map(
      (volDocsRes.documents as unknown as VolumeDoc[]).map((v) => [
        v.lium_volume_id,
        v,
      ])
    );

    for (const row of volCosts) {
      const wholesaleUsd = Number(row.chargeable_cost ?? 0);
      if (!Number.isFinite(wholesaleUsd) || wholesaleUsd <= 0) continue;
      const vol = volByLiumId.get(row.volume_id);
      if (!vol || vol.last_billed_date === yesterday) continue;

      const retailMicro = usdToMicroUsd(wholesaleUsd * (1 + globalMarkup / 100));
      if (retailMicro <= 0) continue;

      const tx = await applyLedgerTransaction({
        userId: vol.user_id,
        type: "pod_usage",
        amountMicroUsd: -retailMicro,
        referenceId: `vol_${vol.$id}_${yesterday}`,
        note: `Persistent volume "${vol.name}" storage & egress (${yesterday})`,
      });

      if (!tx.duplicate) {
        volumesBilledCount++;
        await databases.updateDocument(databaseId, collections.volumes, vol.$id, {
          last_billed_date: yesterday,
          total_billed_micro_usd: vol.total_billed_micro_usd + retailMicro,
        });
      }
    }
  } catch (volErr) {
    console.warn("[reconcile:volumes] skipped volume billing:", volErr);
  }

  return {
    runId: run.$id,
    masterBalanceUsd: master.balanceUsd,
    liumUsdBilled,
    platformUsdBilled,
    grossMarginUsd,
    faultClosesCount,
    volumesBilledCount,
  };
}
