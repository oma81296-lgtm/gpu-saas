"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  Clock,
  Cpu,
  Download,
  Flame,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { formatMicroUsd } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

interface UsagePayload {
  window: { days: number; since: string; until: string };
  summary: {
    totalRetailMicroUsd: number;
    gpuHours: number;
    liumVerifiedGpuHours: number | null;
    totalRentals: number;
    faultCloses: number;
    activeBurnRateHrMicroUsd: number;
  };
  daily: Array<{
    date: string;
    retailMicroUsd: number;
    gpuHours: number;
    podsCount: number;
  }>;
  byGpuModel: Array<{
    gpuModel: string;
    rentals: number;
    gpuHours: number;
    retailMicroUsd: number;
  }>;
  pods: Array<{
    id: string;
    name: string;
    gpuModel: string;
    gpuCount: number;
    templateName: string;
    status: string;
    startedAt: string;
    stoppedAt: string | null;
    durationHours: number;
    gpuHours: number;
    retailRateHrMicroUsd: number;
    totalBilledMicroUsd: number;
    stopReason: string | null;
    gpuUtilPercent: number | null;
    billingPaused: boolean;
    nodeOffline: boolean;
  }>;
}

export default function UsagePage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsage = useCallback(
    async (windowDays: number) => {
      if (!user) return;
      setLoading(true);
      try {
        const res = await authFetch(`/api/usage?days=${windowDays}`);
        const json = (await res.json()) as UsagePayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load usage");
        setData(json);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load usage");
      } finally {
        setLoading(false);
      }
    },
    [user, authFetch]
  );

  useEffect(() => {
    if (!authLoading && user) void loadUsage(days);
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, days, loadUsage]);

  const maxDailySpend = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.daily.map((d) => d.retailMicroUsd));
  }, [data]);

  function exportCsv() {
    if (!data) return;
    const headers = [
      "Pod Name",
      "GPU Model",
      "GPU Count",
      "Status",
      "Started At",
      "Stopped At",
      "GPU Hours",
      "Retail Rate ($/hr)",
      "Total Billed ($)",
      "Stop Reason",
    ];
    const rows = data.pods.map((p) => [
      p.name,
      p.gpuModel,
      p.gpuCount,
      p.status,
      p.startedAt,
      p.stoppedAt || "",
      p.gpuHours,
      (p.retailRateHrMicroUsd / 1_000_000).toFixed(4),
      (p.totalBilledMicroUsd / 1_000_000).toFixed(4),
      p.stopReason || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voltgpu-usage-${data.window.since}-to-${data.window.until}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Pod Usage & Telemetry
              </h1>
              <Badge variant="emerald">
                <ShieldCheck className="h-3 w-3" />
                Synced with Lium
              </Badge>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              GPU-hours, per-pod billing history, daily spend, and live GPU utilization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    days === d
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={loading || !user}
              onClick={() => void loadUsage(days)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || data.pods.length === 0}
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {!authLoading && !user ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to view your GPU-hours and pod usage analytics.
            </p>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : loading || !data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-5 space-y-2">
                  <Skeleton className="h-3 w-28 bg-zinc-800/80" />
                  <Skeleton className="h-7 w-24 bg-zinc-800/80" />
                  <Skeleton className="h-3 w-32 bg-zinc-800/80" />
                </Card>
              ))}
            </div>
            <Card className="p-5 space-y-3">
              <Skeleton className="h-4 w-44 bg-zinc-800/80" />
              <Skeleton className="h-40 w-full bg-zinc-800/80" />
            </Card>
            <Card className="p-5 space-y-3">
              <Skeleton className="h-4 w-40 bg-zinc-800/80" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full bg-zinc-800/80" />
              ))}
            </Card>
          </div>
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">
                    Total Spend ({days}d)
                  </div>
                  <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
                    {formatMicroUsd(data.summary.totalRetailMicroUsd)}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {data.window.since} → {data.window.until}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </Card>

              <Card className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">
                    GPU-Hours ({days}d)
                  </div>
                  <div className="text-2xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
                    {data.summary.gpuHours.toFixed(2)}h
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {data.summary.liumVerifiedGpuHours !== null
                      ? "Verified via Lium telemetry"
                      : "Calculated from pod runtime"}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                  <Clock className="h-5 w-5" />
                </div>
              </Card>

              <Card className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">
                    Pod Rentals ({days}d)
                  </div>
                  <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
                    {data.summary.totalRentals}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {data.summary.faultCloses > 0 ? (
                      <span className="text-red-400">
                        {data.summary.faultCloses} provider fault close(s)
                      </span>
                    ) : (
                      "0 provider faults"
                    )}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                  <Cpu className="h-5 w-5" />
                </div>
              </Card>

              <Card className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-zinc-400">Active Burn Rate</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
                    {formatMicroUsd(data.summary.activeBurnRateHrMicroUsd)}
                    <span className="text-xs font-normal text-zinc-500">/hr</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Billed per second on running pods
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Flame className="h-5 w-5" />
                </div>
              </Card>
            </div>

            {/* Daily Chart + By GPU Model */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Daily Compute Spend ({days}d)
                  </h2>
                  <span className="text-xs text-zinc-500 font-mono">
                    Peak day: {formatMicroUsd(maxDailySpend > 1 ? maxDailySpend : 0)}
                  </span>
                </div>

                <div className="flex h-44 items-end gap-1 pt-4">
                  {data.daily.map((day) => {
                    const pct =
                      day.retailMicroUsd > 0
                        ? Math.max(6, Math.round((day.retailMicroUsd / maxDailySpend) * 100))
                        : 2;
                    return (
                      <div
                        key={day.date}
                        className="group relative flex-1 h-full flex items-end"
                      >
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full rounded-t-sm transition-colors ${
                            day.retailMicroUsd > 0
                              ? "bg-emerald-500/75 group-hover:bg-emerald-400"
                              : "bg-zinc-800/70"
                          }`}
                        />
                        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-200 shadow-lg">
                          <div className="font-mono font-semibold">{day.date}</div>
                          <div>
                            {formatMicroUsd(day.retailMicroUsd)} • {day.gpuHours} GPU-h
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{data.window.since}</span>
                  <span>{data.window.until}</span>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">
                  Breakdown by GPU Model
                </h2>
                {data.byGpuModel.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-8 text-center">
                    No GPU usage recorded in this window.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.byGpuModel.map((m) => (
                      <div
                        key={m.gpuModel}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">
                            {m.gpuModel}
                          </span>
                          <span className="font-mono text-emerald-400 font-medium">
                            {formatMicroUsd(m.retailMicroUsd)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>{m.rentals} rental(s)</span>
                          <span className="font-mono">{m.gpuHours.toFixed(2)} GPU-hrs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Per-Pod Usage Table */}
            <Card className="overflow-x-auto">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Per-Pod Usage History
                </h2>
                <span className="text-xs text-zinc-500">
                  {data.pods.length} pod(s)
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pod</th>
                    <th className="px-4 py-3 font-medium">GPU</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Live GPU Util</th>
                    <th className="px-4 py-3 font-medium text-right">GPU-Hours</th>
                    <th className="px-4 py-3 font-medium text-right">Rate/hr</th>
                    <th className="px-4 py-3 font-medium text-right">Total Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {data.pods.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No pod usage in the last {days} days.
                      </td>
                    </tr>
                  ) : (
                    data.pods.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{p.name}</div>
                          <div className="text-[11px] text-zinc-500">
                            {new Date(p.startedAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {p.gpuCount}x {p.gpuModel}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={
                                p.status === "running"
                                  ? "emerald"
                                  : p.status === "fault_closed" || p.status === "failed"
                                    ? "red"
                                    : "default"
                              }
                            >
                              {p.status}
                            </Badge>
                            {p.billingPaused && (
                              <Badge variant="amber">Billing Paused</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.gpuUtilPercent !== null ? (
                            <span className="inline-flex items-center gap-1 font-mono text-cyan-300">
                              <Activity className="h-3 w-3" />
                              {p.gpuUtilPercent}%
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-300">
                          {p.gpuHours.toFixed(2)}h
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-400">
                          {formatMicroUsd(p.retailRateHrMicroUsd)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-emerald-400">
                          {formatMicroUsd(p.totalBilledMicroUsd, 4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
