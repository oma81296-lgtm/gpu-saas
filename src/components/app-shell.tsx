"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArchiveRestore,
  BarChart3,
  Cpu,
  CreditCard,
  HardDrive,
  KeyRound,
  KeySquare,
  LayoutDashboard,
  LogOut,
  Server,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { BRAND, formatMicroUsd } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth-provider";
import { NotificationBar } from "./notification-bar";
import { ThemeToggle } from "./theme-toggle";
import { UserProfileMenu } from "./user-profile-menu";
import { Badge, Button } from "./ui/primitives";
import { Separator } from "./ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "./ui/sidebar";

const CONSOLE_NAV = [
  { href: "/console", label: "Overview", icon: LayoutDashboard },
];

const COMPUTE_NAV = [
  { href: "/marketplace", label: "GPU Marketplace", icon: Cpu },
  { href: "/pods", label: "My Pods", icon: Server },
];

const STORAGE_NAV = [
  { href: "/volumes", label: "Volumes", icon: HardDrive },
  { href: "/backups", label: "Backups", icon: ArchiveRestore },
];

const DEVELOPERS_NAV = [
  { href: "/api-keys", label: "API Keys", icon: KeySquare },
  { href: "/ssh-keys", label: "SSH Keys", icon: KeyRound },
];

const BILLING_NAV = [
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/billing", label: "Billing & Credits", icon: CreditCard },
];

const PAGE_TITLES: Record<string, string> = {
  "/console": "Console Overview",
  "/marketplace": "GPU Marketplace",
  "/pods": "My Pods",
  "/volumes": "Persistent Volumes",
  "/backups": "Pod Backups & Restore",
  "/api-keys": "API Keys",
  "/ssh-keys": "SSH Keys",
  "/usage": "Pod Usage & Telemetry",
  "/billing": "Billing & Credits",
  "/account": "Account & Security",
  "/admin": "Operations Suite",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, mfaRequired, logout, configured } = useAuth();

  React.useEffect(() => {
    if (!loading && mfaRequired) {
      router.replace(
        pathname && pathname !== "/console"
          ? `/mfa-challenge?next=${encodeURIComponent(pathname)}`
          : "/mfa-challenge"
      );
    }
  }, [loading, mfaRequired, pathname, router]);

  const runwayHours =
    user && user.burnRateHrMicroUsd > 0
      ? user.balanceMicroUsd / user.burnRateHrMicroUsd
      : null;

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([prefix]) =>
      pathname.startsWith(prefix)
    )?.[1] || "Console";

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        className="border-r border-zinc-800/90 bg-zinc-950"
      >
        <SidebarHeader className="border-b border-zinc-800/80 p-2 py-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/console" />}
                tooltip={BRAND.name}
                className="hover:bg-zinc-900 group-data-[collapsible=icon]:mx-auto"
              >
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Zap className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-white">
                    {BRAND.name}
                  </span>
                  <span className="truncate text-[11px] text-emerald-400">
                    Secure GPU Cloud
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="py-2">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-zinc-500">
              Console
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {CONSOLE_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          active
                            ? "bg-emerald-500/15 text-emerald-300 font-medium"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        )}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-zinc-500">
              Compute
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {COMPUTE_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          active
                            ? "bg-emerald-500/15 text-emerald-300 font-medium"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        )}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-zinc-500">
              Storage
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {STORAGE_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          active
                            ? "bg-emerald-500/15 text-emerald-300 font-medium"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        )}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-zinc-500">
              Developers
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {DEVELOPERS_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          active
                            ? "bg-emerald-500/15 text-emerald-300 font-medium"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        )}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-zinc-500">
              Billing
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {BILLING_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          active
                            ? "bg-emerald-500/15 text-emerald-300 font-medium"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        )}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {user?.role === "admin" && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-violet-400/80">
                Operator
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/admin" />}
                      isActive={pathname.startsWith("/admin")}
                      tooltip="Operations Suite"
                      className={cn(
                        pathname.startsWith("/admin")
                          ? "bg-violet-500/20 text-violet-200 font-medium"
                          : "text-violet-400 hover:text-violet-200 hover:bg-zinc-900"
                      )}
                    >
                      <ShieldCheck />
                      <span>Operations Suite</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-zinc-800/80 p-2 space-y-2">
          {user ? (
            <>
              <Link
                href="/billing"
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs hover:border-emerald-500/40 transition-colors group-data-[collapsible=icon]:hidden"
              >
                <div className="flex items-center gap-2 text-zinc-400">
                  <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Credits</span>
                </div>
                <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                  {formatMicroUsd(user.balanceMicroUsd)}
                </span>
              </Link>
              <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:justify-center">
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <div className="truncate text-xs font-medium text-zinc-200">
                    {user.name || "Account"}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {user.email}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await logout();
                    router.push("/login");
                  }}
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4 text-zinc-400" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
              <Link href="/login">
                <Button variant="secondary" size="sm" className="w-full">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="w-full">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-zinc-950 text-zinc-100">
        {/* Console Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-800/90 bg-zinc-950/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5">
            <SidebarTrigger className="text-zinc-400 hover:text-white" />
            <Separator orientation="vertical" className="h-4 bg-zinc-800" />
            <span className="text-sm font-medium text-zinc-200">
              {pageTitle}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {user && (
              <Link
                href="/billing"
                className="hidden sm:flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs hover:border-emerald-500/40 transition-colors"
              >
                <span className="text-zinc-400">Balance</span>
                <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                  {formatMicroUsd(user.balanceMicroUsd)}
                </span>
                {runwayHours !== null && (
                  <Badge
                    variant={runwayHours < 0.25 ? "red" : "default"}
                    className="font-mono text-[10px]"
                  >
                    {runwayHours.toFixed(1)}h left
                  </Badge>
                )}
              </Link>
            )}
            <ThemeToggle />
            <UserProfileMenu />
          </div>
        </header>

        <NotificationBar />

        {!configured && (
          <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
            Appwrite credentials are not configured in <code>.env.local</code> yet.
          </div>
        )}

        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
