import { Query } from "node-appwrite";
import { APPWRITE_CONFIG, PricingRuleDoc } from "./appwrite/config";
import { createAdminAppwrite, isAppwriteServerConfigured } from "./appwrite/server";
import type { LiumPublicNode, MarketplaceGpuNode } from "./lium/types";

const DEFAULT_MARKUP_PERCENT = 20;
const DEFAULT_MIN_RELIABILITY = 90;

export async function getActivePricingRules(): Promise<PricingRuleDoc[]> {
  if (!isAppwriteServerConfigured()) {
    return [
      {
        $id: "default_fallback",
        scope: "global",
        gpu_model: null,
        markup_percent: DEFAULT_MARKUP_PERCENT,
        min_reliability_score: DEFAULT_MIN_RELIABILITY,
        enabled: true,
      },
    ];
  }

  try {
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.pricingRules,
      [Query.equal("enabled", true), Query.limit(100)]
    );
    return res.documents as unknown as PricingRuleDoc[];
  } catch {
    return [
      {
        $id: "default_fallback",
        scope: "global",
        gpu_model: null,
        markup_percent: DEFAULT_MARKUP_PERCENT,
        min_reliability_score: DEFAULT_MIN_RELIABILITY,
        enabled: true,
      },
    ];
  }
}

export function resolveRuleForGpu(
  gpuModel: string,
  rules: PricingRuleDoc[]
): { markupPercent: number; minReliability: number } {
  const normalized = gpuModel.trim().toLowerCase();
  const specific = rules.find(
    (r) =>
      r.scope === "gpu_model" &&
      r.gpu_model &&
      r.gpu_model.trim().toLowerCase() === normalized
  );
  const globalRule = rules.find((r) => r.scope === "global");

  return {
    markupPercent:
      specific?.markup_percent ??
      globalRule?.markup_percent ??
      DEFAULT_MARKUP_PERCENT,
    minReliability:
      specific?.min_reliability_score ??
      globalRule?.min_reliability_score ??
      DEFAULT_MIN_RELIABILITY,
  };
}

/**
 * Applies VoltGPU marketplace policy:
 *  - Secure tier ONLY (hides Spot nodes)
 *  - Available right now
 *  - Meets minimum reliability score (when score is present)
 *  - Applies configurable global or per-GPU markup
 */
export function buildMarketplaceNodes(
  nodes: LiumPublicNode[],
  rules: PricingRuleDoc[]
): MarketplaceGpuNode[] {
  const result: MarketplaceGpuNode[] = [];

  for (const node of nodes) {
    if (!node.available_now) continue;
    if ((node.tier || "").toLowerCase() !== "secure") continue;
    if (!node.gpu_model || typeof node.price_per_gpu_hour !== "number") continue;

    const { markupPercent, minReliability } = resolveRuleForGpu(
      node.gpu_model,
      rules
    );

    if (
      typeof node.reliability_score === "number" &&
      node.reliability_score < minReliability
    ) {
      continue;
    }

    const gpuCount = node.available_gpu_count || node.gpu_count || 1;
    const wholesalePerGpu = node.price_per_gpu_hour;
    const retailPerGpu = Number(
      (wholesalePerGpu * (1 + markupPercent / 100)).toFixed(2)
    );
    const retailPerNode = Number((retailPerGpu * gpuCount).toFixed(2));

    result.push({
      id: node.id,
      gpuModel: node.gpu_model,
      gpuCount: node.gpu_count || gpuCount,
      availableGpuCount: gpuCount,
      minRentableGpuCount: node.min_rentable_gpu_count || 1,
      vramPerGpuGb: node.gpu_memory_gb || 0,
      cpuCount: node.cpu_count || 0,
      ramGb: node.ram_gb || 0,
      diskFreeGb: node.disk_free_gb || node.disk_gb || 0,
      diskType: (node.disk_type || "nvme").toUpperCase(),
      networkDownMbps: Math.round(node.network_download_mbps || 0),
      networkUpMbps: Math.round(node.network_upload_mbps || 0),
      reliabilityScore: node.reliability_score ?? null,
      interconnect: node.gpu_interconnect ?? null,
      cudaDriver: node.cuda_driver ?? null,
      country: node.country || "Unknown",
      countryCode: node.country_code || "",
      city: node.city || "",
      wholesalePricePerGpuHr: wholesalePerGpu,
      retailPricePerGpuHr: retailPerGpu,
      retailPricePerNodeHr: retailPerNode,
      markupPercent,
    });
  }

  return result.sort((a, b) => a.retailPricePerGpuHr - b.retailPricePerGpuHr);
}
