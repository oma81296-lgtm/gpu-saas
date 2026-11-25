import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { APPWRITE_CONFIG, CuratedTemplateDoc } from "@/lib/appwrite/config";
import {
  createAdminAppwrite,
  isAppwriteServerConfigured,
} from "@/lib/appwrite/server";
import { handleApiError } from "@/lib/api-error";

const FALLBACK_CURATED_TEMPLATES: CuratedTemplateDoc[] = [
  {
    $id: "tpl_pytorch_cu130",
    slug: "pytorch-cuda13",
    name: "PyTorch 2.12 + CUDA 13.0 (DinD)",
    category: "base",
    description:
      "Official Lium PyTorch 2.12 environment on Ubuntu 24.04 with CUDA 13.0 and Docker-in-Docker support.",
    lium_template_id: "bb50bd64-e363-4adc-8111-1d44c8e36807",
    docker_image:
      "daturaai/pytorch:2.12.0-py3.12-cuda13.0.2-devel-ubuntu24.04-dind-lium1",
    default_ports: "22,8888",
    min_vram_gb: 16,
    enabled: true,
    sort_order: 1,
  },
  {
    $id: "tpl_pytorch_cu128",
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
    enabled: true,
    sort_order: 2,
  },
  {
    $id: "tpl_cuda_devel",
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
    $id: "tpl_vllm_server",
    slug: "vllm-openai",
    name: "vLLM OpenAI-Compatible Server",
    category: "ai_app",
    description:
      "High-throughput LLM serving with OpenAI-compatible API on port 8000.",
    lium_template_id: "custom:vllm/vllm-openai:latest",
    docker_image: "vllm/vllm-openai:latest",
    default_ports: "22,8000",
    min_vram_gb: 24,
    enabled: true,
    sort_order: 4,
  },
  {
    $id: "tpl_comfyui",
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
    $id: "tpl_ollama",
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

export async function GET() {
  try {
    if (!isAppwriteServerConfigured()) {
      return NextResponse.json({ templates: FALLBACK_CURATED_TEMPLATES });
    }

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

    const templates =
      res.documents.length > 0
        ? (res.documents as unknown as CuratedTemplateDoc[])
        : FALLBACK_CURATED_TEMPLATES;

    return NextResponse.json({ templates });
  } catch (err) {
    return handleApiError(err);
  }
}
