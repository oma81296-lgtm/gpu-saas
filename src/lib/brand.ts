export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "VoltGPU",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ||
    "On-Demand Secure NVIDIA GPUs, Billed Per Second",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
} as const;

export const MICRO_USD_PER_USD = 1_000_000;

export function usdToMicroUsd(usd: number): number {
  return Math.round(usd * MICRO_USD_PER_USD);
}

export function microUsdToUsd(microUsd: number): number {
  return microUsd / MICRO_USD_PER_USD;
}

export function formatUsd(usd: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(usd);
}

export function formatMicroUsd(microUsd: number, decimals = 2): string {
  return formatUsd(microUsdToUsd(microUsd), decimals);
}

export const CREDIT_PACKS = [
  {
    id: "pack_10",
    usd: 10,
    microUsd: 10 * MICRO_USD_PER_USD,
    label: "$10 Starter",
    description: "~18 hrs on RTX 4090 or ~4 hrs on H100",
    envKey: "CREEM_PRODUCT_10",
    defaultProductId: "prod_1VA4LJtHhT5Bb4aKZtXtZ",
  },
  {
    id: "pack_25",
    usd: 25,
    microUsd: 25 * MICRO_USD_PER_USD,
    label: "$25 Builder",
    description: "Great for fine-tuning & dev experiments",
    popular: true,
    envKey: "CREEM_PRODUCT_25",
    defaultProductId: "prod_3Iv37cf8hspUXfuxUSIFvS",
  },
  {
    id: "pack_50",
    usd: 50,
    microUsd: 50 * MICRO_USD_PER_USD,
    label: "$50 Pro",
    description: "Multi-GPU training & sustained inference",
    envKey: "CREEM_PRODUCT_50",
    defaultProductId: "prod_1sarjWBD98STIkb56qWvdp",
  },
  {
    id: "pack_100",
    usd: 100,
    microUsd: 100 * MICRO_USD_PER_USD,
    label: "$100 Scale",
    description: "High-throughput clusters & production workloads",
    envKey: "CREEM_PRODUCT_100",
    defaultProductId: "prod_5R8ONictJgbHNiAmtmygh9",
  },
] as const;
