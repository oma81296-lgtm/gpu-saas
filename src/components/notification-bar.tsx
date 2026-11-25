"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  OctagonAlert,
  X,
} from "lucide-react";
import type { NotificationDoc } from "@/lib/appwrite/config";
import { useAuth } from "./auth-provider";

const DISMISSED_KEY = "voltgpu-dismissed-notifications";

function loadDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedIds(set: Set<string>) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage errors
  }
}

const SEVERITY_STYLES: Record<
  NotificationDoc["severity"],
  { bar: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }
> = {
  info: {
    bar: "border-cyan-500/25 bg-cyan-500/10 text-zinc-100",
    icon: Info,
    iconColor: "text-cyan-400",
  },
  success: {
    bar: "border-emerald-500/25 bg-emerald-500/10 text-zinc-100",
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
  },
  warning: {
    bar: "border-amber-500/30 bg-amber-500/10 text-zinc-100",
    icon: AlertTriangle,
    iconColor: "text-amber-300",
  },
  critical: {
    bar: "border-red-500/35 bg-red-500/15 text-zinc-100",
    icon: OctagonAlert,
    iconColor: "text-red-400",
  },
};

export function NotificationBar() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissedIds());
  const [index, setIndex] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = user
        ? await authFetch("/api/notifications")
        : await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: NotificationDoc[] };
      setNotifications(data.notifications || []);
    } catch {
      // ignore transient network failures
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (authLoading) return;
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 60_000);
    const onCustomRefresh = () => void fetchNotifications();
    window.addEventListener("voltgpu:notifications-updated", onCustomRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("voltgpu:notifications-updated", onCustomRefresh);
    };
  }, [authLoading, fetchNotifications]);

  const visible = notifications.filter(
    (n) => !n.dismissible || !dismissed.has(n.$id)
  );

  if (visible.length === 0) return null;

  const safeIndex = Math.min(index, visible.length - 1);
  const current = visible[safeIndex];
  const style = SEVERITY_STYLES[current.severity] || SEVERITY_STYLES.info;
  const Icon = style.icon;

  function handleDismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissedIds(next);
    setIndex(0);
  }

  return (
    <div
      role="status"
      className={`flex min-h-14 w-full items-center border-b px-4 py-2.5 text-sm sm:px-6 transition-colors ${style.bar}`}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Icon className={`h-4 w-4 shrink-0 ${style.iconColor}`} />
          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-white">{current.title}</span>
            <span className="text-zinc-300 truncate sm:whitespace-normal">
              {current.message}
            </span>
            {current.action_label && current.action_url && (
              <Link
                href={current.action_url}
                className={`inline-flex items-center gap-1 font-medium underline underline-offset-2 ${style.iconColor} hover:opacity-80`}
              >
                {current.action_label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {visible.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-md border border-zinc-800/70 bg-zinc-950/40 px-1 py-0.5 text-[11px] font-mono text-zinc-400">
              <button
                type="button"
                aria-label="Previous notification"
                onClick={() =>
                  setIndex((prev) => (prev - 1 + visible.length) % visible.length)
                }
                className="p-0.5 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <span className="px-1">
                {safeIndex + 1}/{visible.length}
              </span>
              <button
                type="button"
                aria-label="Next notification"
                onClick={() => setIndex((prev) => (prev + 1) % visible.length)}
                className="p-0.5 hover:text-white cursor-pointer"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {current.dismissible && (
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => handleDismiss(current.$id)}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-900/50 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
