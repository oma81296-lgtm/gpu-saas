import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

const createSshKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
  publicKey: z
    .string()
    .trim()
    .min(20)
    .max(4096)
    .refine(
      (val) =>
        /^(ssh-(ed25519|rsa|dss)|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com)\s+[A-Za-z0-9+/=]+/.test(
          val
        ),
      "Must be a valid OpenSSH public key (e.g. ssh-ed25519 AAAA...)"
    ),
});

function computeFingerprint(publicKey: string): string {
  const parts = publicKey.trim().split(/\s+/);
  const keyBody = parts[1] || publicKey;
  const hash = crypto
    .createHash("sha256")
    .update(Buffer.from(keyBody, "base64"))
    .digest("base64")
    .replace(/=+$/, "");
  return `SHA256:${hash}`;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sshKeys,
      [Query.equal("user_id", ctx.userId), Query.orderDesc("$createdAt"), Query.limit(50)]
    );
    return NextResponse.json({ keys: res.documents });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const body = createSshKeySchema.parse(await req.json());
    const { databases } = createAdminAppwrite();

    const doc = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.sshKeys,
      ID.unique(),
      {
        user_id: ctx.userId,
        name: body.name,
        public_key: body.publicKey,
        fingerprint: computeFingerprint(body.publicKey),
      }
    );

    return NextResponse.json({ key: doc }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
