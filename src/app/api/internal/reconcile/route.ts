import { NextRequest, NextResponse } from "next/server";
import { runReconciliationCycle } from "@/lib/workers/reconcile";

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runReconciliationCycle();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[internal:reconcile]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reconciliation failed" },
      { status: 500 }
    );
  }
}
