"use client";

import { Account, Client } from "appwrite";
import { APPWRITE_CONFIG } from "./config";

let browserClient: Client | null = null;

export function getBrowserAppwriteClient(): Client {
  if (!browserClient) {
    browserClient = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);
  }
  return browserClient;
}

export function getBrowserAccount(): Account {
  return new Account(getBrowserAppwriteClient());
}

export function isAppwriteClientConfigured(): boolean {
  return Boolean(
    APPWRITE_CONFIG.projectId &&
      APPWRITE_CONFIG.projectId !== "your_appwrite_project_id"
  );
}

/**
 * Generates a short-lived Appwrite JWT for authenticating requests to our
 * Next.js server API routes (/api/*).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const account = getBrowserAccount();
  const { jwt } = await account.createJWT();
  return {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
}

export {
  startOAuthFlow as startOAuthLogin,
  type OAuthProviderId,
  type StartOAuthOptions,
} from "./oauth";
