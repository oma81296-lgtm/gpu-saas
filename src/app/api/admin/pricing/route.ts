import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAdmin } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

const createRuleSchema = z.object({
  scope: z.enum(["global", "gpu_model"]),
  gpuModel: z.string().trim().nullable().optional(),
  markupPercent: z.number().min(0).max(500),
  minReliabilityScore: z.number().min(0).max(100).default(90),
  enabled: z.boolean().default(true),
});

const updateRuleSchema = z.object({
  id: z.string().min(1),
  markupPercent: z.number().min(0).max(500).optional(),
  minReliabilityScore: z.number().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.pricingRules,
      [Query.limit(100)]
    );
    return NextResponse.json({ rules: res.documents });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = createRuleSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();

    const doc = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.pricingRules,
      ID.unique(),
      {
        scope: body.scope,
        gpu_model: body.scope === "gpu_model" ? body.gpuModel || null : null,
        markup_percent: body.markupPercent,
        min_reliability_score: body.minReliabilityScore,
        enabled: body.enabled,
      }
    );

    return NextResponse.json({ rule: doc }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = updateRuleSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();

    const patch: Record<string, unknown> = {};
    if (body.markupPercent !== undefined) patch.markup_percent = body.markupPercent;
    if (body.minReliabilityScore !== undefined)
      patch.min_reliability_score = body.minReliabilityScore;
    if (body.enabled !== undefined) patch.enabled = body.enabled;

    const doc = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.pricingRules,
      body.id,
      patch
    );

    return NextResponse.json({ rule: doc });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const { databases } = createAdminAppwrite();
    await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.pricingRules,
      id
    );
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
