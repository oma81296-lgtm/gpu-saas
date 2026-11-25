import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAdmin } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { getOperatorAlertSettings, sendOperatorAlert } from "@/lib/alerts";

const updateAlertsSchema = z.object({
  masterBalanceAlertThresholdUsd: z.number().min(0).max(100000),
  discordWebhookUrl: z.string().trim().nullable().optional(),
  telegramBotToken: z.string().trim().nullable().optional(),
  telegramChatId: z.string().trim().nullable().optional(),
  alertEmail: z.string().trim().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const settings = await getOperatorAlertSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = updateAlertsSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const payload = {
      key: "alerts_config",
      master_balance_alert_threshold_usd: body.masterBalanceAlertThresholdUsd,
      discord_webhook_url: body.discordWebhookUrl || null,
      telegram_bot_token: body.telegramBotToken || null,
      telegram_chat_id: body.telegramChatId || null,
      alert_email: body.alertEmail || null,
    };

    let doc;
    try {
      doc = await databases.updateDocument(
        databaseId,
        collections.operatorSettings,
        "alerts_config",
        payload
      );
    } catch {
      doc = await databases.createDocument(
        databaseId,
        collections.operatorSettings,
        "alerts_config",
        payload
      );
    }

    return NextResponse.json({ settings: doc });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    await sendOperatorAlert({
      severity: "info",
      title: "Test Operator Alert",
      message: `Triggered manually by ${admin.email}. Alert pipeline is working!`,
      fields: { Timestamp: new Date().toISOString() },
    });
    return NextResponse.json({ sent: true });
  } catch (err) {
    return handleApiError(err);
  }
}
