import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { encodeGpuId } from "@/lib/gpu-id";
import { fetchPublicNodes } from "@/lib/lium/client";
import { buildMarketplaceNodes, getActivePricingRules } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
    const [feed, rules] = await Promise.all([
      fetchPublicNodes(forceRefresh),
      getActivePricingRules(),
    ]);

    const nodes = buildMarketplaceNodes(feed.nodes || [], rules).map(
      ({ wholesalePricePerGpuHr: _w, markupPercent: _m, ...publicNode }) => ({
        ...publicNode,
        id: encodeGpuId(publicNode.id),
      })
    );

    return NextResponse.json({
      generatedAt: feed.generated_at,
      totalSecureNodes: nodes.length,
      nodes,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
