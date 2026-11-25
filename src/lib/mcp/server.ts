import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import {
  APPWRITE_CONFIG,
  CuratedTemplateDoc,
  PodDoc,
  SshKeyDoc,
} from "@/lib/appwrite/config";
import {
  AuthenticatedContext,
  createAdminAppwrite,
} from "@/lib/appwrite/server";
import { BRAND, microUsdToUsd, usdToMicroUsd } from "@/lib/brand";
import { assertAllowedWorkload } from "@/lib/compliance";
import { decodeGpuId, encodeGpuId } from "@/lib/gpu-id";
import { applyLedgerTransaction } from "@/lib/ledger";
import {
  createTemporaryTemplate,
  deleteLiumPod,
  fetchPublicNodes,
  getLiumPod,
  isLiumConfigured,
  listLiumPods,
  LiumApiError,
  rentPod,
} from "@/lib/lium/client";
import { buildMarketplaceNodes, getActivePricingRules } from "@/lib/pricing";

const FALLBACK_TEMPLATES: Array<
  Pick<
    CuratedTemplateDoc,
    | "slug"
    | "name"
    | "category"
    | "description"
    | "lium_template_id"
    | "docker_image"
    | "default_ports"
    | "min_vram_gb"
  >
> = [
  {
    slug: "pytorch-cuda13",
    name: "PyTorch 2.12 + CUDA 13.0 (DinD)",
    category: "base",
    description:
      "Official PyTorch 2.12 environment on Ubuntu 24.04 with CUDA 13.0 and Docker-in-Docker.",
    lium_template_id: "bb50bd64-e363-4adc-8111-1d44c8e36807",
    docker_image:
      "daturaai/pytorch:2.12.0-py3.12-cuda13.0.2-devel-ubuntu24.04-dind-lium1",
    default_ports: "22,8888",
    min_vram_gb: 16,
  },
  {
    slug: "pytorch-cuda128",
    name: "PyTorch 2.11 + CUDA 12.8",
    category: "notebook",
    description:
      "Stable PyTorch 2.11 with CUDA 12.8 and JupyterLab ready for training, fine-tuning, and notebooks.",
    lium_template_id: "cbc0ffdc-aa35-441a-abaa-170a87c51a64",
    docker_image:
      "daturaai/pytorch:2.11.0-py3.12-cuda12.8-devel-ubuntu24.04-dind-lium1",
    default_ports: "22,8888",
    min_vram_gb: 16,
  },
  {
    slug: "cuda-devel",
    name: "NVIDIA CUDA 13.0 Devel (Ubuntu)",
    category: "base",
    description:
      "Clean Ubuntu 22.04 with full nvcc CUDA toolkit for custom C++/CUDA builds.",
    lium_template_id: "30612657-5da8-4c89-84af-0edd12bbc47c",
    docker_image: "nvidia/cuda:13.0.3-devel-ubuntu22.04",
    default_ports: "22",
    min_vram_gb: 8,
  },
  {
    slug: "vllm-openai",
    name: "vLLM OpenAI-Compatible Server",
    category: "ai_app",
    description:
      "High-throughput LLM serving with OpenAI-compatible API on port 8000.",
    lium_template_id: "custom:vllm/vllm-openai:latest",
    docker_image: "vllm/vllm-openai:latest",
    default_ports: "22,8000",
    min_vram_gb: 24,
  },
  {
    slug: "comfyui",
    name: "ComfyUI Studio",
    category: "ai_app",
    description:
      "Node-based Diffusion / Flux / Video generation UI pre-configured on port 8188.",
    lium_template_id: "custom:yanwk/comfyui-boot:cu124-slim",
    docker_image: "yanwk/comfyui-boot:cu124-slim",
    default_ports: "22,8188",
    min_vram_gb: 16,
  },
  {
    slug: "ollama",
    name: "Ollama LLM Runner",
    category: "ai_app",
    description:
      "Run Llama 3, DeepSeek, Qwen, and Mistral models with one command over port 11434.",
    lium_template_id: "custom:ollama/ollama:latest",
    docker_image: "ollama/ollama:latest",
    default_ports: "22,11434",
    min_vram_gb: 16,
  },
];

function mapLiumStatus(status: string): PodDoc["status"] {
  const s = (status || "").toLowerCase();
  if (s === "running" || s === "active" || s === "ready") return "running";
  if (s === "starting" || s === "creating" || s === "pending" || s === "pulling")
    return "starting";
  if (s === "stopping" || s === "terminating") return "stopping";
  if (s === "failed" || s === "error") return "failed";
  return "stopped";
}

function parseImageAndTag(fullImage: string): { image: string; tag: string } {
  const trimmed = fullImage.trim();
  const lastColon = trimmed.lastIndexOf(":");
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastColon > lastSlash) {
    return {
      image: trimmed.slice(0, lastColon),
      tag: trimmed.slice(lastColon + 1) || "latest",
    };
  }
  return { image: trimmed, tag: "latest" };
}

/**
 * Generates an ephemeral RFC-compliant OpenSSH ed25519 public key so users
 * without saved SSH keys can still launch Jupyter / web-app pods via AI agents.
 */
function generateEphemeralSshPublicKey(): string {
  if (process.env.PLATFORM_FALLBACK_SSH_PUBLIC_KEY) {
    return process.env.PLATFORM_FALLBACK_SSH_PUBLIC_KEY.trim();
  }
  const { publicKey } = crypto.generateKeyPairSync("ed25519");
  const spki = publicKey.export({ format: "der", type: "spki" });
  const rawPub = spki.subarray(spki.length - 32);
  const typeBuf = Buffer.from("ssh-ed25519", "utf8");
  const typeLen = Buffer.alloc(4);
  typeLen.writeUInt32BE(typeBuf.length, 0);
  const keyLen = Buffer.alloc(4);
  keyLen.writeUInt32BE(rawPub.length, 0);
  const wire = Buffer.concat([typeLen, typeBuf, keyLen, rawPub]);
  return `ssh-ed25519 ${wire.toString("base64")} voltgpu-web-only`;
}

function jsonText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

function formatPodForAgent(pod: PodDoc) {
  let ports: Record<string, unknown> | null = null;
  if (pod.ports_json) {
    try {
      ports = JSON.parse(pod.ports_json) as Record<string, unknown>;
    } catch {
      ports = null;
    }
  }
  return {
    podId: pod.$id,
    name: pod.name,
    status: pod.status,
    gpuModel: pod.gpu_model,
    gpuCount: pod.gpu_count,
    templateName: pod.template_name || pod.custom_image || "Custom",
    hourlyRateUsd: Number(microUsdToUsd(pod.retail_rate_hr_micro_usd).toFixed(2)),
    totalBilledUsd: Number(microUsdToUsd(pod.total_billed_micro_usd).toFixed(4)),
    jupyterUrl: pod.jupyter_url || null,
    sshCommand: pod.ssh_command || null,
    ports,
    startedAt: pod.started_at,
    stoppedAt: pod.stopped_at || null,
    stopReason: pod.stop_reason || null,
  };
}

async function loadCuratedTemplates() {
  try {
    const { databases } = createAdminAppwrite();
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.curatedTemplates,
      [
        Query.equal("enabled", true),
        Query.orderAsc("sort_order"),
        Query.limit(50),
      ]
    );
    if (res.documents.length > 0) {
      return res.documents as unknown as CuratedTemplateDoc[];
    }
  } catch {
    // Fall back to built-in curated list
  }
  return FALLBACK_TEMPLATES;
}

export function createVoltGpuMcpServer(ctx: AuthenticatedContext): McpServer {
  const server = new McpServer({
    name: `${BRAND.name.toLowerCase().replace(/\s+/g, "-")}-mcp`,
    version: "1.0.0",
  });

  // 1. get_balance
  server.tool(
    "get_balance",
    `Check the user's ${BRAND.name} credit balance, active pod count, hourly spend rate, and estimated runway.`,
    {},
    async () => {
      try {
        const { databases } = createAdminAppwrite();
        const activeRes = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.pods,
          [
            Query.equal("user_id", ctx.userId),
            Query.equal("status", ["starting", "running"]),
            Query.limit(50),
          ]
        );
        const activePods = activeRes.documents as unknown as PodDoc[];
        const burnRateHrMicro = activePods.reduce(
          (sum, p) => sum + (p.retail_rate_hr_micro_usd || 0),
          0
        );
        const balanceUsd = microUsdToUsd(ctx.profile.balance_micro_usd);
        const burnRateHrUsd = microUsdToUsd(burnRateHrMicro);
        const runwayHours =
          burnRateHrUsd > 0 ? Number((balanceUsd / burnRateHrUsd).toFixed(2)) : null;

        return jsonText({
          balanceUsd: Number(balanceUsd.toFixed(2)),
          activePodCount: activePods.length,
          maxConcurrentPods: ctx.profile.max_concurrent_pods,
          currentHourlyBurnUsd: Number(burnRateHrUsd.toFixed(2)),
          estimatedRunwayHours: runwayHours,
          billingUrl: `${BRAND.appUrl}/billing`,
        });
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : "Failed to fetch balance"
        );
      }
    }
  );

  // 2. list_gpus
  server.tool(
    "list_gpus",
    `Search available Secure-tier NVIDIA GPUs on ${BRAND.name} with live hourly pricing. Always call this before deploy_pod to get a valid gpuId. Use gpuId internally when calling deploy_pod and omit raw gpuId strings from user-facing tables unless the user explicitly asks for them.`,
    {
      gpu_model: z
        .string()
        .optional()
        .describe("Filter by GPU model substring, e.g. '4090', 'H100', 'A100', 'L40S'"),
      min_vram_gb: z
        .number()
        .optional()
        .describe("Minimum VRAM per GPU in GB, e.g. 24 or 80"),
      max_price_per_hr: z
        .number()
        .optional()
        .describe("Maximum total hourly price in USD"),
      gpu_count: z
        .number()
        .int()
        .min(1)
        .max(16)
        .optional()
        .describe("Filter for nodes with at least this many available GPUs"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(15)
        .describe("Maximum number of GPU options to return (default 15)"),
    },
    async (args) => {
      try {
        const [feed, rules] = await Promise.all([
          fetchPublicNodes(),
          getActivePricingRules(),
        ]);
        let nodes = buildMarketplaceNodes(feed.nodes || [], rules);

        if (args.gpu_model) {
          const q = args.gpu_model.toLowerCase();
          nodes = nodes.filter((n) => n.gpuModel.toLowerCase().includes(q));
        }
        if (args.min_vram_gb !== undefined) {
          nodes = nodes.filter((n) => n.vramPerGpuGb >= args.min_vram_gb!);
        }
        if (args.gpu_count !== undefined) {
          nodes = nodes.filter((n) => n.availableGpuCount >= args.gpu_count!);
        }
        if (args.max_price_per_hr !== undefined) {
          nodes = nodes.filter(
            (n) => n.retailPricePerNodeHr <= args.max_price_per_hr!
          );
        }

        nodes.sort((a, b) => a.retailPricePerNodeHr - b.retailPricePerNodeHr);
        const limited = nodes.slice(0, args.limit ?? 15).map((n) => ({
          gpuId: encodeGpuId(n.id),
          gpuModel: n.gpuModel,
          availableGpuCount: n.availableGpuCount,
          vramPerGpuGb: n.vramPerGpuGb,
          cpuCount: n.cpuCount,
          ramGb: n.ramGb,
          diskFreeGb: n.diskFreeGb,
          country: n.country,
          city: n.city,
          reliabilityScore: n.reliabilityScore,
          retailPricePerGpuHr: Number(n.retailPricePerGpuHr.toFixed(2)),
          retailPricePerNodeHr: Number(n.retailPricePerNodeHr.toFixed(2)),
        }));

        return jsonText({
          totalMatching: nodes.length,
          showing: limited.length,
          nodes: limited,
        });
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : "Failed to list GPUs"
        );
      }
    }
  );

  // 3. list_templates
  server.tool(
    "list_templates",
    `List ready-to-run 1-click GPU templates (ComfyUI, vLLM, Ollama, PyTorch, CUDA) that can be passed to deploy_pod via template_slug.`,
    {},
    async () => {
      try {
        const templates = await loadCuratedTemplates();
        return jsonText({
          templates: templates.map((t) => ({
            slug: t.slug,
            name: t.name,
            category: t.category,
            description: t.description,
            minVramGb: t.min_vram_gb,
            defaultPorts: t.default_ports || "22",
            dockerImage: t.docker_image || null,
          })),
        });
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : "Failed to list templates"
        );
      }
    }
  );

  // 4. list_pods
  server.tool(
    "list_pods",
    `List the user's GPU pods on ${BRAND.name}, syncing live status, Jupyter URLs, ports, and SSH details for active pods.`,
    {
      active_only: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, only return starting/running pods"),
    },
    async (args) => {
      try {
        const { databases } = createAdminAppwrite();
        const queries = [
          Query.equal("user_id", ctx.userId),
          Query.orderDesc("started_at"),
          Query.limit(50),
        ];
        if (args.active_only) {
          queries.push(Query.equal("status", ["starting", "running"]));
        }

        const res = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.pods,
          queries
        );
        const pods = res.documents as unknown as PodDoc[];
        const activeLocal = pods.filter(
          (p) => p.status === "starting" || p.status === "running"
        );

        if (activeLocal.length > 0 && isLiumConfigured()) {
          try {
            const livePods = await listLiumPods();
            const liveMap = new Map(livePods.map((lp) => [lp.id, lp]));
            await Promise.all(
              activeLocal.map(async (pod) => {
                const live = liveMap.get(pod.lium_pod_id);
                if (!live) return;
                const nextStatus = mapLiumStatus(live.status);
                const nextSsh =
                  live.ssh_connect_cmd ||
                  live.starting_ssh_connect_cmd ||
                  pod.ssh_command ||
                  null;
                const nextJupyter = live.jupyter_url || pod.jupyter_url || null;
                const nextPorts = live.ports_mapping
                  ? JSON.stringify(live.ports_mapping)
                  : pod.ports_json || null;

                if (
                  nextStatus !== pod.status ||
                  nextSsh !== pod.ssh_command ||
                  nextJupyter !== pod.jupyter_url ||
                  nextPorts !== pod.ports_json
                ) {
                  await databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.pods,
                    pod.$id,
                    {
                      status: nextStatus,
                      ssh_command: nextSsh,
                      jupyter_url: nextJupyter,
                      ports_json: nextPorts,
                    }
                  );
                  pod.status = nextStatus;
                  pod.ssh_command = nextSsh;
                  pod.jupyter_url = nextJupyter;
                  pod.ports_json = nextPorts;
                }
              })
            );
          } catch {
            // Non-fatal: return last known DB state
          }
        }

        return jsonText({
          count: pods.length,
          pods: pods.map(formatPodForAgent),
        });
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : "Failed to list pods"
        );
      }
    }
  );

  // 5. get_pod
  server.tool(
    "get_pod",
    "Get live status, Jupyter URL, mapped ports, SSH command, and billing details for a specific pod.",
    {
      pod_id: z.string().min(1).describe("The podId returned by deploy_pod or list_pods"),
    },
    async (args) => {
      try {
        const { databases } = createAdminAppwrite();
        const pod = (await databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.pods,
          args.pod_id
        )) as unknown as PodDoc;

        if (pod.user_id !== ctx.userId) {
          return errorResult("Pod not found or access denied.");
        }

        if (
          (pod.status === "starting" || pod.status === "running") &&
          isLiumConfigured()
        ) {
          try {
            const live = await getLiumPod(pod.lium_pod_id);
            const nextStatus = mapLiumStatus(live.status);
            const nextSsh =
              live.ssh_connect_cmd ||
              live.starting_ssh_connect_cmd ||
              pod.ssh_command ||
              null;
            const nextJupyter = live.jupyter_url || pod.jupyter_url || null;
            const nextPorts = live.ports_mapping
              ? JSON.stringify(live.ports_mapping)
              : pod.ports_json || null;

            if (
              nextStatus !== pod.status ||
              nextSsh !== pod.ssh_command ||
              nextJupyter !== pod.jupyter_url ||
              nextPorts !== pod.ports_json
            ) {
              await databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.pods,
                pod.$id,
                {
                  status: nextStatus,
                  ssh_command: nextSsh,
                  jupyter_url: nextJupyter,
                  ports_json: nextPorts,
                }
              );
              pod.status = nextStatus;
              pod.ssh_command = nextSsh;
              pod.jupyter_url = nextJupyter;
              pod.ports_json = nextPorts;
            }
          } catch {
            // Non-fatal sync error
          }
        }

        return jsonText({ pod: formatPodForAgent(pod) });
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : "Failed to fetch pod"
        );
      }
    }
  );

  // 6. deploy_pod
  server.tool(
    "deploy_pod",
    `Rent and launch a Secure-tier GPU pod on ${BRAND.name}. Billing starts per second immediately on launch. Always confirm GPU choice and hourly cost with the user before calling this tool.`,
    {
      gpu_id: z
        .string()
        .min(1)
        .describe("The opaque gpuId returned by list_gpus"),
      pod_name: z
        .string()
        .trim()
        .min(2)
        .max(64)
        .regex(
          /^[a-zA-Z0-9._-]+$/,
          "Use only letters, numbers, dots, underscores, or hyphens"
        )
        .describe("Human-friendly pod name, e.g. 'comfyui-flux-1'"),
      template_slug: z
        .string()
        .optional()
        .describe(
          "Slug of a curated template from list_templates (e.g. 'comfyui', 'vllm-openai', 'ollama', 'pytorch-cuda13'). Defaults to 'pytorch-cuda13' if neither template_slug nor custom_docker_image is provided."
        ),
      custom_docker_image: z
        .string()
        .trim()
        .optional()
        .describe("Optional custom Docker image (e.g. 'vllm/vllm-openai:latest')"),
      gpu_count: z
        .number()
        .int()
        .min(1)
        .max(16)
        .optional()
        .describe("Number of GPUs to rent on this node"),
      enable_jupyter: z
        .boolean()
        .optional()
        .default(true)
        .describe("Enable browser JupyterLab URL (default true)"),
      custom_ports: z
        .array(z.number().int().min(1).max(65535))
        .optional()
        .describe("Ports to expose when using a custom Docker image"),
      env_vars: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables for custom Docker image workloads"),
      startup_commands: z
        .string()
        .max(2000)
        .optional()
        .describe("Optional shell command to run on container startup"),
    },
    async (args) => {
      try {
        assertAllowedWorkload({
          customDockerImage: args.custom_docker_image,
          startupCommands: args.startup_commands,
          customEnvVars: args.env_vars,
        });

        const { databases } = createAdminAppwrite();
        const { databaseId, collections } = APPWRITE_CONFIG;

        // 1. Concurrency guardrail
        const activeRes = await databases.listDocuments(
          databaseId,
          collections.pods,
          [
            Query.equal("user_id", ctx.userId),
            Query.equal("status", ["starting", "running"]),
            Query.limit(50),
          ]
        );
        if (activeRes.total >= ctx.profile.max_concurrent_pods) {
          return errorResult(
            `Concurrent pod limit reached (${ctx.profile.max_concurrent_pods}). Stop an existing pod with stop_pod first.`
          );
        }

        // 2. Verify node availability & compute retail rate
        const resolvedExecutorId = decodeGpuId(args.gpu_id);
        if (!resolvedExecutorId) {
          return errorResult(
            "Invalid gpu_id. Call list_gpus again to pick an available GPU."
          );
        }

        const [feed, rules] = await Promise.all([
          fetchPublicNodes(),
          getActivePricingRules(),
        ]);
        const secureNodes = buildMarketplaceNodes(feed.nodes || [], rules);
        const node = secureNodes.find((n) => n.id === resolvedExecutorId);
        if (!node) {
          return errorResult(
            "Selected GPU node is no longer available. Call list_gpus again to pick an available GPU."
          );
        }

        const gpuCount = args.gpu_count || node.availableGpuCount;
        const wholesaleHrMicro = usdToMicroUsd(
          node.wholesalePricePerGpuHr * gpuCount
        );
        const retailHrMicro = usdToMicroUsd(node.retailPricePerGpuHr * gpuCount);

        // 3. Enforce prepaid 30-min launch buffer
        const minRequiredMicro = Math.ceil(retailHrMicro * 0.5);
        if (ctx.profile.balance_micro_usd < minRequiredMicro) {
          const neededUsd = microUsdToUsd(minRequiredMicro).toFixed(2);
          const currentUsd = microUsdToUsd(ctx.profile.balance_micro_usd).toFixed(2);
          return errorResult(
            `Insufficient credits. Launching this pod requires at least $${neededUsd} (30-min buffer), but balance is $${currentUsd}. Top up at ${BRAND.appUrl}/billing.`
          );
        }

        // 5. Auto-resolve user's SSH keys (or use ephemeral key for zero-SSH vibe coders)
        const sshRes = await databases.listDocuments(
          databaseId,
          collections.sshKeys,
          [Query.equal("user_id", ctx.userId), Query.limit(20)]
        );
        const savedSshKeys = (sshRes.documents as unknown as SshKeyDoc[]).map(
          (k) => k.public_key
        );
        const usedFallbackSshKey = savedSshKeys.length === 0;
        const publicKeys = usedFallbackSshKey
          ? [generateEphemeralSshPublicKey()]
          : savedSshKeys;

        // 6. Resolve template
        let resolvedTemplateId = "";
        let templateLabel = "Custom";
        let templateDockerImage: string | null = null;
        let customImageUsed: string | null = null;
        let defaultPorts: number[] = [22, 8888];

        if (args.custom_docker_image) {
          resolvedTemplateId = `custom:${args.custom_docker_image}`;
          templateLabel = args.custom_docker_image;
          templateDockerImage = args.custom_docker_image;
        } else {
          const templates = await loadCuratedTemplates();
          const slug = (args.template_slug || "pytorch-cuda13").toLowerCase();
          const matched = templates.find((t) => t.slug.toLowerCase() === slug);
          if (!matched) {
            return errorResult(
              `Unknown template_slug '${slug}'. Call list_templates to see valid slugs.`
            );
          }
          resolvedTemplateId = matched.lium_template_id;
          templateLabel = matched.name;
          templateDockerImage = matched.docker_image || null;
          if (matched.default_ports) {
            const parsed = matched.default_ports
              .split(",")
              .map((p) => Number(p.trim()))
              .filter((p) => Number.isInteger(p) && p > 0 && p <= 65535);
            if (parsed.length > 0) defaultPorts = parsed;
          }
        }

        const needsTempTemplate =
          Boolean(args.custom_docker_image) ||
          resolvedTemplateId.startsWith("custom:") ||
          Boolean(args.startup_commands) ||
          Boolean(args.env_vars && Object.keys(args.env_vars).length > 0);

        if (needsTempTemplate) {
          const rawImage =
            args.custom_docker_image ||
            templateDockerImage ||
            resolvedTemplateId.replace(/^custom:/, "");
          const { image, tag } = parseImageAndTag(rawImage);
          customImageUsed = `${image}:${tag}`;
          const tempTpl = await createTemporaryTemplate({
            name: `voltgpu-${args.pod_name}-${Date.now()}`,
            docker_image: image,
            docker_image_tag: tag,
            environment: args.env_vars || {},
            internal_ports:
              args.custom_ports && args.custom_ports.length > 0
                ? args.custom_ports
                : defaultPorts,
            startup_commands: args.startup_commands || undefined,
          });
          resolvedTemplateId = tempTpl.id;
        }

        // 7. Rent on Lium
        const liumPod = await rentPod(node.id, ctx.userId, {
          pod_name: args.pod_name,
          template_id: resolvedTemplateId,
          gpu_count: gpuCount,
          user_public_key: publicKeys,
          enable_jupyter: args.enable_jupyter ?? true,
          expected_price_per_gpu_hour: node.wholesalePricePerGpuHr,
        });

        const nowIso = new Date().toISOString();
        const savedPod = (await databases.createDocument(
          databaseId,
          collections.pods,
          ID.unique(),
          {
            user_id: ctx.userId,
            lium_pod_id: liumPod.id,
            executor_id: node.id,
            name: args.pod_name,
            gpu_model: node.gpuModel,
            gpu_count: gpuCount,
            template_id: resolvedTemplateId,
            template_name: templateLabel,
            custom_image: customImageUsed,
            wholesale_rate_hr_micro_usd: wholesaleHrMicro,
            retail_rate_hr_micro_usd: retailHrMicro,
            status: mapLiumStatus(liumPod.status || "starting"),
            ssh_command:
              liumPod.ssh_connect_cmd ||
              liumPod.starting_ssh_connect_cmd ||
              null,
            jupyter_url: liumPod.jupyter_url || null,
            ports_json: liumPod.ports_mapping
              ? JSON.stringify(liumPod.ports_mapping)
              : null,
            started_at: nowIso,
            last_billed_at: nowIso,
            stopped_at: null,
            total_billed_micro_usd: 0,
            stop_reason: null,
          }
        )) as unknown as PodDoc;

        return jsonText({
          pod: formatPodForAgent(savedPod),
          sshMode: usedFallbackSshKey
            ? "web_only (no saved SSH keys; use jupyterUrl or mapped HTTP ports, or add an SSH key at /ssh-keys for future pods)"
            : `injected ${savedSshKeys.length} saved SSH key(s)`,
          nextStep:
            "Pod is booting. Call get_pod in 15-30 seconds to retrieve live Jupyter/HTTP URLs once status becomes 'running'.",
        });
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : "Failed to deploy pod"
        );
      }
    }
  );

  // 7. stop_pod
  server.tool(
    "stop_pod",
    `Terminate a running GPU pod on ${BRAND.name} and immediately stop per-second billing.`,
    {
      pod_id: z.string().min(1).describe("The podId to terminate"),
    },
    async (args) => {
      try {
        const { databases } = createAdminAppwrite();
        const { databaseId, collections } = APPWRITE_CONFIG;

        const pod = (await databases.getDocument(
          databaseId,
          collections.pods,
          args.pod_id
        )) as unknown as PodDoc;

        if (pod.user_id !== ctx.userId) {
          return errorResult("Pod not found or access denied.");
        }

        if (pod.status === "stopped" || pod.status === "fault_closed") {
          return jsonText({
            alreadyStopped: true,
            pod: formatPodForAgent(pod),
          });
        }

        try {
          await deleteLiumPod(pod.lium_pod_id);
        } catch (err) {
          if (!(err instanceof LiumApiError && err.status === 404)) {
            throw err;
          }
        }

        const now = new Date();
        const lastBilledMs = new Date(pod.last_billed_at).getTime();
        const elapsedSec = Math.max(
          0,
          Math.floor((now.getTime() - lastBilledMs) / 1000)
        );
        const finalCharge = Math.floor(
          (elapsedSec * pod.retail_rate_hr_micro_usd) / 3600
        );

        if (finalCharge > 0) {
          await applyLedgerTransaction({
            userId: pod.user_id,
            type: "pod_usage",
            amountMicroUsd: -finalCharge,
            referenceId: `final_${pod.$id}`,
            podId: pod.$id,
            note: `Final settlement (${elapsedSec}s) on ${pod.name} via MCP`,
          });
        }

        const updated = (await databases.updateDocument(
          databaseId,
          collections.pods,
          pod.$id,
          {
            status: "stopped",
            stopped_at: now.toISOString(),
            last_billed_at: now.toISOString(),
            total_billed_micro_usd: pod.total_billed_micro_usd + finalCharge,
            stop_reason: "user_terminated",
          }
        )) as unknown as PodDoc;

        return jsonText({
          stopped: true,
          finalSettlementUsd: Number(microUsdToUsd(finalCharge).toFixed(4)),
          pod: formatPodForAgent(updated),
        });
      } catch (err) {
        return errorResult(
          err instanceof Error ? err.message : "Failed to stop pod"
        );
      }
    }
  );

  return server;
}
