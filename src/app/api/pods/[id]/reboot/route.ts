import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_CONFIG, PodDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { rebootLiumPod } from "@/lib/lium/client";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);
    const { id } = await context.params;
    const { databases } = createAdminAppwrite();

    const pod = (await databases.getDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.pods,
      id
    )) as unknown as PodDoc;

    if (pod.user_id !== ctx.userId && ctx.profile.role !== "admin") {
      throw new AuthError("Forbidden", 403);
    }

    const result = await rebootLiumPod(pod.lium_pod_id);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return handleApiError(err);
  }
}
