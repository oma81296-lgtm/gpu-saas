import React from "react";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "./theme-toggle";

export function LegalShell({
  title,
  updatedAt = "November 2026",
  children,
}: {
  title: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-lg text-white">{BRAND.name}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/console"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Console
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <div className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <p className="text-xs text-zinc-500 mt-2">
            Last updated: {updatedAt} • Applies to all {BRAND.name} services
          </p>
        </div>

        <article className="space-y-6 text-sm leading-relaxed text-zinc-300 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          {children}
        </article>
      </main>

      <footer className="border-t border-zinc-800/80 py-6 px-4 sm:px-6 lg:px-8 text-xs text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </span>
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-zinc-200">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-zinc-200">
              Privacy Policy
            </Link>
            <Link href="/refunds" className="hover:text-zinc-200">
              Refund Policy
            </Link>
            <Link href="/aup" className="hover:text-zinc-200">
              Acceptable Use &amp; Export Control
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
