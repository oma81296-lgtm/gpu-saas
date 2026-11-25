import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG, VolumeDoc } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import {
  createLiumVolume,
  isLiumConfigured,
  listLiumVolumes,
} from "@/lib/lium/client";
import { getActivePricingRules } from "@/lib/pricing";

const WHOLESALE_GB_HR_USD = 0.00005; // Lium's published volume storage rate

const createVolumeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, underscores or hyphens"),
  description: z.string().trim().max(300).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const [volRes, rules] = await Promise.all([
      databases.listDocuments(databaseId, collections.volumes, [
        Query.equal("user_id", ctx.userId),
        Query.equal("status", "active"),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]),
      getActivePricingRules(),
    ]);

    const globalRule = rules.find((r) => r.scope === "global");
    const markupPercent = globalRule?.markup_percent ?? 20;
    const retailPerGbMonthUsd = Number(
      (WHOLESALE_GB_HR_USD * 730 * (1 + markupPercent / 100)).toFixed(4)
    );

    const volumes = volRes.documents as unknown as VolumeDoc[];
    const attachedMap = new Map<string, { podName?: string; fileCount?: number }>();

    if (volumes.length > 0 && isLiumConfigured()) {
      try {
        const live = await listLiumVolumes();
        const liveMap = new Map(live.map((v) => [v.id, v]));

        await Promise.all(
          volumes.map(async (vol) => {
            const lv = liveMap.get(vol.lium_volume_id);
            if (!lv) return;
            const sizeGb = Number((lv.current_size_gb ?? 0).toFixed(3));
            attachedMap.set(vol.$id, {
              podName: lv.pod?.pod_name || undefined,
              fileCount: lv.current_file_count ?? 0,
            });
            if (Math.abs(sizeGb - vol.current_size_gb) > 0.001) {
              await databases.updateDocument(databaseId, collections.volumes, vol.$id, {
                current_size_gb: sizeGb,
              });
              vol.current_size_gb = sizeGb;
            }
          })
        );
      } catch (err) {
        console.warn("[volumes:sync]", err);
      }
    }

    return NextResponse.json({
      retailPerGbMonthUsd,
      volumes: volumes.map((v) => ({
        ...v,
        attachedPodName: attachedMap.get(v.$id)?.podName || null,
        fileCount: attachedMap.get(v.$id)?.fileCount ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const body = createVolumeSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    if (ctx.profile.balance_micro_usd <= 0) {
      return NextResponse.json(
        {
          error:
            "You need a positive credit balance before creating persistent volumes. Top up on the Billing page.",
        },
        { status: 402 }
      );
    }

    const liumVol = await createLiumVolume({
      name: `${ctx.userId.slice(0, 8)}-${body.name}`,
      description: body.description || `VoltGPU volume for ${ctx.userId}`,
    });

    const saved = await databases.createDocument(
      databaseId,
      collections.volumes,
      ID.unique(),
      {
        user_id: ctx.userId,
        lium_volume_id: liumVol.id,
        name: body.name,
        description: body.description || null,
        current_size_gb: liumVol.current_size_gb ?? 0,
        total_billed_micro_usd: 0,
        status: "active",
        last_billed_date: null,
      }
    );

    return NextResponse.json({ volume: saved }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
