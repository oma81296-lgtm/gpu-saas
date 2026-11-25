import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAdmin } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { usdToMicroUsd } from "@/lib/brand";
import { applyLedgerTransaction } from "@/lib/ledger";

const adjustCreditSchema = z.object({
  userId: z.string().min(1),
  amountUsd: z.number().refine((v) => v !== 0, "Amount must be non-zero"),
  note: z.string().trim().min(2).max(256),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userProfiles,
      [Query.orderDesc("$createdAt"), Query.limit(100)]
    );
    return NextResponse.json({ users: res.documents });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = adjustCreditSchema.parse(await req.json());

    const result = await applyLedgerTransaction({
      userId: body.userId,
      type: "admin_adjustment",
      amountMicroUsd: usdToMicroUsd(body.amountUsd),
      note: `[Admin ${admin.email}] ${body.note}`,
    });

    return NextResponse.json({
      ok: true,
      balanceMicroUsd: result.balanceMicroUsd,
      entry: result.entry,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
