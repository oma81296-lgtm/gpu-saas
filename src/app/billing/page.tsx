"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, CreditCard, Wallet } from "lucide-react";
import type { CreditLedgerDoc } from "@/lib/appwrite/config";
import { CREDIT_PACKS, formatMicroUsd } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function BillingPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [balanceMicro, setBalanceMicro] = useState(0);
  const [ledger, setLedger] = useState<CreditLedgerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/billing");
      const data = (await res.json()) as {
        balanceMicroUsd?: number;
        ledger?: CreditLedgerDoc[];
      };
      setBalanceMicro(data.balanceMicroUsd ?? user.balanceMicroUsd);
      setLedger(data.ledger || []);
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!authLoading && user) void loadBilling();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadBilling]);

  async function handleCheckout(packId: string) {
    setCheckingOut(packId);
    try {
      const res = await authFetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packId }),
      });
      const data = (await res.json()) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Failed to start checkout");
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setCheckingOut(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Billing & Credits
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Prepaid GPU wallet metered per second. Powered by Creem Merchant of Record.
          </p>
        </div>

        {!authLoading && !user ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to view your wallet balance and purchase credit packs.
            </p>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : (
          <>
            {/* Wallet Summary */}
            <Card className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-400">
                    Available Balance
                  </div>
                  {authLoading || loading ? (
                    <Skeleton className="h-9 w-32 mt-1 bg-zinc-800/80" />
                  ) : (
                    <div className="text-3xl font-mono font-bold text-white tabular-nums">
                      {formatMicroUsd(balanceMicro)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-zinc-400 space-y-1 sm:text-right">
                <div>Launch buffer: ≥30 minutes of retail runtime</div>
                <div>Auto-warning: &lt;15 min left • Auto-stop: $0.00</div>
              </div>
            </Card>

            {/* Credit Packs */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                Top Up Prepaid Credits
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {CREDIT_PACKS.map((pack) => (
                  <Card
                    key={pack.id}
                    className={`p-5 flex flex-col justify-between ${
                      "popular" in pack && pack.popular
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : ""
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          {pack.label}
                        </span>
                        {"popular" in pack && pack.popular && (
                          <Badge variant="emerald">Popular</Badge>
                        )}
                      </div>
                      <div className="text-2xl font-mono font-bold text-emerald-400">
                        ${pack.usd}
                      </div>
                      <p className="text-xs text-zinc-400">{pack.description}</p>
                    </div>
                    <Button
                      className="w-full mt-4"
                      size="sm"
                      disabled={checkingOut !== null}
                      onClick={() => void handleCheckout(pack.id)}
                    >
                      {checkingOut === pack.id ? "Redirecting..." : "Buy Credits"}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </Card>
                ))}
              </div>
            </section>

            {/* Ledger History */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-white">
                Credit Ledger
              </h2>
              <Card className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Note</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3">
                            <Skeleton className="h-3.5 w-28 bg-zinc-800/80" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-5 w-16 rounded-md bg-zinc-800/80" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-3.5 w-48 bg-zinc-800/80" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-3.5 w-16 ml-auto bg-zinc-800/80" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-3.5 w-16 ml-auto bg-zinc-800/80" />
                          </td>
                        </tr>
                      ))
                    ) : ledger.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                          No credit transactions yet.
                        </td>
                      </tr>
                    ) : (
                      ledger.map((row) => (
                        <tr key={row.$id} className="hover:bg-zinc-900/50">
                          <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                            {new Date(row.$createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                row.type === "topup"
                                  ? "emerald"
                                  : row.type === "pod_usage"
                                    ? "default"
                                    : "cyan"
                              }
                            >
                              {row.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {row.note || "—"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-medium ${
                              row.amount_micro_usd >= 0
                                ? "text-emerald-400"
                                : "text-zinc-300"
                            }`}
                          >
                            {row.amount_micro_usd >= 0 ? "+" : ""}
                            {formatMicroUsd(row.amount_micro_usd, 4)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zinc-400">
                            {formatMicroUsd(row.balance_after_micro_usd, 4)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
