"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HardDrive, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { VolumeDoc } from "@/lib/appwrite/config";
import { formatMicroUsd } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Input, Label } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

interface VolumeWithLive extends VolumeDoc {
  attachedPodName: string | null;
  fileCount: number | null;
}

export default function VolumesPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [volumes, setVolumes] = useState<VolumeWithLive[]>([]);
  const [retailPerGbMonthUsd, setRetailPerGbMonthUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const loadVolumes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/volumes");
      const data = (await res.json()) as {
        volumes?: VolumeWithLive[];
        retailPerGbMonthUsd?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load volumes");
      setVolumes(data.volumes || []);
      setRetailPerGbMonthUsd(data.retailPerGbMonthUsd ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load volumes");
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!authLoading && user) void loadVolumes();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadVolumes]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await authFetch("/api/volumes", {
        method: "POST",
        body: JSON.stringify({ name, description: description || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to create volume");
      toast.success(`Persistent volume "${name}" created!`);
      setName("");
      setDescription("");
      await loadVolumes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(vol: VolumeWithLive) {
    if (
      !window.confirm(
        `Delete persistent volume "${vol.name}"? All files stored in this volume will be permanently erased.`
      )
    ) {
      return;
    }
    try {
      const res = await authFetch(`/api/volumes/${vol.$id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(`Volume "${vol.name}" deleted.`);
      setVolumes((prev) => prev.filter((v) => v.$id !== vol.$id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Persistent Volumes
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Elastic network storage that survives pod termination. Pay only for what you store
              {retailPerGbMonthUsd !== null
                ? ` (~$${retailPerGbMonthUsd.toFixed(4)} / GB-month + egress).`
                : "."}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadVolumes()}
            disabled={loading || !user}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Sync Sizes
          </Button>
        </div>

        {!authLoading && !user ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to create and attach persistent volumes to your GPU pods.
            </p>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <form
                onSubmit={handleCreate}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="volName">Volume Name</Label>
                  <Input
                    id="volName"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="datasets-v1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="volDesc">Description (optional)</Label>
                  <Input
                    id="volDesc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Checkpoints & HF model weights"
                  />
                </div>
                <Button type="submit" size="default" disabled={creating}>
                  <Plus className="h-4 w-4" />
                  {creating ? "Creating..." : "Create Volume"}
                </Button>
              </form>
            </Card>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-32 bg-zinc-800/80" />
                      <Skeleton className="h-5 w-20 rounded-md bg-zinc-800/80" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-800/80 p-2.5">
                      <Skeleton className="h-8 w-full bg-zinc-800/80" />
                      <Skeleton className="h-8 w-full bg-zinc-800/80" />
                      <Skeleton className="h-8 w-full bg-zinc-800/80" />
                    </div>
                    <div className="flex justify-between pt-2 border-t border-zinc-800/70">
                      <Skeleton className="h-4 w-24 bg-zinc-800/80" />
                      <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800/80" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : volumes.length === 0 ? (
              <Card className="p-12 text-center space-y-2">
                <HardDrive className="h-8 w-8 text-zinc-600 mx-auto" />
                <h2 className="text-base font-medium text-white">
                  No persistent volumes yet
                </h2>
                <p className="text-xs text-zinc-400">
                  Create a volume above, then attach it to any GPU pod in the Marketplace Deploy Drawer.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {volumes.map((vol) => (
                  <Card
                    key={vol.$id}
                    className="p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-emerald-400" />
                          <h3 className="font-semibold text-white">{vol.name}</h3>
                        </div>
                        {vol.attachedPodName ? (
                          <Badge variant="emerald">
                            Attached: {vol.attachedPodName}
                          </Badge>
                        ) : (
                          <Badge>Available</Badge>
                        )}
                      </div>
                      {vol.description && (
                        <p className="text-xs text-zinc-400">{vol.description}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-2.5 text-center text-xs">
                        <div>
                          <div className="text-[11px] text-zinc-500">Used</div>
                          <div className="font-mono text-zinc-200">
                            {vol.current_size_gb.toFixed(2)} GB
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-zinc-500">Files</div>
                          <div className="font-mono text-zinc-200">
                            {vol.fileCount ?? "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-zinc-500">Billed</div>
                          <div className="font-mono text-emerald-400">
                            {formatMicroUsd(vol.total_billed_micro_usd, 4)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/70 text-[11px] text-zinc-500">
                      <span>
                        Created {new Date(vol.$createdAt).toLocaleDateString()}
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={Boolean(vol.attachedPodName)}
                        title={
                          vol.attachedPodName
                            ? "Terminate attached pod before deleting volume"
                            : "Delete volume"
                        }
                        onClick={() => void handleDelete(vol)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
