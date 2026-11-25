import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_CONFIG, PodDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { getResetGpuStatus, resetLiumPodGpu } from "@/lib/lium/client";

async function loadOwnedPod(req: NextRequest, id: string) {
  const ctx = await requireAuth(req);
  const { databases } = createAdminAppwrite();
  const pod = (await databases.getDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.pods,
    id
  )) as unknown as PodDoc;

  if (pod.user_id !== ctx.userId && ctx.profile.role !== "admin") {
    throw new AuthError("Forbidden", 403);
  }
  return pod;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const pod = await loadOwnedPod(req, id);
    let gpuIndices: number[] | null = null;
    try {
      const body = (await req.json()) as { gpuIndices?: number[] };
      if (Array.isArray(body.gpuIndices)) gpuIndices = body.gpuIndices;
    } catch {
      // empty body resets all GPUs
    }

    const reset = await resetLiumPodGpu(pod.lium_pod_id, gpuIndices);
    return NextResponse.json({ reset }, { status: 202 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const requestId = req.nextUrl.searchParams.get("requestId");
    if (!requestId) {
      return NextResponse.json(
        { error: "Missing requestId query parameter" },
        { status: 400 }
      );
    }
    const pod = await loadOwnedPod(req, id);
    const reset = await getResetGpuStatus(pod.lium_pod_id, requestId);
    return NextResponse.json({ reset });
  } catch (err) {
    return handleApiError(err);
  }
}
