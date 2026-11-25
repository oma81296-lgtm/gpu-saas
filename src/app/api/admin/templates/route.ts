import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAdmin } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

const createTemplateSchema = z.object({
  slug: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(128),
  category: z.enum(["base", "ai_app", "notebook"]),
  description: z.string().trim().min(2).max(512),
  liumTemplateId: z.string().trim().min(1).max(128),
  dockerImage: z.string().trim().optional(),
  defaultPorts: z.string().trim().optional(),
  minVramGb: z.number().int().min(0).default(0),
  sortOrder: z.number().int().default(10),
  enabled: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.curatedTemplates,
      [Query.orderAsc("sort_order"), Query.limit(100)]
    );
    return NextResponse.json({ templates: res.documents });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = createTemplateSchema.parse(await req.json());
    const { databases } = createAdminAppwrite();
    const doc = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.curatedTemplates,
      ID.unique(),
      {
        slug: body.slug,
        name: body.name,
        category: body.category,
        description: body.description,
        lium_template_id: body.liumTemplateId,
        docker_image: body.dockerImage || null,
        default_ports: body.defaultPorts || "22",
        min_vram_gb: body.minVramGb,
        sort_order: body.sortOrder,
        enabled: body.enabled,
      }
    );
    return NextResponse.json({ template: doc }, { status: 201 });
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
      APPWRITE_CONFIG.collections.curatedTemplates,
      id
    );
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
