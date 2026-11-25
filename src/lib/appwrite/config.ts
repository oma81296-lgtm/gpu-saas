export const APPWRITE_CONFIG = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  databaseId: process.env.APPWRITE_DATABASE_ID || "voltgpu",
  collections: {
    userProfiles: "user_profiles",
    sshKeys: "ssh_keys",
    creditLedger: "credit_ledger",
    pods: "pods",
    pricingRules: "pricing_rules",
    curatedTemplates: "curated_templates",
    reconciliationRuns: "reconciliation_runs",
    operatorSettings: "operator_settings",
    volumes: "volumes",
    backups: "backups",
    notifications: "notifications",
    apiKeys: "api_keys",
  },
} as const;

export interface UserProfileDoc {
  $id: string;
  $createdAt: string;
  user_id: string;
  email?: string | null;
  name?: string | null;
  role: "user" | "admin";
  balance_micro_usd: number;
  max_concurrent_pods: number;
  low_balance_warned_at?: string | null;
}

export interface SshKeyDoc {
  $id: string;
  $createdAt: string;
  user_id: string;
  name: string;
  public_key: string;
  fingerprint: string;
}

export interface CreditLedgerDoc {
  $id: string;
  $createdAt: string;
  user_id: string;
  type: "topup" | "pod_usage" | "refund" | "admin_adjustment";
  amount_micro_usd: number;
  balance_after_micro_usd: number;
  reference_id?: string | null;
  pod_id?: string | null;
  note?: string | null;
}

export interface PodDoc {
  $id: string;
  $createdAt: string;
  user_id: string;
  lium_pod_id: string;
  executor_id: string;
  name: string;
  gpu_model: string;
  gpu_count: number;
  template_id: string;
  template_name?: string | null;
  custom_image?: string | null;
  wholesale_rate_hr_micro_usd: number;
  retail_rate_hr_micro_usd: number;
  status: "starting" | "running" | "stopping" | "stopped" | "failed" | "fault_closed";
  ssh_command?: string | null;
  jupyter_url?: string | null;
  ports_json?: string | null;
  started_at: string;
  last_billed_at: string;
  stopped_at?: string | null;
  total_billed_micro_usd: number;
  stop_reason?: "user_terminated" | "out_of_credits" | "provider_fault" | "unknown" | null;
}

export interface PricingRuleDoc {
  $id: string;
  scope: "global" | "gpu_model";
  gpu_model?: string | null;
  markup_percent: number;
  min_reliability_score: number;
  enabled: boolean;
}

export interface CuratedTemplateDoc {
  $id: string;
  slug: string;
  name: string;
  category: "base" | "ai_app" | "notebook";
  description: string;
  lium_template_id: string;
  docker_image?: string | null;
  default_ports?: string | null;
  min_vram_gb: number;
  enabled: boolean;
  sort_order: number;
}

export interface ReconciliationRunDoc {
  $id: string;
  $createdAt: string;
  window_start: string;
  window_end: string;
  master_balance_usd: number;
  lium_usd_billed: number;
  platform_usd_billed: number;
  gross_margin_usd: number;
  fault_closes_count: number;
  details_json?: string | null;
}

export interface OperatorSettingsDoc {
  $id: string;
  key: string;
  master_balance_alert_threshold_usd: number;
  discord_webhook_url?: string | null;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  alert_email?: string | null;
}

export interface VolumeDoc {
  $id: string;
  $createdAt: string;
  user_id: string;
  lium_volume_id: string;
  name: string;
  description?: string | null;
  current_size_gb: number;
  total_billed_micro_usd: number;
  status: "active" | "deleted";
  last_billed_date?: string | null;
}

export interface BackupDoc {
  $id: string;
  $createdAt: string;
  user_id: string;
  pod_id?: string | null;
  lium_pod_id: string;
  pod_name: string;
  lium_backup_log_id: string;
  name: string;
  description?: string | null;
  backup_path: string;
  size_bytes: number;
  status: "pending" | "in_progress" | "completed" | "failed" | "deleted";
}

export interface NotificationDoc {
  $id: string;
  $createdAt: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "critical";
  target_user_id?: string | null;
  action_label?: string | null;
  action_url?: string | null;
  active: boolean;
  dismissible: boolean;
  expires_at?: string | null;
  created_by?: string | null;
}

export interface ApiKeyDoc {
  $id: string;
  $createdAt: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  max_hourly_usd: number;
  revoked: boolean;
  last_used_at?: string | null;
  expires_at?: string | null;
}
