export type SignalKind = "input" | "info" | "attention" | "approval" | "progress" | "blocked";

export type SignalPriority = "low" | "normal" | "high";

export type SourceAI =
  | "DEV_AI"
  | "FINANCE_AI"
  | "HOME_AI"
  | "BUSINESS_AI"
  | "TAX_AI"
  | "SYSTEM"
  | "CLAUDE"
  | "CLAUDE_CODE"
  | "OPENAI"
  | "GEMINI"
  | "APPLE_DEV"
  | "CUSTOM";

export type TargetModule = "inbox" | "signal" | "approvals" | "voice" | "today_summary_only";

export type SignalStatus = "pending" | "doing" | "done" | "blocked" | "approval";

export type SignalProducerPayload = {
  protocol_version: string;
  signal_id: string;
  source_ai: SourceAI;
  title: string;
  summary: string;
  signal_kind: SignalKind;
  signal_priority: SignalPriority;
  human_action_needed: boolean;
  timestamp: string;
  status_hint?: SignalStatus;
  target_module_hint?: TargetModule;
  producer_name?: string;
  source_ai_instance?: string;
  correlation_id?: string;
  source_ref?: string;
  metadata?: Record<string, unknown>;
};

export type ValidationResult = { ok: true; payload: SignalProducerPayload } | { ok: false; error: string };

export type ValidationWarning = { kind: string; message: string; signal_id: string };

export type NormalizedSignal = SignalProducerPayload & {
  signal_status: SignalStatus;
  target_module: TargetModule;
  normalized_at: string;
};

export type EmitResult = { ok: true; signal_id: string } | { ok: false; error: string };

export type DeadSignal = {
  signal_id: string;
  source_ai: string;
  error: string;
  raw: unknown;
  failed_at: string;
};
