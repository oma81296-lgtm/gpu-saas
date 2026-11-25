import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { CREDIT_PACKS } from "@/lib/brand";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const { databases } = createAdminAppwrite();

    const ledgerRes = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.creditLedger,
      [
        Query.equal("user_id", ctx.userId),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]
    );

    return NextResponse.json({
      balanceMicroUsd: ctx.profile.balance_micro_usd,
      packs: CREDIT_PACKS,
      ledger: ledgerRes.documents,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
