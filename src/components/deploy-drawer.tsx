"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore, Container, HardDrive, KeyRound, Rocket, Sparkles, X } from "lucide-react";
import type { BackupDoc, CuratedTemplateDoc, SshKeyDoc, VolumeDoc } from "@/lib/appwrite/config";
import type { MarketplaceGpuNode } from "@/lib/lium/types";
import { formatMicroUsd, formatUsd, usdToMicroUsd } from "@/lib/brand";
import { useAuth } from "./auth-provider";
import { Badge, Button, Input, Label, Select, Textarea } from "./ui/primitives";

interface DeployDrawerProps {
  node: MarketplaceGpuNode | null;
  templates: CuratedTemplateDoc[];
  onClose: () => void;
}

export function DeployDrawer({ node, templates, onClose }: DeployDrawerProps) {
  const router = useRouter();
  const { user, authFetch, refreshProfile } = useAuth();

  const [mode, setMode] = useState<"curated" | "custom">("curated");
  const [podName, setPodName] = useState("");
  const [gpuCount, setGpuCount] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customImage, setCustomImage] = useState("pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel");
  const [customPorts, setCustomPorts] = useState("22,8888");
  const [customEnvText, setCustomEnvText] = useState("");
  const [startupCommands, setStartupCommands] = useState("");
  const [enableJupyter, setEnableJupyter] = useState(true);

  const [sshKeys, setSshKeys] = useState<SshKeyDoc[]>([]);
  const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>([]);
  const [volumes, setVolumes] = useState<VolumeDoc[]>([]);
  const [selectedVolumeId, setSelectedVolumeId] = useState("");
  const [enableVolumeEncryption, setEnableVolumeEncryption] = useState(false);
  const [enableBackups, setEnableBackups] = useState(false);
  const [backups, setBackups] = useState<BackupDoc[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [restorePath, setRestorePath] = useState("/root");
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!node) return;
    const slug = node.gpuModel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setPodName(`${slug}-${Math.floor(1000 + Math.random() * 9000)}`);
    setGpuCount(node.availableGpuCount || 1);
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].$id);
    }
  }, [node, templates, selectedTemplateId]);

  useEffect(() => {
    if (!node || !user) return;
    authFetch("/api/ssh-keys")
      .then((r) => r.json())
      .then((data: { keys?: SshKeyDoc[] }) => {
        const list = data.keys || [];
        setSshKeys(list);
        if (list.length > 0) setSelectedKeyIds([list[0].$id]);
      })
      .catch(() => setSshKeys([]));

    authFetch("/api/volumes")
      .then((r) => r.json())
      .then((data: { volumes?: VolumeDoc[] }) => {
        setVolumes(data.volumes || []);
      })
      .catch(() => setVolumes([]));

    authFetch("/api/backups")
      .then((r) => r.json())
      .then((data: { backups?: BackupDoc[] }) => {
        setBackups((data.backups || []).filter((b) => b.status === "completed"));
      })
      .catch(() => setBackups([]));
  }, [node, user, authFetch]);

  if (!node) return null;

  const retailHr = node.retailPricePerGpuHr * gpuCount;
  const minBufferMicro = Math.ceil(usdToMicroUsd(retailHr) * 0.5);
  const hasEnoughCredits = user ? user.balanceMicroUsd >= minBufferMicro : false;

  const selectedTemplate = templates.find((t) => t.$id === selectedTemplateId);

  function parseEnvVars(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx > 0) {
        out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    return out;
  }

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!node) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (selectedKeyIds.length === 0) {
      toast.error("Add and select an SSH key first.");
      return;
    }

    setLaunching(true);
    try {
      const ports = customPorts
        .split(",")
        .map((p) => parseInt(p.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0 && n <= 65535);

      const payload =
        mode === "curated"
          ? {
              executorId: node.id,
              podName,
              gpuCount,
              sshKeyIds: selectedKeyIds,
              enableJupyter,
              volumeId: selectedVolumeId || undefined,
              enableVolumeEncryption: selectedVolumeId
                ? enableVolumeEncryption
                : false,
              enableBackups,
              backupId: selectedBackupId || undefined,
              restorePath: selectedBackupId ? restorePath : undefined,
              templateId: selectedTemplate?.lium_template_id,
              templateName: selectedTemplate?.name,
            }
          : {
              executorId: node.id,
              podName,
              gpuCount,
              sshKeyIds: selectedKeyIds,
              enableJupyter,
              volumeId: selectedVolumeId || undefined,
              enableVolumeEncryption: selectedVolumeId
                ? enableVolumeEncryption
                : false,
              enableBackups,
              backupId: selectedBackupId || undefined,
              restorePath: selectedBackupId ? restorePath : undefined,
              customDockerImage: customImage,
              customEnvVars: parseEnvVars(customEnvText),
              customPorts: ports.length > 0 ? ports : [22, 8888],
              startupCommands: startupCommands.trim() || undefined,
              templateName: customImage,
            };

      const res = await authFetch("/api/pods", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to launch pod");
      }

      toast.success(`Pod "${podName}" is provisioning!`);
      await refreshProfile();
      onClose();
      router.push("/pods");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-zinc-950 border-l border-zinc-800 h-full overflow-y-auto p-6 flex flex-col justify-between">
        <form onSubmit={handleLaunch} className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">
                  Deploy {node.gpuModel}
                </h2>
                <Badge variant="emerald">Secure Tier</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {node.vramPerGpuGb} GB VRAM/GPU • {node.city || node.country} •{" "}
                {node.interconnect ? node.interconnect.toUpperCase() : "PCIe"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Pod Name & GPU Count */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="podName">Pod Name</Label>
              <Input
                id="podName"
                required
                value={podName}
                onChange={(e) => setPodName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gpuCount">GPU Count</Label>
              <Select
                id="gpuCount"
                value={String(gpuCount)}
                onChange={(e) => setGpuCount(Number(e.target.value))}
              >
                {Array.from(
                  { length: node.availableGpuCount - node.minRentableGpuCount + 1 },
                  (_, i) => node.minRentableGpuCount + i
                ).map((cnt) => (
                  <option key={cnt} value={cnt}>
                    {cnt}x {node.gpuModel}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-900 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => setMode("curated")}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  mode === "curated"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                Curated Templates
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  mode === "custom"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Container className="h-3.5 w-3.5 text-cyan-400" />
                Custom Docker Image
              </button>
            </div>

            {mode === "curated" ? (
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                {templates.map((tpl) => {
                  const selected = tpl.$id === selectedTemplateId;
                  return (
                    <button
                      key={tpl.$id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tpl.$id)}
                      className={`text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                        selected
                          ? "border-emerald-500/70 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">
                          {tpl.name}
                        </span>
                        <Badge
                          variant={tpl.category === "ai_app" ? "cyan" : "default"}
                        >
                          {tpl.category === "ai_app"
                            ? "1-Click AI App"
                            : tpl.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {tpl.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="customImage">Docker Image (repo:tag)</Label>
                  <Input
                    id="customImage"
                    required={mode === "custom"}
                    value={customImage}
                    onChange={(e) => setCustomImage(e.target.value)}
                    placeholder="vllm/vllm-openai:latest"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customPorts">Exposed Ports (comma-separated)</Label>
                  <Input
                    id="customPorts"
                    value={customPorts}
                    onChange={(e) => setCustomPorts(e.target.value)}
                    placeholder="22,8000,8888"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customEnv">Environment Variables (KEY=VALUE per line)</Label>
                  <Textarea
                    id="customEnv"
                    value={customEnvText}
                    onChange={(e) => setCustomEnvText(e.target.value)}
                    placeholder={"HF_TOKEN=hf_...\nMODEL_NAME=meta-llama/Llama-3.1-8B-Instruct"}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startupCmd">Startup Command (optional)</Label>
                  <Input
                    id="startupCmd"
                    value={startupCommands}
                    onChange={(e) => setStartupCommands(e.target.value)}
                    placeholder="python -m vllm.entrypoints.openai.api_server"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SSH Key Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>SSH Public Keys</Label>
              <Link
                href="/ssh-keys"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <KeyRound className="h-3 w-3" /> Manage Keys
              </Link>
            </div>
            {!user ? (
              <p className="text-xs text-zinc-400">
                Sign in to select your saved SSH keys and deploy.
              </p>
            ) : sshKeys.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                You don&apos;t have any SSH keys saved yet.{" "}
                <Link href="/ssh-keys" className="underline font-medium">
                  Add an SSH key first →
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sshKeys.map((k) => {
                  const checked = selectedKeyIds.includes(k.$id);
                  return (
                    <label
                      key={k.$id}
                      className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedKeyIds((prev) =>
                            e.target.checked
                              ? [...prev, k.$id]
                              : prev.filter((id) => id !== k.$id)
                          )
                        }
                        className="accent-emerald-500"
                      />
                      <span className="font-medium text-zinc-200">{k.name}</span>
                      <span className="font-mono text-[11px] text-zinc-500 truncate ml-auto">
                        {k.fingerprint}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Persistent Volume Selector */}
          {user && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="volumeSelect">Persistent Volume (optional)</Label>
                <Link
                  href="/volumes"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <HardDrive className="h-3 w-3" /> Manage Volumes
                </Link>
              </div>
              <Select
                id="volumeSelect"
                value={selectedVolumeId}
                onChange={(e) => setSelectedVolumeId(e.target.value)}
              >
                <option value="">None (ephemeral local NVMe only)</option>
                {volumes.map((v) => (
                  <option key={v.$id} value={v.$id}>
                    {v.name} ({v.current_size_gb.toFixed(2)} GB used)
                  </option>
                ))}
              </Select>
              {selectedVolumeId && (
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableVolumeEncryption}
                    onChange={(e) => setEnableVolumeEncryption(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Enable volume encryption
                </label>
              )}
            </div>
          )}

          {/* Backups & Restore on Launch */}
          {user && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="backupSelect">Restore from Backup (optional)</Label>
                <Link
                  href="/backups"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <ArchiveRestore className="h-3 w-3" /> View Backups
                </Link>
              </div>
              <Select
                id="backupSelect"
                value={selectedBackupId}
                onChange={(e) => setSelectedBackupId(e.target.value)}
              >
                <option value="">Start fresh (no restore)</option>
                {backups.map((b) => (
                  <option key={b.$id} value={b.$id}>
                    {b.name} ({b.pod_name} • {b.backup_path})
                  </option>
                ))}
              </Select>
              {selectedBackupId && (
                <div className="space-y-1">
                  <Label htmlFor="deployRestorePath">Restore Path (inside /root)</Label>
                  <Input
                    id="deployRestorePath"
                    value={restorePath}
                    onChange={(e) => setRestorePath(e.target.value)}
                    placeholder="/root"
                    className="font-mono text-xs"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={enableBackups}
                  onChange={(e) => setEnableBackups(e.target.checked)}
                  className="accent-emerald-500"
                />
                Enable automated scheduled backups of /root (S3 storage billed separately)
              </label>
            </div>
          )}

          {/* Jupyter toggle */}
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enableJupyter}
              onChange={(e) => setEnableJupyter(e.target.checked)}
              className="accent-emerald-500"
            />
            Enable JupyterLab web endpoint on launch
          </label>

          {/* Cost Summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Retail Rate ({gpuCount}x {node.gpuModel})</span>
              <span className="font-mono font-semibold text-white">
                {formatUsd(retailHr)} / hr
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Minimum 30-min launch buffer</span>
              <span className="font-mono text-zinc-300">
                {formatMicroUsd(minBufferMicro)}
              </span>
            </div>
            {user && (
              <div className="flex justify-between pt-2 border-t border-zinc-800">
                <span className="text-zinc-400">Your Wallet Balance</span>
                <span
                  className={`font-mono font-semibold ${
                    hasEnoughCredits ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatMicroUsd(user.balanceMicroUsd)}
                </span>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            {user && !hasEnoughCredits ? (
              <Link href="/billing" className="flex-1">
                <Button type="button" className="w-full">
                  Top Up Credits
                </Button>
              </Link>
            ) : (
              <Button
                type="submit"
                className="flex-1"
                disabled={launching || (Boolean(user) && sshKeys.length === 0)}
              >
                <Rocket className="h-4 w-4" />
                {!user
                  ? "Sign in to Deploy"
                  : launching
                    ? "Deploying..."
                    : "Launch Pod"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
