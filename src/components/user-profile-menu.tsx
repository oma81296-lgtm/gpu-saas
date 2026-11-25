"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  KeyRound,
  LogOut,
  Server,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { APPWRITE_CONFIG } from "@/lib/appwrite/config";
import { formatMicroUsd } from "@/lib/brand";
import { GitHubIcon, GoogleIcon } from "./auth/oauth-buttons";
import { useAuth } from "./auth-provider";
import { Badge, Button } from "./ui/primitives";
import { Skeleton } from "./ui/skeleton";

function getInitials(name?: string, email?: string): string {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getAvatarUrl(name?: string, email?: string): string | null {
  if (!APPWRITE_CONFIG.projectId) return null;
  const label = encodeURIComponent(name || email || "User");
  return `${APPWRITE_CONFIG.endpoint}/avatars/initials?name=${label}&width=80&height=80&background=065f46&project=${encodeURIComponent(
    APPWRITE_CONFIG.projectId
  )}`;
}

export function UserProfileMenu() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (loading) {
    return <Skeleton className="h-8 w-8 rounded-full bg-zinc-800/80" />;
  }

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="secondary" size="sm">
          Sign in
        </Button>
      </Link>
    );
  }

  const initials = getInitials(user.name, user.email);
  const avatarUrl = !imgError ? getAvatarUrl(user.name, user.email) : null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="group flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 p-0.5 pr-2 transition-all hover:border-emerald-500/50 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 cursor-pointer"
      >
        <div className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden ring-1 ring-emerald-500/30 bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-zinc-900 flex items-center justify-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={user.name || user.email}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-semibold tracking-tight text-emerald-200">
              {initials}
            </span>
          )}
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-150 group-hover:text-zinc-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-68 origin-top-right rounded-xl border border-zinc-800/90 bg-zinc-950/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl z-50 space-y-2"
        >
          {/* Profile Identity Header */}
          <div className="flex items-center gap-3 px-2 py-2 border-b border-zinc-800/80">
            <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden ring-1 ring-emerald-500/30 bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-zinc-900 flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={user.name || user.email}
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-emerald-200">
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-white">
                  {user.name || "Account"}
                </p>
                <Badge
                  variant={user.role === "admin" ? "violet" : "emerald"}
                  className="px-1.5 py-0 text-[10px] capitalize"
                >
                  {user.role}
                </Badge>
                {user.auth?.mfaEnabled && (
                  <Badge
                    variant="cyan"
                    className="px-1.5 py-0 text-[10px]"
                    title="Two-Factor Authentication Enabled"
                  >
                    2FA
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-zinc-400">{user.email}</p>
            </div>
          </div>

          {/* Account Summary */}
          <div className="space-y-1.5 px-1 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                Balance
              </span>
              <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                {formatMicroUsd(user.balanceMicroUsd)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Server className="h-3.5 w-3.5 text-cyan-400" />
                Active Pods
              </span>
              <span className="font-mono text-zinc-200 tabular-nums">
                {user.activePodCount} / {user.maxConcurrentPods}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(user.userId);
                toast.success("Account ID copied!");
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <span className="font-mono truncate">ID: {user.userId}</span>
              <Copy className="h-3 w-3 shrink-0 ml-2" />
            </button>
          </div>

          {/* Connected Sign-In Methods */}
          {user.auth && (
            <div className="border-t border-zinc-800/80 pt-2 px-1 space-y-1.5">
              <p className="px-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Connected Accounts
              </p>
              <div className="flex flex-wrap items-center gap-1.5 px-1.5">
                {user.auth.hasPassword && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-300">
                    <KeyRound className="h-3 w-3 text-emerald-400" />
                    Email
                  </span>
                )}
                {user.auth.identities.some((i) => i.provider === "github") && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-300">
                    <GitHubIcon className="h-3 w-3" />
                    GitHub
                  </span>
                )}
                {user.auth.identities.some((i) => i.provider === "google") && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-300">
                    <GoogleIcon className="h-3 w-3" />
                    Google
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Account & Sign Out */}
          <div className="border-t border-zinc-800/80 pt-1.5 space-y-0.5">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Account &amp; Security
            </Link>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await logout();
                router.push("/login");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
