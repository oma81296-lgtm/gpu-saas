import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { z } from "zod";
import { APPWRITE_CONFIG, BackupDoc, PodDoc, SshKeyDoc, VolumeDoc } from "@/lib/appwrite/config";
import { createAdminAppwrite, requireAuth } from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";
import { usdToMicroUsd } from "@/lib/brand";
import { decodeGpuId } from "@/lib/gpu-id";
import {
  assertAllowedWorkload,
  assertNotSanctionedCountry,
} from "@/lib/compliance";
import {
  createTemporaryTemplate,
  fetchPublicNodes,
  isLiumConfigured,
  listLiumPods,
  rentPod,
} from "@/lib/lium/client";
import { buildMarketplaceNodes, getActivePricingRules } from "@/lib/pricing";

const launchPodSchema = z.object({
  executorId: z.string().min(1),
  podName: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, underscores or hyphens"),
  gpuCount: z.number().int().min(1).max(16).optional(),
  sshKeyIds: z.array(z.string().min(1)).min(1, "Select at least one SSH key"),
  enableJupyter: z.boolean().optional().default(true),
  volumeId: z.string().optional(),
  enableVolumeEncryption: z.boolean().optional().default(false),
  enableBackups: z.boolean().optional().default(false),
  backupId: z.string().optional(),
  restorePath: z
    .string()
    .trim()
    .optional()
    .refine(
      (p) => !p || p === "/root" || p.startsWith("/root/"),
      "Restore path must be /root or inside /root"
    ),
  // Either a curated template OR custom docker image
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  customDockerImage: z.string().trim().optional(),
  customEnvVars: z.record(z.string(), z.string()).optional(),
  customPorts: z.array(z.number().int().min(1).max(65535)).optional(),
  startupCommands: z.string().max(2000).optional(),
});

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

function mapLiumStatus(status: string): PodDoc["status"] {
  const s = (status || "").toLowerCase();
  if (s === "running" || s === "active" || s === "ready") return "running";
  if (s === "starting" || s === "creating" || s === "pending" || s === "pulling")
    return "starting";
  if (s === "stopping" || s === "terminating") return "stopping";
  if (s === "failed" || s === "error") return "failed";
  return "stopped";
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const { databases } = createAdminAppwrite();

    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.pods,
      [
        Query.equal("user_id", ctx.userId),
        Query.orderDesc("started_at"),
        Query.limit(50),
      ]
    );

    const pods = res.documents as unknown as PodDoc[];
    const activeLocal = pods.filter(
      (p) => p.status === "starting" || p.status === "running"
    );

    // Opportunistically sync live connection details from Lium for active pods
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
              live.ssh_connect_cmd || live.starting_ssh_connect_cmd || pod.ssh_command || null;
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
      } catch (syncErr) {
        console.warn("[pods:sync] skipped live sync:", syncErr);
      }
    }

    return NextResponse.json({ pods });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertNotSanctionedCountry(req);
    const ctx = await requireAuth(req);
    const body = launchPodSchema.parse(await req.json());
    assertAllowedWorkload({
      customDockerImage: body.customDockerImage,
      startupCommands: body.startupCommands,
      customEnvVars: body.customEnvVars,
    });
    const { databases } = createAdminAppwrite();
    const { databaseId, collections } = APPWRITE_CONFIG;

    // 1. Check concurrency guardrail
    const activeRes = await databases.listDocuments(databaseId, collections.pods, [
      Query.equal("user_id", ctx.userId),
      Query.equal("status", ["starting", "running"]),
      Query.limit(50),
    ]);
    if (activeRes.total >= ctx.profile.max_concurrent_pods) {
      return NextResponse.json(
        {
          error: `Concurrent pod limit reached (${ctx.profile.max_concurrent_pods}). Terminate an existing pod or contact support to raise your quota.`,
        },
        { status: 403 }
      );
    }

    // 2. Verify node is Secure-tier and compute retail rate
    const resolvedExecutorId = decodeGpuId(body.executorId);
    if (!resolvedExecutorId) {
      return NextResponse.json(
        { error: "Invalid GPU node identifier. Refresh the marketplace and try again." },
        { status: 400 }
      );
    }

    const [feed, rules] = await Promise.all([
      fetchPublicNodes(),
      getActivePricingRules(),
    ]);
    const secureNodes = buildMarketplaceNodes(feed.nodes || [], rules);
    const node = secureNodes.find((n) => n.id === resolvedExecutorId);
    if (!node) {
      return NextResponse.json(
        {
          error:
            "Selected GPU node is no longer available or does not meet Secure-tier requirements.",
        },
        { status: 409 }
      );
    }

    const gpuCount = body.gpuCount || node.availableGpuCount;
    const wholesaleHrMicro = usdToMicroUsd(node.wholesalePricePerGpuHr * gpuCount);
    const retailHrMicro = usdToMicroUsd(node.retailPricePerGpuHr * gpuCount);

    // 3. Enforce strict prepaid ≥30-minute launch buffer
    const minRequiredMicro = Math.ceil(retailHrMicro * 0.5);
    if (ctx.profile.balance_micro_usd < minRequiredMicro) {
      const neededUsd = (minRequiredMicro / 1_000_000).toFixed(2);
      const currentUsd = (ctx.profile.balance_micro_usd / 1_000_000).toFixed(2);
      return NextResponse.json(
        {
          error: `Insufficient credits. Launching this pod requires at least $${neededUsd} (30 min buffer), but your balance is $${currentUsd}. Top up on the Billing page.`,
        },
        { status: 402 }
      );
    }

    // 4. Resolve user's SSH keys
    const keyDocs = await Promise.all(
      body.sshKeyIds.map(async (keyId) => {
        const doc = (await databases.getDocument(
          databaseId,
          collections.sshKeys,
          keyId
        )) as unknown as SshKeyDoc;
        if (doc.user_id !== ctx.userId) {
          throw new Error("Unauthorized SSH key selection");
        }
        return doc.public_key;
      })
    );

    // 5. Resolve Lium template_id (either curated Lium UUID or temporary private template for custom Docker image)
    let resolvedTemplateId = body.templateId || "";
    let customImageUsed: string | null = null;

    const needsTempTemplate =
      Boolean(body.customDockerImage) ||
      resolvedTemplateId.startsWith("custom:");

    if (needsTempTemplate) {
      const rawImage =
        body.customDockerImage || resolvedTemplateId.replace(/^custom:/, "");
      const { image, tag } = parseImageAndTag(rawImage);
      customImageUsed = `${image}:${tag}`;

      const tempTpl = await createTemporaryTemplate({
        name: `voltgpu-${body.podName}-${Date.now()}`,
        docker_image: image,
        docker_image_tag: tag,
        environment: body.customEnvVars || {},
        internal_ports:
          body.customPorts && body.customPorts.length > 0
            ? body.customPorts
            : [22, 8888],
        startup_commands: body.startupCommands || undefined,
      });
      resolvedTemplateId = tempTpl.id;
    }

    if (!resolvedTemplateId) {
      return NextResponse.json(
        { error: "Select a curated template or provide a custom Docker image." },
        { status: 400 }
      );
    }

    // 5b. Resolve optional persistent volume (ownership checked)
    let resolvedLiumVolumeId: string | undefined;
    if (body.volumeId) {
      const volDoc = (await databases.getDocument(
        databaseId,
        collections.volumes,
        body.volumeId
      )) as unknown as VolumeDoc;
      if (volDoc.user_id !== ctx.userId || volDoc.status !== "active") {
        return NextResponse.json(
          { error: "Selected persistent volume is invalid or unavailable." },
          { status: 403 }
        );
      }
      resolvedLiumVolumeId = volDoc.lium_volume_id;
    }

    // 5c. Resolve optional backup to restore on launch (ownership checked)
    let resolvedLiumBackupLogId: string | undefined;
    if (body.backupId) {
      const backupDoc = (await databases.getDocument(
        databaseId,
        collections.backups,
        body.backupId
      )) as unknown as BackupDoc;
      if (backupDoc.user_id !== ctx.userId || backupDoc.status !== "completed") {
        return NextResponse.json(
          { error: "Selected backup is invalid or not completed yet." },
          { status: 403 }
        );
      }
      resolvedLiumBackupLogId = backupDoc.lium_backup_log_id;
    }

    // 6. Rent on Lium tagged with X-Customer-Ref: ctx.userId
    const liumPod = await rentPod(node.id, ctx.userId, {
      pod_name: body.podName,
      template_id: resolvedTemplateId,
      gpu_count: gpuCount,
      volume_id: resolvedLiumVolumeId,
      enable_volume_encryption: resolvedLiumVolumeId
        ? body.enableVolumeEncryption
        : undefined,
      enable_backups: body.enableBackups,
      backup_log_id: resolvedLiumBackupLogId,
      restore_path: resolvedLiumBackupLogId
        ? body.restorePath || "/root"
        : undefined,
      user_public_key: keyDocs,
      enable_jupyter: body.enableJupyter,
      expected_price_per_gpu_hour: node.wholesalePricePerGpuHr,
    });

    const nowIso = new Date().toISOString();
    const savedPod = await databases.createDocument(
      databaseId,
      collections.pods,
      ID.unique(),
      {
        user_id: ctx.userId,
        lium_pod_id: liumPod.id,
        executor_id: node.id,
        name: body.podName,
        gpu_model: node.gpuModel,
        gpu_count: gpuCount,
        template_id: resolvedTemplateId,
        template_name: body.templateName || customImageUsed || "Custom",
        custom_image: customImageUsed,
        wholesale_rate_hr_micro_usd: wholesaleHrMicro,
        retail_rate_hr_micro_usd: retailHrMicro,
        status: mapLiumStatus(liumPod.status || "starting"),
        ssh_command: liumPod.ssh_connect_cmd || liumPod.starting_ssh_connect_cmd || null,
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
    );

    return NextResponse.json({ pod: savedPod }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
