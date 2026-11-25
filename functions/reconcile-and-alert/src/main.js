/**
 * Appwrite Function: reconcile-and-alert
 * Recommended schedule: 0 * * * * (every hour)
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

  const response = await fetch(`${baseUrl}/api/internal/reconcile`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await response.json();
  log(`Reconcile cycle (${response.status}): ${JSON.stringify(body)}`);
  return res.json(body, response.status);
};
