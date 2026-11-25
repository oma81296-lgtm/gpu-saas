/**
 * Typed models for the Lium.io Platform API & Public Nodes Feed
 * Derived from https://lium.io/api/openapi.json and https://docs.lium.io
 */

export interface LiumPublicNode {
  id: string;
  gpu_model?: string;
  gpu_count?: number;
  available_gpu_count?: number;
  available_now?: boolean;
  price_per_gpu_hour?: number;
  price_per_node_hour?: number;
  min_rentable_gpu_count?: number;
  gpu_memory_gb?: number;
  cpu_count?: number;
  ram_gb?: number;
  disk_gb?: number;
  disk_free_gb?: number;
  cpu_model?: string;
  disk_type?: string;
  network_upload_mbps?: number;
  network_download_mbps?: number;
  uptime_minutes?: number;
  reliability_score?: number | null;
  tier?: "secure" | "spot" | string;
  country?: string;
  country_code?: string;
  region?: string;
  region_name?: string;
  city?: string;
  timezone?: string;
  gpu_driver?: string;
  cuda_driver?: string;
  gpu_interconnect?: "nvlink" | "pcie" | null;
  last_verified_at?: string | null;
  rent_url: string;
}

export interface LiumPublicNodesResponse {
  generated_at: string;
  count: number;
  nodes: LiumPublicNode[];
}

export interface MarketplaceGpuNode {
  id: string;
  gpuModel: string;
  gpuCount: number;
  availableGpuCount: number;
  minRentableGpuCount: number;
  vramPerGpuGb: number;
  cpuCount: number;
  ramGb: number;
  diskFreeGb: number;
  diskType: string;
  networkDownMbps: number;
  networkUpMbps: number;
  reliabilityScore: number | null;
  interconnect: string | null;
  cudaDriver: string | null;
  country: string;
  countryCode: string;
  city: string;
  wholesalePricePerGpuHr: number;
  retailPricePerGpuHr: number;
  retailPricePerNodeHr: number;
  markupPercent: number;
}

export interface LiumRentPodRequest {
  pod_name: string;
  template_id?: string;
  gpu_count?: number;
  volume_id?: string;
  enable_volume_encryption?: boolean;
  enable_backups?: boolean;
  backup_log_id?: string;
  restore_path?: string;
  user_public_key: string[];
  enable_jupyter?: boolean;
  initial_port_count?: number;
  expected_price_per_gpu_hour?: number;
}

export interface LiumBackupConfig {
  id: string;
  pod_id: string;
  backup_path: string;
  backup_frequency_hours: number;
  retention_days: number;
  is_active?: boolean;
  auto_created?: boolean;
  paused?: boolean;
  paused_reason?: string | null;
  last_copy_at?: string | null;
  last_copy_expires_at?: string | null;
  created_at?: string;
}

export interface LiumBackupLog {
  id: string;
  pod_id?: string;
  pod_name?: string;
  name?: string;
  description?: string | null;
  backup_path?: string;
  status?: string;
  size_bytes?: number;
  file_size_bytes?: number;
  created_at?: string;
  completed_at?: string | null;
  expires_at?: string | null;
}

export interface LiumVolume {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  pod?: { id?: string; pod_name?: string } | null;
  current_size_bytes?: number;
  current_file_count?: number;
  current_size_gb?: number;
  current_size_mb?: number;
  last_metrics_update?: string | null;
}

export interface LiumVolumeCostRow {
  volume_id: string;
  date: string;
  custom_storage_cost?: number;
  egress_cost?: number;
  chargeable_cost?: number;
  total_cost?: number;
}

export interface LiumCreateTemplateRequest {
  name: string;
  docker_image: string;
  docker_image_tag?: string;
  description?: string;
  category?: string;
  environment?: Record<string, string>;
  internal_ports?: number[];
  startup_commands?: string;
  is_private?: boolean;
  is_temporary?: boolean;
  one_time_template?: boolean;
}

export interface LiumTemplate {
  id: string;
  name: string;
  docker_image?: string;
  docker_image_tag?: string;
  category?: string;
  description?: string;
  internal_ports?: number[];
}

export interface LiumPod {
  id: string;
  executor_id: string;
  pod_name: string;
  status: string;
  phase?: string | null;
  create_progress?: number | null;
  estimated_ready_seconds?: number | null;
  gpu_name?: string;
  gpu_count?: number;
  cpu_name?: string;
  cpu_count?: number;
  ram_total?: number;
  price?: number;
  spend_to_date?: number;
  billed_until?: string | null;
  ssh_connect_cmd?: string | null;
  starting_ssh_connect_cmd?: string | null;
  ports_mapping?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  jupyter_url?: string | null;
  jupyter_installation_status?: string | null;
  enable_jupyter?: boolean;
  created_at?: string;
  updated_at?: string;
  node_offline?: boolean;
  billing_paused?: boolean;
  node_outage?: boolean;
  rental_tier?: string;
}

export interface LiumResetGpuResponse {
  pod_id: string;
  request_id: string;
  status: "running" | "done" | "failed" | "timeout";
  ok: boolean | null;
  container_restarted: boolean | null;
  gpus: Array<{
    index: number;
    uuid?: string;
    result: string;
    detail?: string;
  }>;
  error: { code: string; message: string } | null;
}

export interface LiumPartnerRentalRow {
  bucket: string;
  rentals: number;
  gpu_hours: number;
  usd_billed: number;
  fault_closes: number;
}

export interface LiumPartnerRentalsResponse {
  since: string;
  until: string;
  group_by: "day" | "gpu" | "customer_ref";
  rows: LiumPartnerRentalRow[];
}

export interface LiumUserMe {
  id?: string;
  email?: string;
  balance?: number;
  credit_balance?: number;
  usd_balance?: number;
  [key: string]: unknown;
}

export interface LiumAccountEvent {
  id?: string;
  created_at: string;
  event_type: string;
  sub_event_type?: string;
  event?: string;
  pod_id?: string;
  pod_name?: string;
  actor?: {
    api_key_name?: string;
    auth?: string;
  };
}
