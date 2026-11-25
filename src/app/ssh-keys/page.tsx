"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import type { SshKeyDoc } from "@/lib/appwrite/config";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, Input, Label, Textarea } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function SshKeysPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [keys, setKeys] = useState<SshKeyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [saving, setSaving] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/ssh-keys");
      const data = (await res.json()) as { keys?: SshKeyDoc[] };
      setKeys(data.keys || []);
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!authLoading && user) void loadKeys();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadKeys]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch("/api/ssh-keys", {
        method: "POST",
        body: JSON.stringify({ name, publicKey }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to add SSH key");
      toast.success("SSH key saved!");
      setName("");
      setPublicKey("");
      await loadKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await authFetch(`/api/ssh-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete SSH key");
      toast.success("SSH key removed.");
      setKeys((prev) => prev.filter((k) => k.$id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            SSH Keys
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Inject your public SSH keys into pods on launch for instant terminal access.
          </p>
        </div>

        {!authLoading && !user ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-zinc-400">
              Sign in to manage your SSH keys.
            </p>
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="keyName">Key Label</Label>
                    <Input
                      id="keyName"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="MacBook Pro — ed25519"
                    />
                  </div>
                  <div className="text-xs text-zinc-400 flex items-end pb-2">
                    Need a key? Run{" "}
                    <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-emerald-300">
                      ssh-keygen -t ed25519
                    </code>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pubKey">Public Key</Label>
                  <Textarea
                    id="pubKey"
                    required
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
                    className="font-mono text-xs"
                  />
                </div>
                <Button type="submit" size="sm" disabled={saving}>
                  <Plus className="h-4 w-4" />
                  {saving ? "Saving..." : "Add SSH Key"}
                </Button>
              </form>
            </Card>

            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-40 bg-zinc-800/80" />
                      <Skeleton className="h-3 w-72 bg-zinc-800/80" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800/80" />
                  </Card>
                ))
              ) : keys.length === 0 ? (
                <Card className="p-8 text-center text-sm text-zinc-400">
                  No SSH keys added yet.
                </Card>
              ) : (
                keys.map((k) => (
                  <Card
                    key={k.$id}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <KeyRound className="h-4 w-4 text-emerald-400 mt-1 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-white">
                          {k.name}
                        </div>
                        <div className="font-mono text-xs text-zinc-400 truncate">
                          {k.fingerprint}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(k.$id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
