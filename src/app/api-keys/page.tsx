"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  Copy,
  KeySquare,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import type { PublicApiKey } from "@/lib/api-keys";
import { BRAND } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
} from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

const EXPIRY_OPTIONS = [
  { label: "90 days (Recommended)", value: "90" },
  { label: "30 days", value: "30" },
  { label: "7 days", value: "7" },
  { label: "1 year", value: "365" },
  { label: "Never expires", value: "never" },
] as const;

export default function ApiKeysPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [keys, setKeys] = useState<PublicApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState<string>("90");
  const [saving, setSaving] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(
    null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/api-keys");
      const data = (await res.json()) as { keys?: PublicApiKey[] };
      setKeys(data.keys || []);
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!authLoading && user) void loadKeys();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadKeys]);

  async function handleCopy(text: string, id: string, label = "Copied!") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success(label);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const expiresInDays =
        expiresIn === "never" ? null : Number.parseInt(expiresIn, 10);
      const res = await authFetch("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          expiresInDays,
        }),
      });
      const data = (await res.json()) as {
        key?: PublicApiKey;
        secret?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to create API key");
      if (data.secret) {
        setNewlyCreatedSecret(data.secret);
      }
      toast.success("API key created! Copy it now — it won't be shown again.");
      setName("");
      await loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(key: PublicApiKey) {
    setEditingId(key.$id);
    setEditName(key.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) {
      toast.error("Key label cannot be empty");
      return;
    }

    setUpdatingId(id);
    try {
      const res = await authFetch(`/api/api-keys/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = (await res.json()) as { key?: PublicApiKey; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to update API key");
      if (data.key) {
        setKeys((prev) => prev.map((k) => (k.$id === id ? data.key! : k)));
      }
      toast.success("API key updated.");
      cancelEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await authFetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke API key");
      toast.success("API key revoked.");
      setKeys((prev) => prev.filter((k) => k.$id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke failed");
    }
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            API Keys
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Create and manage personal API keys for the {BRAND.name} REST API
            and Remote MCP server.
          </p>
        </div>

        {!authLoading && !user ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to create and manage your API keys.
            </p>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : (
          <>
            {newlyCreatedSecret && (
              <Card className="p-4 border-amber-500/40 bg-amber-500/10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-amber-200">
                        Copy your new API key now — it won&apos;t be shown again
                      </div>
                      <p className="text-xs text-amber-200/80 mt-0.5">
                        Store it in a password manager or paste it into your MCP
                        client or script.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewlyCreatedSecret(null)}
                  >
                    Dismiss
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-zinc-950/90 px-3 py-2">
                  <code className="flex-1 font-mono text-xs text-emerald-300 break-all">
                    {newlyCreatedSecret}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void handleCopy(
                        newlyCreatedSecret,
                        "new-secret",
                        "API key copied!"
                      )
                    }
                  >
                    {copiedId === "new-secret" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy Key
                  </Button>
                </div>
              </Card>
            )}

            {/* Create API Key Form */}
            <Card className="p-5">
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Create New API Key
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    You can have up to 10 active keys. Admin and key-management
                    endpoints are blocked for API keys by default.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="keyLabel">Key Name</Label>
                    <Input
                      id="keyLabel"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Claude Desktop, CI Pipeline, Local Script"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="keyExpiry">Expiration</Label>
                    <select
                      id="keyExpiry"
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    >
                      {EXPIRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={saving}>
                  <Plus className="h-4 w-4" />
                  {saving ? "Generating..." : "Create API Key"}
                </Button>
              </form>
            </Card>

            {/* Active Keys List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Active API Keys ({keys.length}/10)
                </h2>
              </div>

              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Card
                    key={i}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-44 bg-zinc-800/80" />
                      <Skeleton className="h-3 w-72 bg-zinc-800/80" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg bg-zinc-800/80" />
                  </Card>
                ))
              ) : keys.length === 0 ? (
                <Card className="p-8 text-center text-sm text-zinc-400">
                  No API keys created yet. Create your first key above.
                </Card>
              ) : (
                keys.map((k) => {
                  const isEditing = editingId === k.$id;
                  const expiresAtMs = k.expires_at
                    ? new Date(k.expires_at).getTime()
                    : null;
                  const isExpired =
                    expiresAtMs !== null && expiresAtMs <= Date.now();
                  const isExpiringSoon =
                    expiresAtMs !== null &&
                    !isExpired &&
                    expiresAtMs - Date.now() < 7 * 24 * 60 * 60 * 1000;
                  return (
                    <Card key={k.$id} className="p-4 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                          <KeySquare className="h-4 w-4 text-emerald-400 mt-1 shrink-0" />
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-sm text-white">
                                {k.name}
                              </span>
                              {isExpired ? (
                                <Badge variant="red" className="text-[10px]">
                                  Expired
                                </Badge>
                              ) : isExpiringSoon ? (
                                <Badge variant="amber" className="text-[10px]">
                                  Expires{" "}
                                  {new Date(k.expires_at!).toLocaleDateString()}
                                </Badge>
                              ) : k.expires_at ? (
                                <Badge variant="default" className="text-[10px]">
                                  Expires{" "}
                                  {new Date(k.expires_at).toLocaleDateString()}
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-[10px]">
                                  Never expires
                                </Badge>
                              )}
                            </div>
                            <div className="font-mono text-xs text-zinc-400">
                              {k.key_prefix}••••••••
                              <span className="mx-2 text-zinc-600">•</span>
                              Created{" "}
                              {new Date(k.$createdAt).toLocaleDateString()}
                              <span className="mx-2 text-zinc-600">•</span>
                              {k.last_used_at
                                ? `Last used ${new Date(
                                    k.last_used_at
                                  ).toLocaleString()}`
                                : "Never used"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isEditing && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => startEdit(k)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleRevoke(k.$id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3 sm:flex-row sm:items-end">
                          <div className="space-y-1 flex-1 max-w-md">
                            <Label htmlFor={`edit-name-${k.$id}`}>
                              Key Name
                            </Label>
                            <Input
                              id={`edit-name-${k.$id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={updatingId === k.$id}
                              onClick={() => void handleUpdate(k.$id)}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {updatingId === k.$id ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
