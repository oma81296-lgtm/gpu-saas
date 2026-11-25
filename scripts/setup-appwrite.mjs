/**
 * Idempotent Appwrite provisioning script for VoltGPU.
 * Run with: npm run setup:appwrite
 *
 * Reads NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID,
 * APPWRITE_API_KEY, and APPWRITE_DATABASE_ID from .env.local (or process.env).
 */
import fs from "node:fs";
import path from "node:path";
import { Client, Databases, DatabasesIndexType as IndexType, ID, Permission, Role } from "node-appwrite";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "voltgpu";

if (!PROJECT_ID || !API_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env.local"
  );
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function safe(label, fn) {
  try {
    await fn();
    console.log(`  [ok] ${label}`);
  } catch (err) {
    if (err?.code === 409) {
      console.log(`  [skip] ${label} (already exists)`);
    } else {
      console.error(`  [err] ${label}:`, err?.message || err);
      throw err;
    }
  }
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureCollection(id, name, attributes, indexes = []) {
  console.log(`\nCollection: ${id}`);
  await safe(`create collection ${id}`, () =>
    databases.createCollection(DATABASE_ID, id, name, [
      // Server-only access via API key; client talks through Next.js API routes
      Permission.read(Role.label("admin")),
    ])
  );

  for (const attr of attributes) {
    await safe(`attr ${id}.${attr.key}`, async () => {
      switch (attr.type) {
        case "string":
          return databases.createStringAttribute(
            DATABASE_ID,
            id,
            attr.key,
            attr.size || 255,
            Boolean(attr.required),
            attr.default ?? undefined,
            Boolean(attr.array)
          );
        case "integer":
          return databases.createIntegerAttribute(
            DATABASE_ID,
            id,
            attr.key,
            Boolean(attr.required),
            attr.min ?? undefined,
            attr.max ?? undefined,
            attr.default ?? undefined,
            Boolean(attr.array)
          );
        case "float":
          return databases.createFloatAttribute(
            DATABASE_ID,
            id,
            attr.key,
            Boolean(attr.required),
            attr.min ?? undefined,
            attr.max ?? undefined,
            attr.default ?? undefined,
            Boolean(attr.array)
          );
        case "boolean":
          return databases.createBooleanAttribute(
            DATABASE_ID,
            id,
            attr.key,
            Boolean(attr.required),
            attr.default ?? undefined,
            Boolean(attr.array)
          );
        case "datetime":
          return databases.createDatetimeAttribute(
            DATABASE_ID,
            id,
            attr.key,
            Boolean(attr.required),
            attr.default ?? undefined,
            Boolean(attr.array)
          );
        case "enum":
          return databases.createEnumAttribute(
            DATABASE_ID,
            id,
            attr.key,
            attr.elements,
            Boolean(attr.required),
            attr.default ?? undefined,
            Boolean(attr.array)
          );
        default:
          throw new Error(`Unsupported attr type: ${attr.type}`);
      }
    });
  }

  if (indexes.length > 0) {
    // Allow Appwrite attribute workers to finish provisioning before creating indexes
    await wait(2500);
    for (const idx of indexes) {
      await safe(`index ${id}.${idx.key}`, () =>
        databases.createIndex(
          DATABASE_ID,
          id,
          idx.key,
          idx.type,
          idx.attributes,
          idx.orders
        )
      );
    }
  }
}

async function main() {
  console.log(`Provisioning VoltGPU Appwrite schema in project ${PROJECT_ID}...`);
  try {
    await databases.get(DATABASE_ID);
    console.log(`  [skip] database ${DATABASE_ID} (already exists)`);
  } catch (err) {
    if (err?.code === 404) {
      await safe(`create database ${DATABASE_ID}`, () =>
        databases.create(DATABASE_ID, "VoltGPU")
      );
    } else {
      throw err;
    }
  }

  await ensureCollection(
    "user_profiles",
    "User Profiles",
    [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "email", type: "string", size: 255, required: false },
      { key: "name", type: "string", size: 255, required: false },
      { key: "role", type: "enum", elements: ["user", "admin"], required: false, default: "user" },
      { key: "balance_micro_usd", type: "integer", required: false, default: 0 },
      { key: "max_concurrent_pods", type: "integer", required: false, default: 2 },
      { key: "low_balance_warned_at", type: "datetime", required: false },
    ],
    [{ key: "idx_user_id", type: IndexType.Unique, attributes: ["user_id"] }]
  );

  await ensureCollection(
    "ssh_keys",
    "SSH Keys",
    [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "public_key", type: "string", size: 4096, required: true },
      { key: "fingerprint", type: "string", size: 128, required: true },
    ],
    [{ key: "idx_ssh_user", type: IndexType.Key, attributes: ["user_id"] }]
  );

  await ensureCollection(
    "api_keys",
    "API Keys",
    [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "key_prefix", type: "string", size: 32, required: true },
      { key: "key_hash", type: "string", size: 128, required: true },
      { key: "max_hourly_usd", type: "float", required: false, default: 5 },
      { key: "revoked", type: "boolean", required: false, default: false },
      { key: "last_used_at", type: "datetime", required: false },
      { key: "expires_at", type: "datetime", required: false },
    ],
    [
      { key: "idx_apikey_user", type: IndexType.Key, attributes: ["user_id"] },
      { key: "idx_apikey_hash", type: IndexType.Unique, attributes: ["key_hash"] },
    ]
  );

  await ensureCollection(
    "credit_ledger",
    "Credit Ledger",
    [
      { key: "user_id", type: "string", size: 64, required: true },
      {
        key: "type",
        type: "enum",
        elements: ["topup", "pod_usage", "refund", "admin_adjustment"],
        required: true,
      },
      { key: "amount_micro_usd", type: "integer", required: true },
      { key: "balance_after_micro_usd", type: "integer", required: true },
      { key: "reference_id", type: "string", size: 128, required: false },
      { key: "pod_id", type: "string", size: 64, required: false },
      { key: "note", type: "string", size: 512, required: false },
    ],
    [
      { key: "idx_ledger_user", type: IndexType.Key, attributes: ["user_id"] },
      { key: "idx_ledger_ref", type: IndexType.Unique, attributes: ["reference_id"] },
      { key: "idx_ledger_pod", type: IndexType.Key, attributes: ["pod_id"] },
    ]
  );

  await ensureCollection(
    "pods",
    "Pods",
    [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "lium_pod_id", type: "string", size: 128, required: true },
      { key: "executor_id", type: "string", size: 128, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "gpu_model", type: "string", size: 128, required: true },
      { key: "gpu_count", type: "integer", required: true },
      { key: "template_id", type: "string", size: 128, required: true },
      { key: "template_name", type: "string", size: 128, required: false },
      { key: "custom_image", type: "string", size: 512, required: false },
      { key: "wholesale_rate_hr_micro_usd", type: "integer", required: true },
      { key: "retail_rate_hr_micro_usd", type: "integer", required: true },
      {
        key: "status",
        type: "enum",
        elements: ["starting", "running", "stopping", "stopped", "failed", "fault_closed"],
        required: false,
        default: "starting",
      },
      { key: "ssh_command", type: "string", size: 512, required: false },
      { key: "jupyter_url", type: "string", size: 512, required: false },
      { key: "ports_json", type: "string", size: 4096, required: false },
      { key: "started_at", type: "datetime", required: true },
      { key: "last_billed_at", type: "datetime", required: true },
      { key: "stopped_at", type: "datetime", required: false },
      { key: "total_billed_micro_usd", type: "integer", required: false, default: 0 },
      {
        key: "stop_reason",
        type: "enum",
        elements: ["user_terminated", "out_of_credits", "provider_fault", "unknown"],
        required: false,
      },
    ],
    [
      { key: "idx_pods_user", type: IndexType.Key, attributes: ["user_id"] },
      { key: "idx_pods_lium_id", type: IndexType.Unique, attributes: ["lium_pod_id"] },
      { key: "idx_pods_status", type: IndexType.Key, attributes: ["status"] },
    ]
  );

  await ensureCollection(
    "volumes",
    "Volumes",
    [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "lium_volume_id", type: "string", size: 128, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "description", type: "string", size: 512, required: false },
      { key: "current_size_gb", type: "float", required: false, default: 0 },
      { key: "total_billed_micro_usd", type: "integer", required: false, default: 0 },
      { key: "status", type: "enum", elements: ["active", "deleted"], required: false, default: "active" },
      { key: "last_billed_date", type: "string", size: 16, required: false },
    ],
    [
      { key: "idx_volumes_user", type: IndexType.Key, attributes: ["user_id"] },
      { key: "idx_volumes_lium_id", type: IndexType.Unique, attributes: ["lium_volume_id"] },
    ]
  );

  await ensureCollection(
    "backups",
    "Backups",
    [
      { key: "user_id", type: "string", size: 64, required: true },
      { key: "pod_id", type: "string", size: 64, required: false },
      { key: "lium_pod_id", type: "string", size: 128, required: true },
      { key: "pod_name", type: "string", size: 128, required: true },
      { key: "lium_backup_log_id", type: "string", size: 128, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "description", type: "string", size: 512, required: false },
      { key: "backup_path", type: "string", size: 255, required: false, default: "/root" },
      { key: "size_bytes", type: "integer", required: false, default: 0 },
      {
        key: "status",
        type: "enum",
        elements: ["pending", "in_progress", "completed", "failed", "deleted"],
        required: false,
        default: "pending",
      },
    ],
    [
      { key: "idx_backups_user", type: IndexType.Key, attributes: ["user_id"] },
      { key: "idx_backups_lium_id", type: IndexType.Unique, attributes: ["lium_backup_log_id"] },
      { key: "idx_backups_pod", type: IndexType.Key, attributes: ["lium_pod_id"] },
    ]
  );

  await ensureCollection(
    "notifications",
    "Notifications",
    [
      { key: "title", type: "string", size: 128, required: true },
      { key: "message", type: "string", size: 512, required: true },
      {
        key: "severity",
        type: "enum",
        elements: ["info", "success", "warning", "critical"],
        required: false,
        default: "info",
      },
      { key: "target_user_id", type: "string", size: 64, required: false },
      { key: "action_label", type: "string", size: 64, required: false },
      { key: "action_url", type: "string", size: 255, required: false },
      { key: "active", type: "boolean", required: false, default: true },
      { key: "dismissible", type: "boolean", required: false, default: true },
      { key: "expires_at", type: "datetime", required: false },
      { key: "created_by", type: "string", size: 255, required: false },
    ],
    [
      { key: "idx_notif_active", type: IndexType.Key, attributes: ["active"] },
      { key: "idx_notif_target", type: IndexType.Key, attributes: ["target_user_id"] },
    ]
  );

  await ensureCollection(
    "pricing_rules",
    "Pricing Rules",
    [
      { key: "scope", type: "enum", elements: ["global", "gpu_model"], required: true },
      { key: "gpu_model", type: "string", size: 128, required: false },
      { key: "markup_percent", type: "float", required: true },
      { key: "min_reliability_score", type: "float", required: false, default: 90 },
      { key: "enabled", type: "boolean", required: false, default: true },
    ],
    [{ key: "idx_pricing_scope", type: IndexType.Key, attributes: ["scope", "gpu_model"] }]
  );

  await ensureCollection(
    "curated_templates",
    "Curated Templates",
    [
      { key: "slug", type: "string", size: 64, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "category", type: "enum", elements: ["base", "ai_app", "notebook"], required: true },
      { key: "description", type: "string", size: 512, required: true },
      { key: "lium_template_id", type: "string", size: 128, required: true },
      { key: "docker_image", type: "string", size: 255, required: false },
      { key: "default_ports", type: "string", size: 128, required: false },
      { key: "min_vram_gb", type: "integer", required: false, default: 0 },
      { key: "enabled", type: "boolean", required: false, default: true },
      { key: "sort_order", type: "integer", required: false, default: 0 },
    ],
    [{ key: "idx_tpl_slug", type: IndexType.Unique, attributes: ["slug"] }]
  );

  await ensureCollection(
    "reconciliation_runs",
    "Reconciliation Runs",
    [
      { key: "window_start", type: "datetime", required: true },
      { key: "window_end", type: "datetime", required: true },
      { key: "master_balance_usd", type: "float", required: true },
      { key: "lium_usd_billed", type: "float", required: true },
      { key: "platform_usd_billed", type: "float", required: true },
      { key: "gross_margin_usd", type: "float", required: true },
      { key: "fault_closes_count", type: "integer", required: false, default: 0 },
      { key: "details_json", type: "string", size: 16384, required: false },
    ],
    [{ key: "idx_recon_end", type: IndexType.Key, attributes: ["window_end"], orders: ["DESC"] }]
  );

  await ensureCollection(
    "operator_settings",
    "Operator Settings",
    [
      { key: "key", type: "string", size: 64, required: true },
      { key: "master_balance_alert_threshold_usd", type: "float", required: false, default: 100 },
      { key: "discord_webhook_url", type: "string", size: 512, required: false },
      { key: "telegram_bot_token", type: "string", size: 255, required: false },
      { key: "telegram_chat_id", type: "string", size: 128, required: false },
      { key: "alert_email", type: "string", size: 255, required: false },
    ],
    [{ key: "idx_settings_key", type: IndexType.Unique, attributes: ["key"] }]
  );

  console.log("\nSeeding defaults...");
  await wait(1500);

  // Seed default global pricing rule
  await safe("seed global pricing rule (+20%)", () =>
    databases.createDocument(DATABASE_ID, "pricing_rules", "global_default", {
      scope: "global",
      gpu_model: null,
      markup_percent: 20.0,
      min_reliability_score: 90.0,
      enabled: true,
    })
  );

  // Seed curated templates backed by real Lium official template IDs
  const seedTemplates = [
    {
      id: "tpl_pytorch_cu130",
      slug: "pytorch-cuda13",
      name: "PyTorch 2.12 + CUDA 13.0 (DinD)",
      category: "base",
      description:
        "Official Lium PyTorch 2.12 environment on Ubuntu 24.04 with CUDA 13.0 and Docker-in-Docker support.",
      lium_template_id: "bb50bd64-e363-4adc-8111-1d44c8e36807",
      docker_image: "daturaai/pytorch:2.12.0-py3.12-cuda13.0.2-devel-ubuntu24.04-dind-lium1",
      default_ports: "22,8888",
      min_vram_gb: 16,
      enabled: true,
      sort_order: 1,
    },
    {
      id: "tpl_pytorch_cu128",
      slug: "pytorch-cuda128",
      name: "PyTorch 2.11 + CUDA 12.8",
      category: "notebook",
      description:
        "Stable PyTorch 2.11 with CUDA 12.8 and JupyterLab ready for training, fine-tuning, and notebooks.",
      lium_template_id: "cbc0ffdc-aa35-441a-abaa-170a87c51a64",
      docker_image: "daturaai/pytorch:2.11.0-py3.12-cuda12.8-devel-ubuntu24.04-dind-lium1",
      default_ports: "22,8888",
      min_vram_gb: 16,
      enabled: true,
      sort_order: 2,
    },
    {
      id: "tpl_cuda_devel",
      slug: "cuda-devel",
      name: "NVIDIA CUDA 13.0 Devel (Ubuntu)",
      category: "base",
      description:
        "Clean Ubuntu 22.04 with full nvcc CUDA toolkit for custom C++/CUDA builds and ML frameworks.",
      lium_template_id: "30612657-5da8-4c89-84af-0edd12bbc47c",
      docker_image: "nvidia/cuda:13.0.3-devel-ubuntu22.04",
      default_ports: "22",
      min_vram_gb: 8,
      enabled: true,
      sort_order: 3,
    },
    {
      id: "tpl_vllm_server",
      slug: "vllm-openai",
      name: "vLLM OpenAI-Compatible Server",
      category: "ai_app",
      description:
        "High-throughput LLM serving with OpenAI-compatible API on port 8000 (uses official vLLM image).",
      lium_template_id: "custom:vllm/vllm-openai:latest",
      docker_image: "vllm/vllm-openai:latest",
      default_ports: "22,8000",
      min_vram_gb: 24,
      enabled: true,
      sort_order: 4,
    },
    {
      id: "tpl_comfyui",
      slug: "comfyui",
      name: "ComfyUI Studio",
      category: "ai_app",
      description:
        "Node-based Diffusion / Flux / Video generation UI pre-configured on port 8188.",
      lium_template_id: "custom:yanwk/comfyui-boot:cu124-slim",
      docker_image: "yanwk/comfyui-boot:cu124-slim",
      default_ports: "22,8188",
      min_vram_gb: 16,
      enabled: true,
      sort_order: 5,
    },
    {
      id: "tpl_ollama",
      slug: "ollama",
      name: "Ollama LLM Runner",
      category: "ai_app",
      description:
        "Run Llama 3, DeepSeek, Qwen, and Mistral models with one command over port 11434.",
      lium_template_id: "custom:ollama/ollama:latest",
      docker_image: "ollama/ollama:latest",
      default_ports: "22,11434",
      min_vram_gb: 16,
      enabled: true,
      sort_order: 6,
    },
  ];

  for (const tpl of seedTemplates) {
    const { id, ...doc } = tpl;
    await safe(`seed template ${tpl.slug}`, () =>
      databases.createDocument(DATABASE_ID, "curated_templates", id, doc)
    );
  }

  await safe("seed operator_settings alerts_config", () =>
    databases.createDocument(DATABASE_ID, "operator_settings", "alerts_config", {
      key: "alerts_config",
      master_balance_alert_threshold_usd: 100.0,
      discord_webhook_url: null,
      telegram_bot_token: null,
      telegram_chat_id: null,
      alert_email: null,
    })
  );

  console.log("\nDone! Appwrite database & collections are ready.");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
