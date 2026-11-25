import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { APPWRITE_CONFIG, NotificationDoc } from "@/lib/appwrite/config";
import {
  createAdminAppwrite,
  createJwtAppwrite,
  isAppwriteServerConfigured,
} from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    if (!isAppwriteServerConfigured()) {
      return NextResponse.json({ notifications: [] });
    }

    // Optionally resolve signed-in userId so targeted notifications are included
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const { account } = createJwtAppwrite(authHeader.slice(7).trim());
        const acct = await account.get();
        userId = acct.$id;
      } catch {
        userId = null;
      }
    }

    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.notifications,
      [
        Query.equal("active", true),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]
    );

    const nowMs = Date.now();
    const all = res.documents as unknown as NotificationDoc[];
    const visible = all.filter((n) => {
      if (n.expires_at && new Date(n.expires_at).getTime() <= nowMs) {
        return false;
      }
      if (!n.target_user_id) return true; // broadcast
      return userId !== null && n.target_user_id === userId;
    });

    return NextResponse.json({ notifications: visible });
  } catch (err) {
    return handleApiError(err);
  }
}
