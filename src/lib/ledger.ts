import { ID, Query } from "node-appwrite";
import { APPWRITE_CONFIG, CreditLedgerDoc, UserProfileDoc } from "./appwrite/config";
import { createAdminAppwrite } from "./appwrite/server";

export interface LedgerEntryInput {
  userId: string;
  type: CreditLedgerDoc["type"];
  amountMicroUsd: number; // positive for credit, negative for debit
  referenceId?: string;
  podId?: string;
  note?: string;
}

/**
 * Records an immutable ledger entry and updates the user's cached balance.
 * If `referenceId` already exists, returns `{ duplicate: true }` without
 * modifying the balance (idempotent for Creem webhooks & 1-min metering).
 */
export async function applyLedgerTransaction(input: LedgerEntryInput): Promise<{
  duplicate: boolean;
  balanceMicroUsd: number;
  entry?: CreditLedgerDoc;
}> {
  const { databases } = createAdminAppwrite();
  const { databaseId, collections } = APPWRITE_CONFIG;

  if (input.referenceId) {
    const existing = await databases.listDocuments(
      databaseId,
      collections.creditLedger,
      [Query.equal("reference_id", input.referenceId), Query.limit(1)]
    );
    if (existing.documents.length > 0) {
      const doc = existing.documents[0] as unknown as CreditLedgerDoc;
      return {
        duplicate: true,
        balanceMicroUsd: doc.balance_after_micro_usd,
        entry: doc,
      };
    }
  }

  const profileRes = await databases.listDocuments(
    databaseId,
    collections.userProfiles,
    [Query.equal("user_id", input.userId), Query.limit(1)]
  );

  if (profileRes.documents.length === 0) {
    throw new Error(`User profile not found for user_id=${input.userId}`);
  }

  const profile = profileRes.documents[0] as unknown as UserProfileDoc;
  const newBalance = profile.balance_micro_usd + Math.trunc(input.amountMicroUsd);

  const entry = (await databases.createDocument(
    databaseId,
    collections.creditLedger,
    ID.unique(),
    {
      user_id: input.userId,
      type: input.type,
      amount_micro_usd: Math.trunc(input.amountMicroUsd),
      balance_after_micro_usd: newBalance,
      reference_id: input.referenceId || null,
      pod_id: input.podId || null,
      note: input.note || null,
    }
  )) as unknown as CreditLedgerDoc;

  await databases.updateDocument(
    databaseId,
    collections.userProfiles,
    profile.$id,
    {
      balance_micro_usd: newBalance,
      ...(input.amountMicroUsd > 0 ? { low_balance_warned_at: null } : {}),
    }
  );

  return { duplicate: false, balanceMicroUsd: newBalance, entry };
}
