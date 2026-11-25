import { Account, Client, Databases, ID, Query, Users } from "node-appwrite";
import { NextRequest } from "next/server";
import { hashApiKey, isApiKeyToken } from "@/lib/api-keys";
import { APPWRITE_CONFIG, ApiKeyDoc, UserProfileDoc } from "./config";

export function isAppwriteServerConfigured(): boolean {
  return Boolean(
    APPWRITE_CONFIG.projectId &&
      APPWRITE_CONFIG.projectId !== "your_appwrite_project_id" &&
      process.env.APPWRITE_API_KEY &&
      process.env.APPWRITE_API_KEY !== "your_appwrite_server_api_key"
  );
}

export function createAdminAppwrite() {
  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId)
    .setKey(process.env.APPWRITE_API_KEY || "");

  return {
    client,
    databases: new Databases(client),
    users: new Users(client),
  };
}

export function createJwtAppwrite(jwt: string) {
  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId)
    .setJWT(jwt);

  return {
    client,
    account: new Account(client),
  };
}

export interface AuthenticatedContext {
  userId: string;
  email: string;
  name: string;
  profile: UserProfileDoc;
  authMethod: "jwt" | "api_key";
  apiKey?: ApiKeyDoc;
}

function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || "";
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Authenticates a Personal API Key (prefixed with `vgpu_live_`).
 */
export async function authenticateApiKeyToken(
  token: string
): Promise<AuthenticatedContext> {
  if (!isAppwriteServerConfigured()) {
    throw new AuthError(
      "Appwrite is not configured yet. Add NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY to .env.local.",
      503
    );
  }

  const keyHash = hashApiKey(token);
  const { databases } = createAdminAppwrite();
  const res = await databases.listDocuments(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.apiKeys,
    [Query.equal("key_hash", keyHash), Query.limit(1)]
  );

  if (res.documents.length === 0) {
    throw new AuthError("Invalid API key", 401);
  }

  const apiKey = res.documents[0] as unknown as ApiKeyDoc;
  if (apiKey.revoked) {
    throw new AuthError("API key has been revoked", 401);
  }
  if (apiKey.expires_at && new Date(apiKey.expires_at).getTime() <= Date.now()) {
    throw new AuthError("API key has expired", 401);
  }

  const profileRes = await databases.listDocuments(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.userProfiles,
    [Query.equal("user_id", apiKey.user_id), Query.limit(1)]
  );

  if (profileRes.documents.length === 0) {
    throw new AuthError("User profile not found for API key", 401);
  }

  const profile = profileRes.documents[0] as unknown as UserProfileDoc;

  // Fire-and-forget last_used_at update (throttled to avoid excessive writes)
  const lastUsedMs = apiKey.last_used_at ? new Date(apiKey.last_used_at).getTime() : 0;
  if (Date.now() - lastUsedMs > 60_000) {
    void databases
      .updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.apiKeys,
        apiKey.$id,
        { last_used_at: new Date().toISOString() }
      )
      .catch(() => {});
  }

  return {
    userId: apiKey.user_id,
    email: profile.email || "",
    name: profile.name || "",
    profile,
    authMethod: "api_key",
    apiKey,
  };
}

/**
 * Verifies either a Personal API Key (`vgpu_live_...`) or an Appwrite JWT
 * from the Authorization Bearer header and returns the authenticated user context.
 */
export async function requireAuth(
  req: NextRequest
): Promise<AuthenticatedContext> {
  if (!isAppwriteServerConfigured()) {
    throw new AuthError(
      "Appwrite is not configured yet. Add NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY to .env.local.",
      503
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    throw new AuthError("Missing Authorization Bearer token", 401);
  }

  if (isApiKeyToken(token)) {
    return authenticateApiKeyToken(token);
  }

  let accountUser: { $id: string; email: string; name: string };
  try {
    const { account } = createJwtAppwrite(token);
    accountUser = await account.get();
  } catch {
    throw new AuthError("Invalid or expired session token", 401);
  }

  const profile = await ensureUserProfile(
    accountUser.$id,
    accountUser.email,
    accountUser.name
  );

  return {
    userId: accountUser.$id,
    email: accountUser.email,
    name: accountUser.name,
    profile,
    authMethod: "jwt",
  };
}

export async function requireSessionAuth(
  req: NextRequest
): Promise<AuthenticatedContext> {
  const ctx = await requireAuth(req);
  if (ctx.authMethod !== "jwt") {
    throw new AuthError(
      "Interactive session authentication is required for this endpoint",
      403
    );
  }
  return ctx;
}

export async function requireAdmin(
  req: NextRequest
): Promise<AuthenticatedContext> {
  const ctx = await requireSessionAuth(req);
  if (ctx.profile.role !== "admin") {
    throw new AuthError("Admin privileges required", 403);
  }
  return ctx;
}

export async function ensureUserProfile(
  userId: string,
  email: string,
  name: string
): Promise<UserProfileDoc> {
  const { databases } = createAdminAppwrite();
  const normalizedEmail = (email || "").trim();
  const normalizedName =
    (name || "").trim() ||
    (normalizedEmail.includes("@") ? normalizedEmail.split("@")[0] : "");

  const res = await databases.listDocuments(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.userProfiles,
    [Query.equal("user_id", userId), Query.limit(1)]
  );

  if (res.documents.length > 0) {
    const existing = res.documents[0] as unknown as UserProfileDoc;
    // Backfill email or name if an OAuth login supplies previously missing profile fields
    const patch: Partial<Pick<UserProfileDoc, "email" | "name">> = {};
    if (!existing.email && normalizedEmail) patch.email = normalizedEmail;
    if (!existing.name && normalizedName) patch.name = normalizedName;
    if (Object.keys(patch).length > 0) {
      const updated = await databases
        .updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.userProfiles,
          existing.$id,
          patch
        )
        .catch(() => existing);
      return updated as unknown as UserProfileDoc;
    }
    return existing;
  }

  const role = isAdminEmail(normalizedEmail) ? "admin" : "user";
  try {
    const created = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userProfiles,
      ID.unique(),
      {
        user_id: userId,
        email: normalizedEmail,
        name: normalizedName,
        role,
        balance_micro_usd: 0,
        max_concurrent_pods: 2,
        low_balance_warned_at: null,
      }
    );
    return created as unknown as UserProfileDoc;
  } catch (err) {
    // Handle concurrent first-login race conditions cleanly
    const retry = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.userProfiles,
      [Query.equal("user_id", userId), Query.limit(1)]
    );
    if (retry.documents.length > 0) {
      return retry.documents[0] as unknown as UserProfileDoc;
    }
    throw err;
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
