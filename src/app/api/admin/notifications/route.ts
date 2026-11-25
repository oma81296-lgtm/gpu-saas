import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAdmin } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

const createNotificationSchema = z.object({
  title: z.string().trim().min(2).max(128),
  message: z.string().trim().min(2).max(512),
  severity: z.enum(["info", "success", "warning", "critical"]).default("info"),
  targetUserId: z.string().trim().nullable().optional(),
  actionLabel: z.string().trim().max(64).nullable().optional(),
  actionUrl: z.string().trim().max(255).nullable().optional(),
  dismissible: z.boolean().default(true),
  expiresInHours: z.number().min(1).max(720).nullable().optional(),
});

const patchNotificationSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.notifications,
      [Query.orderDesc("$createdAt"), Query.limit(100)]
    );
    return NextResponse.json({ notifications: res.documents });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = createNotificationSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();

    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 3_600_000).toISOString()
      : null;

    const doc = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.notifications,
      ID.unique(),
      {
        title: body.title,
        message: body.message,
        severity: body.severity,
        target_user_id: body.targetUserId || null,
        action_label: body.actionLabel || null,
        action_url: body.actionUrl || null,
        active: true,
        dismissible: body.dismissible,
        expires_at: expiresAt,
        created_by: admin.email,
      }
    );

    return NextResponse.json({ notification: doc }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = patchNotificationSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();
    const doc = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.notifications,
      body.id,
      { active: body.active }
    );
    return NextResponse.json({ notification: doc });
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
      APPWRITE_CONFIG.collections.notifications,
      id
    );
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
