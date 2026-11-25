"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Cpu, Globe, RefreshCw, Search, ShieldCheck, Zap } from "lucide-react";
import type { CuratedTemplateDoc } from "@/lib/appwrite/config";
import type { MarketplaceGpuNode } from "@/lib/lium/types";
import { formatUsd } from "@/lib/brand";
import { AppShell } from "@/components/app-shell";
import { DeployDrawer } from "@/components/deploy-drawer";
import { Badge, Button, Card, Input, Select } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketplacePage() {
  const [nodes, setNodes] = useState<MarketplaceGpuNode[]>([]);
  const [templates, setTemplates] = useState<CuratedTemplateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [gpuFilter, setGpuFilter] = useState("ALL");
  const [gpuCountFilter, setGpuCountFilter] = useState(0);
  const [minVram, setMinVram] = useState(0);
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "vram_desc" | "rel_desc">(
    "price_asc"
  );

  const [selectedNode, setSelectedNode] = useState<MarketplaceGpuNode | null>(
    null
  );

  async function loadData(forceRefresh = false) {
    setLoading(true);
    try {
      const [gpuRes, tplRes] = await Promise.all([
        fetch(`/api/gpus${forceRefresh ? "?refresh=1" : ""}`),
        fetch("/api/templates"),
      ]);
      const gpuData = (await gpuRes.json()) as {
        nodes?: MarketplaceGpuNode[];
        generatedAt?: string;
      };
      const tplData = (await tplRes.json()) as {
        templates?: CuratedTemplateDoc[];
      };
      setNodes(gpuData.nodes || []);
      setGeneratedAt(gpuData.generatedAt || null);
      setTemplates(tplData.templates || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const uniqueModels = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.gpuModel))).sort(),
    [nodes]
  );

  const uniqueCounts = useMemo(
    () =>
      Array.from(
        new Set(nodes.map((n) => n.availableGpuCount).filter((c) => c > 0))
      ).sort((a, b) => a - b),
    [nodes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes
      .filter((n) => {
        if (gpuFilter !== "ALL" && n.gpuModel !== gpuFilter) return false;
        if (gpuCountFilter > 0 && n.availableGpuCount !== gpuCountFilter) {
          return false;
        }
        if (n.vramPerGpuGb < minVram) return false;
        if (
          q &&
          !`${n.gpuModel} ${n.country} ${n.city} ${n.interconnect || ""}`
            .toLowerCase()
            .includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.retailPricePerGpuHr - b.retailPricePerGpuHr;
        if (sortBy === "price_desc") return b.retailPricePerGpuHr - a.retailPricePerGpuHr;
        if (sortBy === "vram_desc") return b.vramPerGpuGb - a.vramPerGpuGb;
        return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
      });
  }, [nodes, gpuFilter, gpuCountFilter, minVram, search, sortBy]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                GPU Marketplace
              </h1>
              <Badge variant="emerald">
                <ShieldCheck className="h-3 w-3" />
                Secure Tier Only
              </Badge>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              {filtered.length} dedicated nodes ready for instant deployment
              {generatedAt ? ` • updated ${new Date(generatedAt).toLocaleTimeString()}` : ""}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadData(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Inventory
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search GPU, city, country..."
                className="pl-9"
              />
            </div>

            <Select
              value={gpuFilter}
              onChange={(e) => setGpuFilter(e.target.value)}
            >
              <option value="ALL">All GPU Models</option>
              {uniqueModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>

            <Select
              value={String(gpuCountFilter)}
              onChange={(e) => setGpuCountFilter(Number(e.target.value))}
            >
              <option value="0">Any GPU Count</option>
              {uniqueCounts.map((cnt) => (
                <option key={cnt} value={cnt}>
                  {cnt}x {cnt === 1 ? "GPU" : "GPUs"}
                </option>
              ))}
            </Select>

            <Select
              value={String(minVram)}
              onChange={(e) => setMinVram(Number(e.target.value))}
            >
              <option value="0">Any VRAM</option>
              <option value="24">≥ 24 GB VRAM</option>
              <option value="48">≥ 48 GB VRAM</option>
              <option value="80">≥ 80 GB VRAM</option>
            </Select>

            <Select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    | "price_asc"
                    | "price_desc"
                    | "vram_desc"
                    | "rel_desc"
                )
              }
            >
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="vram_desc">VRAM: High to Low</option>
              <option value="rel_desc">Reliability: Highest</option>
            </Select>
          </div>
        </Card>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32 bg-zinc-800/80" />
                      <Skeleton className="h-3 w-24 bg-zinc-800/80" />
                    </div>
                    <Skeleton className="h-6 w-16 bg-zinc-800/80" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-800/80 p-2.5">
                    <Skeleton className="h-8 w-full bg-zinc-800/80" />
                    <Skeleton className="h-8 w-full bg-zinc-800/80" />
                    <Skeleton className="h-8 w-full bg-zinc-800/80" />
                  </div>
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-20 bg-zinc-800/80" />
                    <Skeleton className="h-5 w-16 bg-zinc-800/80" />
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <Skeleton className="h-3 w-24 bg-zinc-800/80" />
                  <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800/80" />
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-zinc-400">
            No Secure-tier GPUs match your current filters.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((node) => (
              <Card
                key={node.id}
                className="p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 shrink-0 text-emerald-400" />
                        <h3 className="flex flex-wrap items-baseline gap-1.5 font-semibold text-white">
                          <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[1.08rem] font-bold leading-none text-emerald-300 tabular-nums">
                            {node.availableGpuCount}x
                          </span>
                          <span>{node.gpuModel}</span>
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {node.city ? `${node.city}, ${node.country}` : node.country}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                        {formatUsd(node.retailPricePerGpuHr)}
                      </div>
                      <div className="text-[11px] text-zinc-500">per GPU / hr</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80 p-2.5 text-center">
                    <div>
                      <div className="text-[11px] text-zinc-500">VRAM</div>
                      <div className="text-xs font-mono font-medium text-zinc-200">
                        {node.vramPerGpuGb} GB
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-zinc-500">vCPU / RAM</div>
                      <div className="text-xs font-mono font-medium text-zinc-200">
                        {node.cpuCount}c / {node.ramGb}G
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-zinc-500">Disk</div>
                      <div className="text-xs font-mono font-medium text-zinc-200">
                        {Math.round(node.diskFreeGb)} GB
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {node.minRentableGpuCount < node.availableGpuCount && (
                      <Badge variant="violet">
                        Flexible {node.minRentableGpuCount}–{node.availableGpuCount}x
                      </Badge>
                    )}
                    {node.reliabilityScore !== null && (
                      <Badge variant="emerald">
                        {node.reliabilityScore.toFixed(1)}% uptime
                      </Badge>
                    )}
                    {node.interconnect && (
                      <Badge variant="cyan">
                        {node.interconnect.toUpperCase()}
                      </Badge>
                    )}
                    {node.cudaDriver && (
                      <Badge>CUDA {node.cudaDriver}</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-mono">
                    Node: {formatUsd(node.retailPricePerNodeHr)}/hr
                  </span>
                  <Button size="sm" onClick={() => setSelectedNode(node)}>
                    <Zap className="h-3.5 w-3.5" />
                    Deploy
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <DeployDrawer
        node={selectedNode}
        templates={templates}
        onClose={() => setSelectedNode(null)}
      />
    </AppShell>
  );
}
