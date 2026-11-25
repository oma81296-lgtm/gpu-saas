import { NextRequest, NextResponse } from "next/server";
import { runPodMeteringCycle } from "@/lib/workers/meter";

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
    const summary = await runPodMeteringCycle();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[internal:meter]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Metering failed" },
      { status: 500 }
    );
  }
}
