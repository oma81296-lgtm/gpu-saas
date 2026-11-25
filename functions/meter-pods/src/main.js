/**
 * Appwrite Function: meter-pods
 * Recommended schedule: * * * * * (every 1 minute)
 * Required Function Env Vars:
 *   APP_BASE_URL (e.g. https://voltgpu.yourdomain.com)
 *   INTERNAL_CRON_SECRET (matches Next.js INTERNAL_CRON_SECRET)
 */
export default async ({ res, log, error }) => {
  const baseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const secret = process.env.INTERNAL_CRON_SECRET || "";

  if (!baseUrl || !secret) {
    error("Missing APP_BASE_URL or INTERNAL_CRON_SECRET");
    return res.json({ ok: false, error: "Misconfigured function env" }, 500);
  }

  const response = await fetch(`${baseUrl}/api/internal/meter`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await response.json();
  log(`Meter cycle (${response.status}): ${JSON.stringify(body)}`);
  return res.json(body, response.status);
};
