"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Copy,
  Cpu,
  CreditCard,
  ExternalLink,
  HardDrive,
  KeyRound,
  Rocket,
  Server,
  Wallet,
} from "lucide-react";
import type { CuratedTemplateDoc, PodDoc, VolumeDoc } from "@/lib/appwrite/config";
import type { MarketplaceGpuNode } from "@/lib/lium/types";
import { BRAND, formatMicroUsd, formatUsd } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { DeployDrawer } from "@/components/deploy-drawer";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConsolePage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [pods, setPods] = useState<PodDoc[]>([]);
  const [volumes, setVolumes] = useState<VolumeDoc[]>([]);
  const [featuredGpus, setFeaturedGpus] = useState<MarketplaceGpuNode[]>([]);
  const [templates, setTemplates] = useState<CuratedTemplateDoc[]>([]);
  const [selectedNode, setSelectedNode] = useState<MarketplaceGpuNode | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const loadConsole = useCallback(async () => {
    setLoading(true);
    try {
      const [gpuRes, tplRes] = await Promise.all([
        fetch("/api/gpus"),
        fetch("/api/templates"),
      ]);
      if (gpuRes.ok) {
        const gData = (await gpuRes.json()) as { nodes?: MarketplaceGpuNode[] };
        setFeaturedGpus((gData.nodes || []).slice(0, 4));
      }
      if (tplRes.ok) {
        const tData = (await tplRes.json()) as {
          templates?: CuratedTemplateDoc[];
        };
        setTemplates(tData.templates || []);
      }

      if (user) {
        const [podsRes, volRes] = await Promise.all([
          authFetch("/api/pods"),
          authFetch("/api/volumes"),
        ]);
        if (podsRes.ok) {
          const pData = (await podsRes.json()) as { pods?: PodDoc[] };
          setPods(pData.pods || []);
        }
        if (volRes.ok) {
          const vData = (await volRes.json()) as { volumes?: VolumeDoc[] };
          setVolumes(vData.volumes || []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!authLoading) void loadConsole();
  }, [authLoading, loadConsole]);

  const activePods = pods.filter(
    (p) => p.status === "starting" || p.status === "running"
  );
  const runwayHours =
    user && user.burnRateHrMicroUsd > 0
      ? user.balanceMicroUsd / user.burnRateHrMicroUsd
      : null;

  return (
    <AppShell>
      <div className="w-full space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {user ? `Welcome back, ${user.name || user.email}` : `${BRAND.name} Console`}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Monitor your Secure-tier GPU pods, persistent volumes, and prepaid credit runway.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/billing">
              <Button variant="secondary" size="sm">
                <CreditCard className="h-3.5 w-3.5" />
                Top Up Credits
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button size="sm">
                <Rocket className="h-3.5 w-3.5" />
                Deploy GPU
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        {authLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5 flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-24 bg-zinc-800/80" />
                  <Skeleton className="h-7 w-28 bg-zinc-800/80" />
                  <Skeleton className="h-3 w-20 bg-zinc-800/80" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg bg-zinc-800/80" />
              </Card>
            ))}
          </div>
        ) : !user ? (
          <Card className="p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Sign in to access your {BRAND.name} workspace
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Launch Secure-tier NVIDIA GPUs, attach persistent volumes, and manage SSH keys.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/login">
                <Button variant="secondary" size="sm">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Create Account</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400">Wallet Balance</div>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
                  {user ? formatMicroUsd(user.balanceMicroUsd) : "—"}
                </div>
                <Link
                  href="/billing"
                  className="text-[11px] text-zinc-400 hover:text-emerald-400 mt-1 inline-block"
                >
                  Add credits →
                </Link>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
            </Card>

            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400">Active Pods</div>
                <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
                  {activePods.length}
                  <span className="text-sm font-normal text-zinc-500">
                    {" "}
                    / {user?.maxConcurrentPods ?? 2}
                  </span>
                </div>
                <Link
                  href="/pods"
                  className="text-[11px] text-zinc-400 hover:text-emerald-400 mt-1 inline-block"
                >
                  Manage pods →
                </Link>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                <Server className="h-5 w-5" />
              </div>
            </Card>

            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400">Burn Rate & Runway</div>
                <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
                  {user ? formatMicroUsd(user.burnRateHrMicroUsd) : "$0.00"}
                  <span className="text-xs font-normal text-zinc-500">/hr</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  {runwayHours !== null
                    ? `~${runwayHours.toFixed(1)} hours remaining`
                    : "No active hourly spend"}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                <Activity className="h-5 w-5" />
              </div>
            </Card>

            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400">Persistent Volumes</div>
                <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
                  {volumes.length}
                </div>
                <Link
                  href="/volumes"
                  className="text-[11px] text-zinc-400 hover:text-emerald-400 mt-1 inline-block"
                >
                  {volumes
                    .reduce((s, v) => s + v.current_size_gb, 0)
                    .toFixed(2)}{" "}
                  GB stored →
                </Link>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <HardDrive className="h-5 w-5" />
              </div>
            </Card>
          </div>
        )}

        {/* Active Pods Section */}
        {user && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Running Pods</h2>
              <Link
                href="/pods"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-2">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40 bg-zinc-800/80" />
                      <Skeleton className="h-3 w-56 bg-zinc-800/80" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg bg-zinc-800/80" />
                  </div>
                ))}
              </div>
            ) : activePods.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center space-y-2">
                <p className="text-xs text-zinc-400">
                  No running GPU pods right now. Deploy a Secure-tier GPU in seconds.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <Link href="/ssh-keys">
                    <Button variant="outline" size="sm">
                      <KeyRound className="h-3.5 w-3.5" />
                      SSH Keys
                    </Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button size="sm">
                      <Cpu className="h-3.5 w-3.5" />
                      Browse GPUs
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {activePods.map((pod) => (
                  <div
                    key={pod.$id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-white">
                          {pod.name}
                        </span>
                        <Badge variant="emerald">{pod.status}</Badge>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {pod.gpu_count}x {pod.gpu_model} •{" "}
                        {formatMicroUsd(pod.retail_rate_hr_micro_usd)}/hr
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pod.ssh_command && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              pod.ssh_command || ""
                            );
                            toast.success("SSH command copied!");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy SSH
                        </Button>
                      )}
                      {pod.jupyter_url && (
                        <a
                          href={pod.jupyter_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Jupyter
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Featured Live GPUs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Quick-Deploy Secure GPUs
            </h2>
            <Link
              href="/marketplace"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              Open Marketplace <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading && featuredGpus.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28 bg-zinc-800/80" />
                        <Skeleton className="h-3 w-36 bg-zinc-800/80" />
                      </div>
                      <Skeleton className="h-5 w-14 bg-zinc-800/80" />
                    </div>
                    <Skeleton className="h-8 w-full rounded-lg bg-zinc-800/80" />
                  </Card>
                ))
              : featuredGpus.map((node) => (
              <Card
                key={node.id}
                className="p-4 flex flex-col justify-between gap-3 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-white">
                      {node.availableGpuCount}x {node.gpuModel}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {node.vramPerGpuGb} GB VRAM • {node.country}
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm font-bold text-emerald-400">
                    {formatUsd(node.retailPricePerGpuHr)}
                    <div className="text-[10px] font-sans font-normal text-zinc-500">
                      /GPU/hr
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedNode(node)}
                >
                  Deploy
                </Button>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <DeployDrawer
        node={selectedNode}
        templates={templates}
        onClose={() => setSelectedNode(null)}
      />
    </AppShell>
  );
}
