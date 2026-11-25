import type {
  LiumAccountEvent,
  LiumBackupConfig,
  LiumBackupLog,
  LiumCreateTemplateRequest,
  LiumPartnerRentalsResponse,
  LiumPod,
  LiumPublicNodesResponse,
  LiumRentPodRequest,
  LiumResetGpuResponse,
  LiumTemplate,
  LiumUserMe,
  LiumVolume,
  LiumVolumeCostRow,
} from "./types";

const LIUM_BASE = (process.env.LIUM_API_BASE_URL || "https://lium.io/api").replace(
  /\/$/,
  ""
);

export class LiumApiError extends Error {
  status: number;
  code?: string;
  hint?: string;
  requestId?: string;

  constructor(
    message: string,
    status: number,
    details?: { code?: string; hint?: string; request_id?: string }
  ) {
    super(message);
    this.name = "LiumApiError";
    this.status = status;
    this.code = details?.code;
    this.hint = details?.hint;
    this.requestId = details?.request_id;
  }
}

export function isLiumConfigured(): boolean {
  return Boolean(
    process.env.LIUM_API_KEY &&
      process.env.LIUM_API_KEY !== "sk_your_lium_api_key_here"
  );
}

function getLiumApiKey(): string {
  const key = process.env.LIUM_API_KEY;
  if (!key || key === "sk_your_lium_api_key_here") {
    throw new LiumApiError(
      "LIUM_API_KEY is not configured on the server.",
      503,
      { code: "lium_not_configured" }
    );
  }
  return key;
}

async function liumFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    requireAuth?: boolean;
  } = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, requireAuth = true } = options;
  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (requireAuth) {
    reqHeaders["X-API-Key"] = getLiumApiKey();
  }
  if (body !== undefined) {
    reqHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${LIUM_BASE}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const errObj = (json?.error as Record<string, string> | undefined) || {};
    const msg =
      errObj.message ||
      (typeof json?.message === "string" ? json.message : null) ||
      `Lium API error (${res.status})`;
    throw new LiumApiError(msg, res.status, {
      code: errObj.code,
      hint: errObj.hint,
      request_id: errObj.request_id || (json?.request_id as string | undefined),
    });
  }

  return (json ?? ({} as unknown)) as T;
}

// ---------------------------------------------------------------------------
// 60-second in-memory cache for Public Nodes Feed (60 req/min IP limit)
// ---------------------------------------------------------------------------
let cachedNodes: { data: LiumPublicNodesResponse; fetchedAt: number } | null =
  null;
const NODES_TTL_MS = 60_000;

export async function fetchPublicNodes(
  forceRefresh = false
): Promise<LiumPublicNodesResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedNodes && now - cachedNodes.fetchedAt < NODES_TTL_MS) {
    return cachedNodes.data;
  }

  const data = await liumFetch<LiumPublicNodesResponse>("/public/v1/nodes", {
    requireAuth: false,
  });
  cachedNodes = { data, fetchedAt: now };
  return data;
}

// ---------------------------------------------------------------------------
// Resell Pod Lifecycle (tags every rental with X-Customer-Ref)
// ---------------------------------------------------------------------------
export function sanitizeCustomerRef(userId: string): string {
  // Lium allows 1-64 chars matching [A-Za-z0-9._:-]
  return userId.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 64);
}

export async function rentPod(
  executorUuid: string,
  customerUserId: string,
  payload: LiumRentPodRequest
): Promise<LiumPod> {
  return liumFetch<LiumPod>(`/executors/${encodeURIComponent(executorUuid)}/rent`, {
    method: "POST",
    headers: {
      "X-Customer-Ref": sanitizeCustomerRef(customerUserId),
    },
    body: payload,
  });
}

export async function createTemporaryTemplate(
  payload: LiumCreateTemplateRequest
): Promise<LiumTemplate> {
  return liumFetch<LiumTemplate>("/templates", {
    method: "POST",
    body: {
      is_private: true,
      is_temporary: true,
      one_time_template: true,
      ...payload,
    },
  });
}

export async function listLiumPods(): Promise<LiumPod[]> {
  try {
    const data = await liumFetch<LiumPod[] | { pods?: LiumPod[] }>("/pods");
    if (Array.isArray(data)) return data;
    return data.pods || [];
  } catch (err) {
    // Lium returns 402 on GET /pods when account has $0 balance and 0 pods
    if (err instanceof LiumApiError && err.status === 402) {
      return [];
    }
    throw err;
  }
}

export async function getLiumPod(podId: string): Promise<LiumPod> {
  return liumFetch<LiumPod>(`/pods/${encodeURIComponent(podId)}`);
}

export async function rebootLiumPod(podId: string): Promise<unknown> {
  return liumFetch(`/pods/${encodeURIComponent(podId)}/reboot`, {
    method: "POST",
  });
}

export async function resetLiumPodGpu(
  podId: string,
  gpuIndices?: number[] | null
): Promise<LiumResetGpuResponse> {
  return liumFetch<LiumResetGpuResponse>(
    `/pods/${encodeURIComponent(podId)}/reset-gpu`,
    {
      method: "POST",
      body: gpuIndices && gpuIndices.length > 0 ? { gpu_indices: gpuIndices } : {},
    }
  );
}

export async function getResetGpuStatus(
  podId: string,
  requestId: string
): Promise<LiumResetGpuResponse> {
  return liumFetch<LiumResetGpuResponse>(
    `/pods/${encodeURIComponent(podId)}/reset-gpu/${encodeURIComponent(requestId)}`
  );
}

export async function deleteLiumPod(podId: string): Promise<unknown> {
  return liumFetch(`/pods/${encodeURIComponent(podId)}`, {
    method: "DELETE",
  });
}

export async function getPodGpuUtilization(
  podId: string
): Promise<Record<string, unknown> | null> {
  try {
    return await liumFetch<Record<string, unknown>>(
      `/pods/${encodeURIComponent(podId)}/gpu-utilization`
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Partners Resell Reporting & Master Account Health
// ---------------------------------------------------------------------------
export async function getPartnerRentals(params: {
  since?: string;
  until?: string;
  groupBy?: "day" | "gpu" | "customer_ref";
}): Promise<LiumPartnerRentalsResponse> {
  const qs = new URLSearchParams();
  if (params.since) qs.set("since", params.since);
  if (params.until) qs.set("until", params.until);
  qs.set("group_by", params.groupBy || "customer_ref");
  return liumFetch<LiumPartnerRentalsResponse>(`/partners/me/rentals?${qs.toString()}`);
}

export async function getMasterAccount(): Promise<{
  raw: LiumUserMe;
  balanceUsd: number;
}> {
  const raw = await liumFetch<LiumUserMe>("/users/me");
  const balanceUsd = Number(
    raw.balance ?? raw.credit_balance ?? raw.usd_balance ?? 0
  );
  return { raw, balanceUsd: Number.isFinite(balanceUsd) ? balanceUsd : 0 };
}

export async function getAccountEvents(params?: {
  since?: string;
  podId?: string;
}): Promise<LiumAccountEvent[]> {
  const qs = new URLSearchParams();
  if (params?.since) qs.set("since", params.since);
  if (params?.podId) qs.set("pod_id", params.podId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const data = await liumFetch<LiumAccountEvent[] | { events?: LiumAccountEvent[] }>(
    `/users/me/events${suffix}`
  );
  if (Array.isArray(data)) return data;
  return data.events || [];
}

// ---------------------------------------------------------------------------
// Persistent Volumes
// ---------------------------------------------------------------------------
export async function listLiumVolumes(): Promise<LiumVolume[]> {
  const data = await liumFetch<LiumVolume[] | { volumes?: LiumVolume[]; data?: LiumVolume[] }>(
    "/volumes"
  );
  if (Array.isArray(data)) return data;
  return data.volumes || data.data || [];
}

export async function createLiumVolume(payload: {
  name: string;
  description?: string;
}): Promise<LiumVolume> {
  return liumFetch<LiumVolume>("/volumes", {
    method: "POST",
    body: payload,
  });
}

export async function deleteLiumVolume(volumeId: string): Promise<unknown> {
  return liumFetch(`/volumes/${encodeURIComponent(volumeId)}`, {
    method: "DELETE",
  });
}

export async function getLiumVolumeCosts(params: {
  startDate: string;
  endDate: string;
}): Promise<LiumVolumeCostRow[]> {
  const qs = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  const data = await liumFetch<
    LiumVolumeCostRow[] | { data?: LiumVolumeCostRow[] }
  >(`/volumes/costs?${qs.toString()}`);
  if (Array.isArray(data)) return data;
  return data.data || [];
}

// ---------------------------------------------------------------------------
// Pod Backups & Restore
// ---------------------------------------------------------------------------
export async function getPodBackupConfigs(
  podId: string
): Promise<LiumBackupConfig[]> {
  const data = await liumFetch<
    LiumBackupConfig[] | { data?: LiumBackupConfig[]; configs?: LiumBackupConfig[] }
  >(`/backup-configs/pod/${encodeURIComponent(podId)}`);
  if (Array.isArray(data)) return data;
  return data.configs || data.data || [];
}

export async function createBackupConfig(payload: {
  pod_id: string;
  backup_path: string;
  backup_frequency_hours: number;
  retention_days: number;
}): Promise<LiumBackupConfig> {
  return liumFetch<LiumBackupConfig>("/backup-configs", {
    method: "POST",
    body: payload,
  });
}

export async function deleteBackupConfig(configId: string): Promise<unknown> {
  return liumFetch(`/backup-configs/${encodeURIComponent(configId)}`, {
    method: "DELETE",
  });
}

export async function triggerPodBackup(
  podId: string,
  payload?: { name?: string; description?: string }
): Promise<LiumBackupLog> {
  return liumFetch<LiumBackupLog>(`/pods/${encodeURIComponent(podId)}/backup`, {
    method: "POST",
    body: payload || {},
  });
}

export async function listAllBackupLogs(): Promise<LiumBackupLog[]> {
  const data = await liumFetch<
    LiumBackupLog[] | { data?: LiumBackupLog[]; logs?: LiumBackupLog[]; items?: LiumBackupLog[] }
  >("/backup-logs/");
  if (Array.isArray(data)) return data;
  return data.logs || data.items || data.data || [];
}

export async function deleteBackupLog(logId: string): Promise<unknown> {
  return liumFetch(`/backup-logs/${encodeURIComponent(logId)}`, {
    method: "DELETE",
  });
}

export async function restoreBackupToPod(
  podId: string,
  payload: { backup_id: string; restore_path: string }
): Promise<unknown> {
  return liumFetch(`/pods/${encodeURIComponent(podId)}/restore`, {
    method: "POST",
    body: payload,
  });
}
