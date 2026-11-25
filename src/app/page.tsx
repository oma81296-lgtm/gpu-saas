import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Lock,
  Rocket,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { BRAND, formatUsd } from "@/lib/brand";
import { fetchPublicNodes } from "@/lib/lium/client";
import { buildMarketplaceNodes, getActivePricingRules } from "@/lib/pricing";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/theme-toggle";

async function getStartingPrices() {
  try {
    const [feed, rules] = await Promise.all([
      fetchPublicNodes(),
      getActivePricingRules(),
    ]);
    const nodes = buildMarketplaceNodes(feed.nodes || [], rules);
    const byModel = new Map<
      string,
      { gpuModel: string; minPrice: number; vramGb: number; count: number }
    >();
    for (const n of nodes) {
      const existing = byModel.get(n.gpuModel);
      if (!existing) {
        byModel.set(n.gpuModel, {
          gpuModel: n.gpuModel,
          minPrice: n.retailPricePerGpuHr,
          vramGb: n.vramPerGpuGb,
          count: n.availableGpuCount,
        });
      } else {
        existing.minPrice = Math.min(existing.minPrice, n.retailPricePerGpuHr);
        existing.count += n.availableGpuCount;
      }
    }
    return Array.from(byModel.values())
      .sort((a, b) => a.minPrice - b.minPrice)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const models = await getStartingPrices();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-lg text-white">{BRAND.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/console">
              <Button variant="ghost" size="sm">
                Console
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm">
                Live GPUs
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Launch a GPU</Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        {/* Hero */}
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <Badge variant="emerald" className="px-3 py-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Dedicated Secure-Tier NVIDIA GPUs • Per-Second Billing
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Deploy High-Reliability GPUs in{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Seconds
            </span>
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            {BRAND.tagline}. Launch curated PyTorch, vLLM, ComfyUI, and Ollama
            templates—or bring your own Docker image—with strict prepaid credit
            controls and zero surprise invoices.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/marketplace">
              <Button size="lg">
                Browse Live GPUs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary" size="lg">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>

        {/* Live Pricing Ticker */}
        {models.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
                Live Secure-Tier Inventory
              </h2>
              <Link
                href="/marketplace"
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                View all nodes →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {models.map((m) => (
                <Card
                  key={m.gpuModel}
                  className="p-5 flex items-center justify-between hover:border-emerald-500/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-emerald-400" />
                      <span className="font-semibold text-white">
                        {m.gpuModel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {m.vramGb} GB VRAM • {m.count} GPUs available now
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                      {formatUsd(m.minPrice)}
                    </div>
                    <div className="text-[11px] text-zinc-500">per GPU / hr</div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Feature Grid */}
        <section className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Rocket className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">
              One-Click AI Apps & Custom Docker
            </h3>
            <p className="text-sm text-zinc-400">
              Start PyTorch, JupyterLab, vLLM, ComfyUI, or Ollama instantly—or
              pass any custom Docker image, environment variables, and ports.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Strict Prepaid Control
            </h3>
            <p className="text-sm text-zinc-400">
              Fund your wallet with prepaid packs ($10–$100), metered per
              second with automatic low-balance warnings and auto-stop at $0.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
              <Terminal className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Full Pod Lifecycle Controls
            </h3>
            <p className="text-sm text-zinc-400">
              Manage SSH keys, copy direct SSH commands, open Jupyter/HTTP
              endpoints, reboot containers, and trigger live GPU resets.
            </p>
          </Card>
        </section>
      </main>

      <footer className="border-t border-zinc-800/80 py-6 px-4 sm:px-6 lg:px-8 text-xs text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>
            © {new Date().getFullYear()} {BRAND.name}. Secure GPU Cloud.
          </span>
          <div className="flex flex-wrap gap-5">
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
