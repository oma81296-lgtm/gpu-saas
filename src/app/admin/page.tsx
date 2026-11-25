"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Bell,
  Check,
  DollarSign,
  Layers,
  Megaphone,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Sliders,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type {
  CuratedTemplateDoc,
  NotificationDoc,
  OperatorSettingsDoc,
  PricingRuleDoc,
  UserProfileDoc,
} from "@/lib/appwrite/config";
import type { LiumPartnerRentalsResponse } from "@/lib/lium/types";
import { formatMicroUsd, formatUsd } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewData {
  masterBalanceUsd: number | null;
  liumError: string | null;
  totalUsers: number;
  activePodsCount: number;
  liumUsdBilled: number;
  platformUsdBilled: number;
  grossMarginUsd: number;
  faultCloses: number;
  partnerRentals: LiumPartnerRentalsResponse | null;
}

export default function AdminPage() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [tab, setTab] = useState<
    "overview" | "pricing" | "templates" | "users" | "notifications" | "alerts"
  >("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [rules, setRules] = useState<PricingRuleDoc[]>([]);
  const [templates, setTemplates] = useState<CuratedTemplateDoc[]>([]);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [users, setUsers] = useState<UserProfileDoc[]>([]);
  const [alerts, setAlerts] = useState<OperatorSettingsDoc | null>(null);

  // New notification form
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifSeverity, setNotifSeverity] = useState<
    "info" | "success" | "warning" | "critical"
  >("info");
  const [notifTargetUserId, setNotifTargetUserId] = useState("");
  const [notifActionLabel, setNotifActionLabel] = useState("");
  const [notifActionUrl, setNotifActionUrl] = useState("");
  const [notifDismissible, setNotifDismissible] = useState(true);
  const [notifExpiresHours, setNotifExpiresHours] = useState("");

  // New template form
  const [tplSlug, setTplSlug] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState<"base" | "ai_app" | "notebook">("ai_app");
  const [tplDesc, setTplDesc] = useState("");
  const [tplLiumId, setTplLiumId] = useState("custom:");
  const [tplImage, setTplImage] = useState("");
  const [tplPorts, setTplPorts] = useState("22,8000");
  const [tplMinVram, setTplMinVram] = useState("16");

  // New pricing rule form
  const [newScope, setNewScope] = useState<"global" | "gpu_model">("gpu_model");
  const [newGpuModel, setNewGpuModel] = useState("H100");
  const [newMarkup, setNewMarkup] = useState("20");
  const [newMinRel, setNewMinRel] = useState("90");

  // Inline edit pricing rule state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editMarkup, setEditMarkup] = useState("");
  const [editMinRel, setEditMinRel] = useState("");
  const [savingRuleEdit, setSavingRuleEdit] = useState(false);

  // Credit adjustment form
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("10");
  const [creditNote, setCreditNote] = useState("Manual goodwill credit");

  // Alert form
  const [thresholdUsd, setThresholdUsd] = useState("100");
  const [discordUrl, setDiscordUrl] = useState("");
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [alertEmail, setAlertEmail] = useState("");

  const loadAll = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    try {
      const [ovRes, prRes, tplRes, usRes, ntRes, alRes] = await Promise.all([
        authFetch("/api/admin/overview"),
        authFetch("/api/admin/pricing"),
        authFetch("/api/admin/templates"),
        authFetch("/api/admin/credits"),
        authFetch("/api/admin/notifications"),
        authFetch("/api/admin/alerts"),
      ]);
      if (ovRes.ok) setOverview((await ovRes.json()) as OverviewData);
      if (prRes.ok) {
        const d = (await prRes.json()) as { rules?: PricingRuleDoc[] };
        setRules(d.rules || []);
      }
      if (tplRes.ok) {
        const d = (await tplRes.json()) as { templates?: CuratedTemplateDoc[] };
        setTemplates(d.templates || []);
      }
      if (ntRes.ok) {
        const d = (await ntRes.json()) as { notifications?: NotificationDoc[] };
        setNotifications(d.notifications || []);
      }
      if (usRes.ok) {
        const d = (await usRes.json()) as { users?: UserProfileDoc[] };
        setUsers(d.users || []);
        if (d.users && d.users.length > 0 && !creditUserId) {
          setCreditUserId(d.users[0].user_id);
        }
      }
      if (alRes.ok) {
        const d = (await alRes.json()) as { settings?: OperatorSettingsDoc | null };
        if (d.settings) {
          setAlerts(d.settings);
          setThresholdUsd(String(d.settings.master_balance_alert_threshold_usd ?? 100));
          setDiscordUrl(d.settings.discord_webhook_url || "");
          setTgToken(d.settings.telegram_bot_token || "");
          setTgChatId(d.settings.telegram_chat_id || "");
          setAlertEmail(d.settings.alert_email || "");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admin data");
    }
  }, [user, authFetch, creditUserId]);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") void loadAll();
  }, [authLoading, user, loadAll]);

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await authFetch("/api/admin/pricing", {
        method: "POST",
        body: JSON.stringify({
          scope: newScope,
          gpuModel: newScope === "gpu_model" ? newGpuModel : null,
          markupPercent: Number(newMarkup),
          minReliabilityScore: Number(newMinRel),
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create pricing rule");
      toast.success("Pricing rule saved!");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  function startEditRule(rule: PricingRuleDoc) {
    setEditingRuleId(rule.$id);
    setEditMarkup(String(rule.markup_percent));
    setEditMinRel(String(rule.min_reliability_score));
  }

  async function handleUpdateRule(id: string) {
    setSavingRuleEdit(true);
    try {
      const res = await authFetch("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({
          id,
          markupPercent: Number(editMarkup),
          minReliabilityScore: Number(editMinRel),
        }),
      });
      const data = (await res.json()) as { rule?: PricingRuleDoc; error?: string };
      if (!res.ok || !data.rule) {
        throw new Error(data.error || "Failed to update rule");
      }
      setRules((prev) => prev.map((r) => (r.$id === id ? data.rule! : r)));
      setEditingRuleId(null);
      toast.success("Pricing rule updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingRuleEdit(false);
    }
  }

  async function handleDeleteRule(id: string) {
    const res = await authFetch(`/api/admin/pricing?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Rule removed");
      setRules((prev) => prev.filter((r) => r.$id !== id));
    }
  }

  async function handleAdjustCredits(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await authFetch("/api/admin/credits", {
        method: "POST",
        body: JSON.stringify({
          userId: creditUserId,
          amountUsd: Number(creditAmount),
          note: creditNote,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Adjustment failed");
      toast.success("User credit balance updated!");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    }
  }

  async function handleSaveAlerts(e: React.FormEvent) {
    e.preventDefault();
    const res = await authFetch("/api/admin/alerts", {
      method: "PUT",
      body: JSON.stringify({
        masterBalanceAlertThresholdUsd: Number(thresholdUsd),
        discordWebhookUrl: discordUrl || null,
        telegramBotToken: tgToken || null,
        telegramChatId: tgChatId || null,
        alertEmail: alertEmail || null,
      }),
    });
    if (res.ok) {
      toast.success("Alert settings saved!");
      await loadAll();
    } else {
      toast.error("Failed to save alert settings");
    }
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await authFetch("/api/admin/templates", {
        method: "POST",
        body: JSON.stringify({
          slug: tplSlug,
          name: tplName,
          category: tplCategory,
          description: tplDesc,
          liumTemplateId: tplLiumId,
          dockerImage: tplImage || undefined,
          defaultPorts: tplPorts || "22",
          minVramGb: Number(tplMinVram) || 0,
          sortOrder: templates.length + 1,
          enabled: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to add template");
      toast.success(`Template "${tplName}" added!`);
      setTplSlug("");
      setTplName("");
      setTplDesc("");
      setTplLiumId("custom:");
      setTplImage("");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add template");
    }
  }

  async function handleDeleteTemplate(id: string) {
    const res = await authFetch(`/api/admin/templates?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Template deleted");
      setTemplates((prev) => prev.filter((t) => t.$id !== id));
    }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await authFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: notifTitle,
          message: notifMessage,
          severity: notifSeverity,
          targetUserId: notifTargetUserId || null,
          actionLabel: notifActionLabel || null,
          actionUrl: notifActionUrl || null,
          dismissible: notifDismissible,
          expiresInHours: notifExpiresHours ? Number(notifExpiresHours) : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to send notification");
      toast.success("Notification published!");
      setNotifTitle("");
      setNotifMessage("");
      setNotifActionLabel("");
      setNotifActionUrl("");
      setNotifExpiresHours("");
      window.dispatchEvent(new Event("voltgpu:notifications-updated"));
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    }
  }

  async function handleToggleNotification(notif: NotificationDoc) {
    const res = await authFetch("/api/admin/notifications", {
      method: "PATCH",
      body: JSON.stringify({ id: notif.$id, active: !notif.active }),
    });
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.$id === notif.$id ? { ...n, active: !n.active } : n))
      );
      window.dispatchEvent(new Event("voltgpu:notifications-updated"));
      toast.success(notif.active ? "Notification paused" : "Notification activated");
    }
  }

  async function handleDeleteNotification(id: string) {
    const res = await authFetch(
      `/api/admin/notifications?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setNotifications((prev) => prev.filter((n) => n.$id !== id));
      window.dispatchEvent(new Event("voltgpu:notifications-updated"));
      toast.success("Notification deleted");
    }
  }

  async function handleTestAlert() {
    const res = await authFetch("/api/admin/alerts", { method: "POST" });
    if (res.ok) toast.success("Test alert dispatched!");
    else toast.error("Failed to dispatch test alert");
  }

  return (
    <AppShell>
      {!authLoading && (!user || user.role !== "admin") ? (
        <Card className="p-12 text-center space-y-2">
          <ShieldCheck className="h-8 w-8 text-violet-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Admin Access Required</h1>
          <p className="text-xs text-zinc-400">
            Add your email to <code>ADMIN_EMAILS</code> in <code>.env.local</code> or set{" "}
            <code>role: &quot;admin&quot;</code> on your profile in Appwrite.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Operations Suite
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Wholesale Lium reconciliation, markup rules, user credits, and automated alerts.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["overview", "Overview", Activity],
                  ["pricing", "Pricing Rules", Sliders],
                  ["templates", "Templates", Layers],
                  ["users", "User Credits", Users],
                  ["notifications", "Notifications", Megaphone],
                  ["alerts", "Alerts", Bell],
                ] as const
              ).map(([key, label, Icon]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={tab === key ? "default" : "secondary"}
                  onClick={() => setTab(key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {tab === "overview" && !overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-5 space-y-2">
                    <Skeleton className="h-3 w-28 bg-zinc-800/80" />
                    <Skeleton className="h-7 w-24 bg-zinc-800/80" />
                  </Card>
                ))}
              </div>
              <Card className="p-5 space-y-3">
                <Skeleton className="h-4 w-56 bg-zinc-800/80" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full bg-zinc-800/80" />
                ))}
              </Card>
            </div>
          )}

          {tab === "overview" && overview && (
            <div className="space-y-6">
              {overview.liumError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                  Lium API status: {overview.liumError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-5">
                  <div className="text-xs text-zinc-400">Master Lium Balance</div>
                  <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                    {overview.masterBalanceUsd !== null
                      ? formatUsd(overview.masterBalanceUsd)
                      : "—"}
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="text-xs text-zinc-400">30d Retail Billed</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">
                    {formatUsd(overview.platformUsdBilled)}
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="text-xs text-zinc-400">30d Wholesale (Lium)</div>
                  <div className="text-2xl font-mono font-bold text-zinc-300 mt-1">
                    {formatUsd(overview.liumUsdBilled)}
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="text-xs text-zinc-400">30d Gross Margin / Faults</div>
                  <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">
                    {formatUsd(overview.grossMarginUsd)}{" "}
                    <span className="text-xs text-red-400 font-normal">
                      ({overview.faultCloses} faults)
                    </span>
                  </div>
                </Card>
              </div>

              <Card className="overflow-x-auto">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Lium Partner Rentals by Customer (<code>/partners/me/rentals</code>)
                  </h2>
                  <Badge>
                    {overview.activePodsCount} active pods • {overview.totalUsers} users
                  </Badge>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5">customer_ref</th>
                      <th className="px-4 py-2.5 text-right">Rentals</th>
                      <th className="px-4 py-2.5 text-right">GPU Hours</th>
                      <th className="px-4 py-2.5 text-right">Wholesale USD</th>
                      <th className="px-4 py-2.5 text-right">Fault Closes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {!overview.partnerRentals ||
                    overview.partnerRentals.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                          No partner rental rows in this 30-day window.
                        </td>
                      </tr>
                    ) : (
                      overview.partnerRentals.rows.map((r) => (
                        <tr key={r.bucket}>
                          <td className="px-4 py-2.5 font-mono text-zinc-200">
                            {r.bucket}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{r.rentals}</td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {r.gpu_hours.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                            {formatUsd(r.usd_billed)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {r.fault_closes > 0 ? (
                              <Badge variant="red">{r.fault_closes}</Badge>
                            ) : (
                              "0"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {tab === "pricing" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-white mb-4">
                  Add Markup Rule
                </h2>
                <form onSubmit={handleCreateRule} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Scope</Label>
                    <Select
                      value={newScope}
                      onChange={(e) =>
                        setNewScope(e.target.value as "global" | "gpu_model")
                      }
                    >
                      <option value="gpu_model">Per GPU Model</option>
                      <option value="global">Global Default</option>
                    </Select>
                  </div>
                  {newScope === "gpu_model" && (
                    <div className="space-y-1">
                      <Label>GPU Model (exact match)</Label>
                      <Input
                        value={newGpuModel}
                        onChange={(e) => setNewGpuModel(e.target.value)}
                        placeholder="H100"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Markup %</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={newMarkup}
                      onChange={(e) => setNewMarkup(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Min Reliability Score (0–100)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={newMinRel}
                      onChange={(e) => setNewMinRel(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    <Plus className="h-3.5 w-3.5" />
                    Save Rule
                  </Button>
                </form>
              </Card>

              <Card className="lg:col-span-2 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">Active Rules</h2>
                <div className="space-y-2">
                  {rules.map((r) => {
                    const isEditing = editingRuleId === r.$id;
                    return (
                      <div
                        key={r.$id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs"
                      >
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-3 flex-1">
                            <span className="font-semibold text-white min-w-[110px]">
                              {r.scope === "global"
                                ? "Global Default"
                                : `GPU: ${r.gpu_model}`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[11px] text-zinc-400">Markup %</Label>
                              <Input
                                type="number"
                                step="0.5"
                                value={editMarkup}
                                onChange={(e) => setEditMarkup(e.target.value)}
                                className="h-8 w-20 font-mono text-xs"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Label className="text-[11px] text-zinc-400">Min Rel %</Label>
                              <Input
                                type="number"
                                step="1"
                                value={editMinRel}
                                onChange={(e) => setEditMinRel(e.target.value)}
                                className="h-8 w-20 font-mono text-xs"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-white">
                              {r.scope === "global"
                                ? "Global Default"
                                : `GPU: ${r.gpu_model}`}
                            </span>
                            <span className="ml-3 font-mono text-emerald-400">
                              +{r.markup_percent}% markup
                            </span>
                            <span className="ml-3 text-zinc-400">
                              Min reliability: {r.min_reliability_score}%
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                disabled={savingRuleEdit}
                                onClick={() => void handleUpdateRule(r.$id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={savingRuleEdit}
                                onClick={() => setEditingRuleId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditRule(r)}
                                title="Edit rule"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void handleDeleteRule(r.$id)}
                                title="Delete rule"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {tab === "templates" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-white mb-4">
                  Add Curated Template
                </h2>
                <form onSubmit={handleCreateTemplate} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      required
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      placeholder="SGLang Inference Server"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Slug</Label>
                      <Input
                        required
                        value={tplSlug}
                        onChange={(e) => setTplSlug(e.target.value)}
                        placeholder="sglang"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select
                        value={tplCategory}
                        onChange={(e) =>
                          setTplCategory(e.target.value as "base" | "ai_app" | "notebook")
                        }
                      >
                        <option value="ai_app">1-Click AI App</option>
                        <option value="base">Base OS/CUDA</option>
                        <option value="notebook">Notebook</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Lium Template UUID or custom:image:tag</Label>
                    <Input
                      required
                      value={tplLiumId}
                      onChange={(e) => setTplLiumId(e.target.value)}
                      placeholder="custom:lmsysorg/sglang:latest"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Docker Image (display)</Label>
                    <Input
                      value={tplImage}
                      onChange={(e) => setTplImage(e.target.value)}
                      placeholder="lmsysorg/sglang:latest"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Default Ports</Label>
                      <Input
                        value={tplPorts}
                        onChange={(e) => setTplPorts(e.target.value)}
                        placeholder="22,8000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Min VRAM (GB)</Label>
                      <Input
                        type="number"
                        value={tplMinVram}
                        onChange={(e) => setTplMinVram(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input
                      required
                      value={tplDesc}
                      onChange={(e) => setTplDesc(e.target.value)}
                      placeholder="Fast LLM serving runtime with RadixAttention."
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    <Plus className="h-3.5 w-3.5" />
                    Add Template
                  </Button>
                </form>
              </Card>

              <Card className="lg:col-span-2 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Curated Templates ({templates.length})
                </h2>
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div
                      key={t.$id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{t.name}</span>
                          <Badge variant={t.category === "ai_app" ? "cyan" : "default"}>
                            {t.category}
                          </Badge>
                          <span className="text-zinc-500 font-mono">
                            ≥{t.min_vram_gb}GB VRAM
                          </span>
                        </div>
                        <p className="text-zinc-400">{t.description}</p>
                        <div className="font-mono text-[11px] text-zinc-500 truncate">
                          {t.lium_template_id}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleDeleteTemplate(t.$id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === "users" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  Manual Credit Adjustment
                </h2>
                <form onSubmit={handleAdjustCredits} className="space-y-3">
                  <div className="space-y-1">
                    <Label>User</Label>
                    <Select
                      value={creditUserId}
                      onChange={(e) => setCreditUserId(e.target.value)}
                    >
                      {users.map((u) => (
                        <option key={u.$id} value={u.user_id}>
                          {u.email || u.user_id} ({formatMicroUsd(u.balance_micro_usd)})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Amount USD (positive to grant, negative to deduct)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Audit Note</Label>
                    <Input
                      required
                      value={creditNote}
                      onChange={(e) => setCreditNote(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    Apply Adjustment
                  </Button>
                </form>
              </Card>

              <Card className="lg:col-span-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-right">Pod Cap</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {users.map((u) => (
                      <tr key={u.$id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">
                            {u.email || u.name || u.user_id}
                          </div>
                          <div className="font-mono text-[11px] text-zinc-500">
                            {u.user_id}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.role === "admin" ? "violet" : "default"}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {u.max_concurrent_pods}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatMicroUsd(u.balance_micro_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {tab === "notifications" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-emerald-400" />
                  Send Client Notification
                </h2>
                <form onSubmit={handleSendNotification} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      required
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="New H200 Nodes Online"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Message</Label>
                    <Input
                      required
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      placeholder="Dedicated 8x H200 SXM5 nodes are now available in Tokyo & US-East."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Severity</Label>
                      <Select
                        value={notifSeverity}
                        onChange={(e) =>
                          setNotifSeverity(
                            e.target.value as "info" | "success" | "warning" | "critical"
                          )
                        }
                      >
                        <option value="info">Info (Cyan)</option>
                        <option value="success">Success (Emerald)</option>
                        <option value="warning">Warning (Amber)</option>
                        <option value="critical">Critical (Red)</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Expires in (hrs, opt.)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        value={notifExpiresHours}
                        onChange={(e) => setNotifExpiresHours(e.target.value)}
                        placeholder="24"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Audience</Label>
                    <Select
                      value={notifTargetUserId}
                      onChange={(e) => setNotifTargetUserId(e.target.value)}
                    >
                      <option value="">All Users (Broadcast)</option>
                      {users.map((u) => (
                        <option key={u.$id} value={u.user_id}>
                          Only: {u.email || u.user_id}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>CTA Label (opt.)</Label>
                      <Input
                        value={notifActionLabel}
                        onChange={(e) => setNotifActionLabel(e.target.value)}
                        placeholder="Browse GPUs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>CTA URL (opt.)</Label>
                      <Input
                        value={notifActionUrl}
                        onChange={(e) => setNotifActionUrl(e.target.value)}
                        placeholder="/marketplace"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={notifDismissible}
                      onChange={(e) => setNotifDismissible(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    Allow users to dismiss banner
                  </label>
                  <Button type="submit" size="sm" className="w-full">
                    <Send className="h-3.5 w-3.5" />
                    Publish Notification
                  </Button>
                </form>
              </Card>

              <Card className="lg:col-span-2 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Published Notifications ({notifications.length})
                </h2>
                {notifications.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-8 text-center">
                    No notifications published yet. Send one on the left and it will
                    appear in the notification bar under the header immediately.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div
                        key={n.$id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3.5 text-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-white">{n.title}</span>
                            <Badge
                              variant={
                                n.severity === "critical"
                                  ? "red"
                                  : n.severity === "warning"
                                    ? "amber"
                                    : n.severity === "success"
                                      ? "emerald"
                                      : "cyan"
                              }
                            >
                              {n.severity}
                            </Badge>
                            <Badge variant={n.active ? "emerald" : "default"}>
                              {n.active ? "Active" : "Paused"}
                            </Badge>
                            <Badge>
                              {n.target_user_id ? `User: ${n.target_user_id}` : "Broadcast"}
                            </Badge>
                          </div>
                          <p className="text-zinc-400">{n.message}</p>
                          <div className="text-[11px] text-zinc-500">
                            Created {new Date(n.$createdAt).toLocaleString()}
                            {n.expires_at
                              ? ` • Expires ${new Date(n.expires_at).toLocaleString()}`
                              : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleToggleNotification(n)}
                          >
                            {n.active ? "Pause" : "Activate"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDeleteNotification(n.$id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "alerts" && (
            <Card className="w-full p-6">
              <form onSubmit={handleSaveAlerts} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    Automated Operator Alerts
                  </h2>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleTestAlert()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send Test Alert
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Master Lium Balance Alert Threshold (USD)</Label>
                  <Input
                    type="number"
                    value={thresholdUsd}
                    onChange={(e) => setThresholdUsd(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Discord Webhook URL</Label>
                  <Input
                    value={discordUrl}
                    onChange={(e) => setDiscordUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telegram Bot Token</Label>
                    <Input
                      value={tgToken}
                      onChange={(e) => setTgToken(e.target.value)}
                      placeholder="123456:ABC-DEF..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telegram Chat ID</Label>
                    <Input
                      value={tgChatId}
                      onChange={(e) => setTgChatId(e.target.value)}
                      placeholder="-1001234567890"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Alert Email (logged / Appwrite Messaging target)</Label>
                  <Input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="ops@voltgpu.io"
                  />
                </div>
                <Button type="submit" size="sm">
                  Save Alert Settings
                </Button>
                {alerts && (
                  <p className="text-[11px] text-zinc-500">
                    Used by the hourly <code>reconcile-and-alert</code> and 1-min{" "}
                    <code>meter-pods</code> Appwrite Functions.
                  </p>
                )}
              </form>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
