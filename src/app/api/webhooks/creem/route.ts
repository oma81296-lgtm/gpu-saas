import { NextRequest, NextResponse } from "next/server";
import { verifyCreemWebhookSignature } from "@/lib/creem";
import { applyLedgerTransaction } from "@/lib/ledger";

interface CreemWebhookPayload {
  id?: string;
  eventType?: string;
  event_type?: string;
  object?: {
    id?: string;
    order?: { id?: string; amount?: number };
    metadata?: Record<string, string>;
    product?: { id?: string; name?: string; price?: number };
  };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("creem-signature");

    if (!verifyCreemWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as CreemWebhookPayload;
    const eventType = event.eventType || event.event_type || "";

    if (eventType !== "checkout.completed" && eventType !== "order.paid") {
      return NextResponse.json({ received: true, ignored: eventType });
    }

    const obj = event.object || {};
    const metadata = obj.metadata || {};
    const userId = metadata.user_id;
    const creditsMicroUsd = Number(metadata.credits_micro_usd || 0);
    const orderId = obj.order?.id || obj.id || event.id;

    if (!userId || !Number.isFinite(creditsMicroUsd) || creditsMicroUsd <= 0) {
      return NextResponse.json(
        { error: "Missing user_id or credits_micro_usd in metadata" },
        { status: 400 }
      );
    }

    const result = await applyLedgerTransaction({
      userId,
      type: "topup",
      amountMicroUsd: creditsMicroUsd,
      referenceId: `creem_order_${orderId}`,
      note: `Creem top-up (${metadata.pack_id || "credits"})`,
    });

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      balanceMicroUsd: result.balanceMicroUsd,
    });
  } catch (err) {
    console.error("[webhooks:creem]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
