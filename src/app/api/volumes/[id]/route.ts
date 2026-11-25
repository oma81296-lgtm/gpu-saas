import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_CONFIG, VolumeDoc } from "@/lib/appwrite/config";
import { AuthError, createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { deleteLiumVolume, LiumApiError } from "@/lib/lium/client";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(req);
    const { id } = await context.params;
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    const vol = (await databases.getDocument(
      databaseId,
      collections.volumes,
      id
    )) as unknown as VolumeDoc;

    if (vol.user_id !== ctx.userId && ctx.profile.role !== "admin") {
      throw new AuthError("Forbidden", 403);
    }

    try {
      await deleteLiumVolume(vol.lium_volume_id);
    } catch (err) {
      if (!(err instanceof LiumApiError && err.status === 404)) {
        throw err;
      }
    }

    await databases.updateDocument(databaseId, collections.volumes, vol.$id, {
      status: "deleted",
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
