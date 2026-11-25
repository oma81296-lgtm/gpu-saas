import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { APPWRITE_CONFIG, PodDoc } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const { databases, users } = createAdminAppwrite();

    const [activePodsRes, appwriteUser, identitiesRes, mfaFactors] =
      await Promise.all([
        databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.pods,
          [
            Query.equal("user_id", ctx.userId),
            Query.equal("status", ["starting", "running"]),
            Query.limit(50),
          ]
        ),
        users.get(ctx.userId).catch(() => null),
        users
          .listIdentities([Query.equal("userId", ctx.userId), Query.limit(20)])
          .catch(() => ({ identities: [] })),
        users.listMfaFactors(ctx.userId).catch(() => null),
      ]);

    const activePods = activePodsRes.documents as unknown as PodDoc[];
    const burnRateHrMicroUsd = activePods.reduce(
      (sum, p) => sum + p.retail_rate_hr_micro_usd,
      0
    );

    const identities = (identitiesRes.identities || []).map((ident) => ({
      id: ident.$id,
      provider: ident.provider,
      providerEmail: ident.providerEmail || "",
      createdAt: ident.$createdAt,
    }));

    const hasPassword = Boolean(
      appwriteUser &&
        ((appwriteUser.password && appwriteUser.password.length > 0) ||
          (appwriteUser.passwordUpdate &&
            appwriteUser.passwordUpdate.length > 0))
    );

    return NextResponse.json({
      user: {
        userId: ctx.userId,
        email: ctx.email,
        name: ctx.name,
        role: ctx.profile.role,
        balanceMicroUsd: ctx.profile.balance_micro_usd,
        maxConcurrentPods: ctx.profile.max_concurrent_pods,
        activePodCount: activePods.length,
        burnRateHrMicroUsd,
        auth: {
          hasPassword,
          emailVerified: Boolean(appwriteUser?.emailVerification),
          mfaEnabled: Boolean(appwriteUser?.mfa),
          totpEnabled: Boolean(mfaFactors?.totp),
          recoveryCodeEnabled: Boolean(mfaFactors?.recoveryCode),
          identities,
        },
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
