import { APPWRITE_CONFIG, OperatorSettingsDoc } from "./appwrite/config";
import { createAdminAppwrite, isAppwriteServerConfigured } from "./appwrite/server";
import { BRAND } from "./brand";

export interface AlertPayload {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  fields?: Record<string, string | number>;
}

export async function getOperatorAlertSettings(): Promise<OperatorSettingsDoc | null> {
  if (!isAppwriteServerConfigured()) return null;
  try {
    const { databases } = createAdminAppwrite();
    const doc = await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.operatorSettings,
      "alerts_config"
    );
    return doc as unknown as OperatorSettingsDoc;
  } catch {
    return null;
  }
}

export async function sendOperatorAlert(payload: AlertPayload): Promise<void> {
  const settings = await getOperatorAlertSettings();
  if (!settings) return;

  const emoji =
    payload.severity === "critical"
      ? "🚨"
      : payload.severity === "warning"
        ? "⚠️"
        : "ℹ️";

  const fieldLines = payload.fields
    ? Object.entries(payload.fields)
        .map(([k, v]) => `• **${k}**: ${v}`)
        .join("\n")
    : "";

  const fullText = `${emoji} **[${BRAND.name}] ${payload.title}**\n${payload.message}${fieldLines ? `\n${fieldLines}` : ""}`;

  const tasks: Promise<unknown>[] = [];

  if (settings.discord_webhook_url) {
    tasks.push(
      fetch(settings.discord_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: fullText,
        }),
      }).catch((err) => console.error("[alert:discord]", err))
    );
  }

  if (settings.telegram_bot_token && settings.telegram_chat_id) {
    tasks.push(
      fetch(
        `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegram_chat_id,
            text: fullText.replace(/\*\*/g, ""),
          }),
        }
      ).catch((err) => console.error("[alert:telegram]", err))
    );
  }

  await Promise.allSettled(tasks);
}
