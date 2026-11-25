"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArchiveRestore,
  Clock,
  Copy,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Server,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import type { PodDoc } from "@/lib/appwrite/config";
import type { LiumBackupConfig, LiumResetGpuResponse } from "@/lib/lium/types";
import { formatMicroUsd } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Input, Label } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

function statusVariant(status: PodDoc["status"]) {
  if (status === "running") return "emerald";
  if (status === "starting") return "cyan";
  if (status === "fault_closed" || status === "failed") return "red";
  return "default";
}

export default function PodsPage() {
  const { user, loading: authLoading, authFetch, refreshProfile } = useAuth();
  const [pods, setPods] = useState<PodDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPodId, setBusyPodId] = useState<string | null>(null);
  const [gpuResetting, setGpuResetting] = useState<Record<string, string>>({});

  // Backup modal state
  const [backupPod, setBackupPod] = useState<PodDoc | null>(null);
  const [backupConfigs, setBackupConfigs] = useState<LiumBackupConfig[]>([]);
  const [backupName, setBackupName] = useState("");
  const [backupPath, setBackupPath] = useState("/root/checkpoints");
  const [frequencyHours, setFrequencyHours] = useState("6");
  const [retentionDays, setRetentionDays] = useState("7");
  const [backupSubmitting, setBackupSubmitting] = useState(false);

  const loadPods = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/pods");
      const data = (await res.json()) as { pods?: PodDoc[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load pods");
      setPods(data.pods || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pods");
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!authLoading && user) void loadPods();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadPods]);

  async function handleReboot(pod: PodDoc) {
    setBusyPodId(pod.$id);
    try {
      const res = await authFetch(`/api/pods/${pod.$id}/reboot`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Reboot failed");
      toast.success(`Rebooting ${pod.name}...`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reboot failed");
    } finally {
      setBusyPodId(null);
    }
  }

  async function handleResetGpu(pod: PodDoc) {
    setBusyPodId(pod.$id);
    try {
      const res = await authFetch(`/api/pods/${pod.$id}/reset-gpu`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        reset?: LiumResetGpuResponse;
        error?: string;
      };
      if (!res.ok || !data.reset) {
        throw new Error(data.error || "GPU reset failed");
      }
      const reqId = data.reset.request_id;
      setGpuResetting((prev) => ({ ...prev, [pod.$id]: "running" }));
      toast.info(`GPU reset started for ${pod.name} (takes 1–2 min)...`);

      // Poll every 5s up to 24 times (2 min)
      let attempts = 0;
      const timer = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await authFetch(
            `/api/pods/${pod.$id}/reset-gpu?requestId=${encodeURIComponent(reqId)}`
          );
          const pollData = (await pollRes.json()) as {
            reset?: LiumResetGpuResponse;
          };
          const st = pollData.reset?.status;
          if (st && st !== "running") {
            clearInterval(timer);
            setGpuResetting((prev) => {
              const next = { ...prev };
              delete next[pod.$id];
              return next;
            });
            if (st === "done") {
              toast.success(`GPU reset completed on ${pod.name}`);
            } else {
              toast.error(
                pollData.reset?.error?.message || `GPU reset ${st} on ${pod.name}`
              );
            }
          } else if (attempts >= 24) {
            clearInterval(timer);
          }
        } catch {
          clearInterval(timer);
        }
      }, 5000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "GPU reset failed");
    } finally {
      setBusyPodId(null);
    }
  }

  async function openBackupModal(pod: PodDoc) {
    setBackupPod(pod);
    setBackupName(`${pod.name}-${new Date().toISOString().slice(0, 10)}`);
    setBackupConfigs([]);
    try {
      const res = await authFetch(`/api/pods/${pod.$id}/backup`);
      if (res.ok) {
        const d = (await res.json()) as { configs?: LiumBackupConfig[] };
        setBackupConfigs(d.configs || []);
      }
    } catch {
      // ignore initial config fetch errors
    }
  }

  async function handleBackupNow() {
    if (!backupPod) return;
    setBackupSubmitting(true);
    try {
      const res = await authFetch(`/api/pods/${backupPod.$id}/backup`, {
        method: "POST",
        body: JSON.stringify({ action: "now", name: backupName || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Backup failed");
      toast.success(`Backup started for ${backupPod.name}! View progress in Storage → Backups.`);
      setBackupPod(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBackupSubmitting(false);
    }
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!backupPod) return;
    setBackupSubmitting(true);
    try {
      const res = await authFetch(`/api/pods/${backupPod.$id}/backup`, {
        method: "POST",
        body: JSON.stringify({
          action: "schedule",
          backupPath,
          frequencyHours: Number(frequencyHours),
          retentionDays: Number(retentionDays),
        }),
      });
      const data = (await res.json()) as {
        config?: LiumBackupConfig;
        error?: string;
      };
      if (!res.ok || !data.config) {
        throw new Error(data.error || "Failed to save schedule");
      }
      setBackupConfigs((prev) => [...prev, data.config!]);
      toast.success(`Backup schedule saved for ${backupPath}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setBackupSubmitting(false);
    }
  }

  async function handleDeleteSchedule(configId: string) {
    if (!backupPod) return;
    const res = await authFetch(
      `/api/pods/${backupPod.$id}/backup?configId=${encodeURIComponent(configId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setBackupConfigs((prev) => prev.filter((c) => c.id !== configId));
      toast.success("Backup schedule removed");
    }
  }

  async function handleTerminate(pod: PodDoc) {
    if (
      !window.confirm(
        `Terminate pod "${pod.name}"? Any unsaved data inside the container will be lost.`
      )
    ) {
      return;
    }
    setBusyPodId(pod.$id);
    try {
      const res = await authFetch(`/api/pods/${pod.$id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Terminate failed");
      toast.success(`Pod "${pod.name}" terminated and final usage settled.`);
      await Promise.all([loadPods(), refreshProfile()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terminate failed");
    } finally {
      setBusyPodId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              My Pods
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Manage running Secure-tier GPU containers, SSH access, and lifecycle controls.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadPods()}
              disabled={loading || !user}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Sync Status
            </Button>
            <Link href="/marketplace">
              <Button size="sm">Deploy GPU</Button>
            </Link>
          </div>
        </div>

        {!authLoading && !user ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to view and manage your GPU pods.
            </p>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-36 bg-zinc-800/80" />
                      <Skeleton className="h-5 w-16 rounded-md bg-zinc-800/80" />
                    </div>
                    <Skeleton className="h-3 w-64 bg-zinc-800/80" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800/80" />
                    <Skeleton className="h-8 w-24 rounded-lg bg-zinc-800/80" />
                    <Skeleton className="h-8 w-24 rounded-lg bg-zinc-800/80" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full rounded-lg bg-zinc-800/80" />
              </Card>
            ))}
          </div>
        ) : pods.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <Server className="h-8 w-8 text-zinc-600 mx-auto" />
            <h2 className="text-base font-medium text-white">No pods yet</h2>
            <p className="text-xs text-zinc-400">
              Browse the Secure-tier GPU marketplace to deploy your first pod.
            </p>
            <Link href="/marketplace">
              <Button size="sm">Browse Marketplace</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {pods.map((pod) => {
              const active =
                pod.status === "starting" || pod.status === "running";
              const busy = busyPodId === pod.$id;
              return (
                <Card key={pod.$id} className="p-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{pod.name}</h3>
                        <Badge variant={statusVariant(pod.status)}>
                          {pod.status}
                        </Badge>
                        {gpuResetting[pod.$id] && (
                          <Badge variant="amber">Resetting GPU...</Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {pod.gpu_count}x {pod.gpu_model} •{" "}
                        {pod.template_name || pod.custom_image || "Template"} •{" "}
                        <span className="font-mono text-zinc-300">
                          {formatMicroUsd(pod.retail_rate_hr_micro_usd)}/hr
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {pod.jupyter_url && active && (
                        <a
                          href={pod.jupyter_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button variant="secondary" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                            JupyterLab
                          </Button>
                        </a>
                      )}
                      {active && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void openBackupModal(pod)}
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            Backup
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleReboot(pod)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reboot
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || Boolean(gpuResetting[pod.$id])}
                            onClick={() => void handleResetGpu(pod)}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            Reset GPU
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleTerminate(pod)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Terminate
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {pod.ssh_command && active && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <code className="text-xs text-emerald-300 font-mono truncate">
                        {pod.ssh_command}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(pod.ssh_command || "");
                          toast.success("SSH command copied!");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy SSH
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/70">
                    <span>
                      Started: {new Date(pod.started_at).toLocaleString()}
                      {pod.stopped_at
                        ? ` • Stopped: ${new Date(pod.stopped_at).toLocaleString()}`
                        : ""}
                    </span>
                    <span className="font-mono text-zinc-300">
                      Billed so far: {formatMicroUsd(pod.total_billed_micro_usd, 4)}
                      {pod.stop_reason ? ` (${pod.stop_reason})` : ""}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pod Backup & Schedule Modal */}
      {backupPod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6 space-y-5 bg-zinc-950 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <ArchiveRestore className="h-4 w-4 text-emerald-400" />
                  Backups — {backupPod.name}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Snapshot <code>/root</code> (or a subfolder) to S3 storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBackupPod(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Instant Manual Backup */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
              <div className="text-xs font-semibold text-white">
                Instant Snapshot
              </div>
              <div className="flex gap-2">
                <Input
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder="checkpoint-before-eval"
                />
                <Button
                  size="sm"
                  disabled={backupSubmitting}
                  onClick={() => void handleBackupNow()}
                >
                  Back Up Now
                </Button>
              </div>
            </div>

            {/* Scheduled Backup Form */}
            <form
              onSubmit={handleSaveSchedule}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3"
            >
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                Automated Backup Schedule
              </div>
              <div className="space-y-1">
                <Label>Backup Path (must be /root or inside /root)</Label>
                <Input
                  required
                  value={backupPath}
                  onChange={(e) => setBackupPath(e.target.value)}
                  placeholder="/root/checkpoints"
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Frequency (1–168 hrs)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    required
                    value={frequencyHours}
                    onChange={(e) => setFrequencyHours(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Retention (1–365 days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={backupSubmitting}
              >
                Save Schedule
              </Button>
            </form>

            {/* Active Schedules */}
            {backupConfigs.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-400">
                  Active Schedules
                </div>
                {backupConfigs.map((cfg) => (
                  <div
                    key={cfg.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-mono text-white">{cfg.backup_path}</span>
                      <span className="ml-2 text-zinc-400">
                        every {cfg.backup_frequency_hours}h • keep {cfg.retention_days}d
                      </span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDeleteSchedule(cfg.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
