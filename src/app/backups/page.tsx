"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArchiveRestore,
  FolderArchive,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { BackupDoc, PodDoc } from "@/lib/appwrite/config";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status: BackupDoc["status"]) {
  if (status === "completed") return "emerald";
  if (status === "in_progress" || status === "pending") return "cyan";
  if (status === "failed") return "red";
  return "default";
}

export default function BackupsPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [backups, setBackups] = useState<BackupDoc[]>([]);
  const [runningPods, setRunningPods] = useState<PodDoc[]>([]);
  const [retailPerGbMonthUsd, setRetailPerGbMonthUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore modal state
  const [restoreTarget, setRestoreTarget] = useState<BackupDoc | null>(null);
  const [selectedPodId, setSelectedPodId] = useState("");
  const [restorePath, setRestorePath] = useState("/root");
  const [restoring, setRestoring] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bkRes, podsRes] = await Promise.all([
        authFetch("/api/backups"),
        authFetch("/api/pods"),
      ]);
      const bkData = (await bkRes.json()) as {
        backups?: BackupDoc[];
        retailPerGbMonthUsd?: number;
        error?: string;
      };
      if (!bkRes.ok) throw new Error(bkData.error || "Failed to load backups");
      setBackups(bkData.backups || []);
      setRetailPerGbMonthUsd(bkData.retailPerGbMonthUsd ?? null);

      if (podsRes.ok) {
        const pData = (await podsRes.json()) as { pods?: PodDoc[] };
        const active = (pData.pods || []).filter((p) => p.status === "running");
        setRunningPods(active);
        if (active.length > 0 && !selectedPodId) {
          setSelectedPodId(active[0].$id);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }, [user, authFetch, selectedPodId]);

  useEffect(() => {
    if (!authLoading && user) void loadData();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadData]);

  async function handleDelete(backup: BackupDoc) {
    if (
      !window.confirm(
        `Delete backup "${backup.name}"? Stored snapshot data will be permanently removed.`
      )
    ) {
      return;
    }
    try {
      const res = await authFetch(`/api/backups/${backup.$id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(`Backup "${backup.name}" deleted.`);
      setBackups((prev) => prev.filter((b) => b.$id !== backup.$id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreTarget || !selectedPodId) return;
    setRestoring(true);
    try {
      const res = await authFetch(`/api/pods/${selectedPodId}/restore`, {
        method: "POST",
        body: JSON.stringify({
          backupId: restoreTarget.$id,
          restorePath,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Restore failed");
      toast.success(`Restoring "${restoreTarget.name}" to ${restorePath}...`);
      setRestoreTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Pod Backups & Restore
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              S3 snapshots of <code>/root</code> folders that survive pod deletion
              {retailPerGbMonthUsd !== null
                ? ` (~$${retailPerGbMonthUsd.toFixed(4)} / GB-month + transfer).`
                : "."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading || !user}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Sync Backups
            </Button>
            <Link href="/pods">
              <Button size="sm">Manage Pod Schedules</Button>
            </Link>
          </div>
        </div>

        {!authLoading && !user ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to view, restore, or delete your pod backups.
            </p>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : loading ? (
          <Card className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-2">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48 bg-zinc-800/80" />
                  <Skeleton className="h-3 w-72 bg-zinc-800/80" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800/80" />
                  <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800/80" />
                </div>
              </div>
            ))}
          </Card>
        ) : backups.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <FolderArchive className="h-8 w-8 text-zinc-600 mx-auto" />
            <h2 className="text-base font-medium text-white">No backups yet</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Trigger a manual backup or configure an automated schedule from{" "}
              <Link href="/pods" className="text-emerald-400 underline">
                My Pods
              </Link>
              , or enable Auto-Backups when launching a new GPU.
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Snapshot</th>
                  <th className="px-4 py-3 font-medium">Source Pod</th>
                  <th className="px-4 py-3 font-medium">Path</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Size</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {backups.map((bk) => (
                  <tr key={bk.$id} className="hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{bk.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {new Date(bk.$createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{bk.pod_name}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400">
                      {bk.backup_path}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(bk.status)}>{bk.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300">
                      {formatBytes(bk.size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={bk.status !== "completed"}
                          onClick={() => {
                            setRestoreTarget(bk);
                            setRestorePath(bk.backup_path || "/root");
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDelete(bk)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Restore Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6 space-y-5 bg-zinc-950">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ArchiveRestore className="h-5 w-5 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  Restore Backup
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Restore <strong className="text-white">{restoreTarget.name}</strong>{" "}
              into a running pod, or launch a new pod with this backup in the{" "}
              <Link href="/marketplace" className="text-emerald-400 underline">
                Marketplace
              </Link>
              .
            </p>

            {runningPods.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                No running pods available. Launch a new pod in the Marketplace and
                select this backup in the Deploy Drawer!
              </div>
            ) : (
              <form onSubmit={handleRestore} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="targetPod">Target Running Pod</Label>
                  <Select
                    id="targetPod"
                    value={selectedPodId}
                    onChange={(e) => setSelectedPodId(e.target.value)}
                  >
                    {runningPods.map((p) => (
                      <option key={p.$id} value={p.$id}>
                        {p.name} ({p.gpu_count}x {p.gpu_model})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="restorePath">Restore Path (inside /root)</Label>
                  <Input
                    id="restorePath"
                    required
                    value={restorePath}
                    onChange={(e) => setRestorePath(e.target.value)}
                    placeholder="/root"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setRestoreTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={restoring}>
                    {restoring ? "Restoring..." : "Start Restore"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
