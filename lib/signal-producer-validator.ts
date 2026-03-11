import type {
  SignalKind,
  SignalPriority,
  SignalProducerPayload,
  SignalStatus,
  SourceAI,
  TargetModule,
  ValidationResult,
  ValidationWarning
} from "../types/signal-producer";

const SIGNAL_KINDS: SignalKind[] = ["input", "info", "attention", "approval", "progress", "blocked"];
const SIGNAL_PRIORITIES: SignalPriority[] = ["low", "normal", "high"];
const SOURCE_AIS: SourceAI[] = ["DEV_AI", "FINANCE_AI", "HOME_AI", "BUSINESS_AI", "TAX_AI", "SYSTEM"];
const SIGNAL_STATUSES: SignalStatus[] = ["pending", "doing", "done", "blocked", "approval"];
const TARGET_MODULES: TargetModule[] = ["inbox", "signal", "approvals", "voice", "today_summary_only"];
const RESTRICTED_METADATA_PREFIXES = ["_internal", "_chain", "_reasoning", "_trace"];

const seenIds = new Set<string>();
const emitLog = new Map<string, number[]>();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIso8601(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function asPayload(raw: unknown): SignalProducerPayload | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  return raw as SignalProducerPayload;
}

export function resetSignalProducerValidatorState(): void {
  seenIds.clear();
  emitLog.clear();
}

export function validateSignalId(payload: SignalProducerPayload): ValidationResult {
  if (!isNonEmptyString(payload.signal_id)) {
    return { ok: false, error: "signal_id is required" };
  }
  if (seenIds.has(payload.signal_id)) {
    return { ok: false, error: `DUPLICATE signal_id: ${payload.signal_id}` };
  }
  seenIds.add(payload.signal_id);
  return { ok: true, payload };
}

export function validateRequiredFields(raw: unknown): ValidationResult {
  const payload = asPayload(raw);
  if (!payload) {
    return { ok: false, error: "payload must be an object" };
  }

  if (!isNonEmptyString(payload.protocol_version)) {
    return { ok: false, error: "protocol_version is required" };
  }
  if (!isNonEmptyString(payload.signal_id)) {
    return { ok: false, error: "signal_id is required" };
  }
  if (!isNonEmptyString(payload.title)) {
    return { ok: false, error: "title is required" };
  }
  if (!isNonEmptyString(payload.summary)) {
    return { ok: false, error: "summary is required" };
  }

  if (!SOURCE_AIS.includes(payload.source_ai)) {
    return { ok: false, error: "source_ai enum is invalid" };
  }
  if (!SIGNAL_KINDS.includes(payload.signal_kind)) {
    return { ok: false, error: "signal_kind enum is invalid" };
  }
  if (!SIGNAL_PRIORITIES.includes(payload.signal_priority)) {
    return { ok: false, error: "signal_priority enum is invalid" };
  }
  if (typeof payload.human_action_needed !== "boolean") {
    return { ok: false, error: "human_action_needed must be boolean" };
  }
  if (!isNonEmptyString(payload.timestamp) || !isIso8601(payload.timestamp)) {
    return { ok: false, error: "timestamp must be valid ISO 8601" };
  }

  if (payload.status_hint && !SIGNAL_STATUSES.includes(payload.status_hint)) {
    return { ok: false, error: "status_hint enum is invalid" };
  }
  if (payload.target_module_hint && !TARGET_MODULES.includes(payload.target_module_hint)) {
    return { ok: false, error: "target_module_hint enum is invalid" };
  }

  return { ok: true, payload };
}

export function validateMetadata(meta: SignalProducerPayload["metadata"]): ValidationResult {
  const placeholder: SignalProducerPayload = {
    protocol_version: "1.0",
    signal_id: "__metadata_check__",
    source_ai: "SYSTEM",
    title: "metadata-check",
    summary: "metadata-check",
    signal_kind: "info",
    signal_priority: "low",
    human_action_needed: false,
    timestamp: new Date().toISOString(),
    metadata: meta
  };

  if (meta === undefined) {
    return { ok: true, payload: placeholder };
  }

  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
    return { ok: false, error: "metadata must be an object" };
  }

  const keys = Object.keys(meta);
  if (keys.length > 8) {
    return { ok: false, error: "metadata exceeds 8 keys" };
  }

  const hasBlockedPrefix = keys.some((key) => RESTRICTED_METADATA_PREFIXES.some((prefix) => key.startsWith(prefix)));
  if (hasBlockedPrefix) {
    return { ok: false, error: "metadata contains restricted key prefix" };
  }

  const bytes = new TextEncoder().encode(JSON.stringify(meta)).length;
  if (bytes > 512) {
    return { ok: false, error: "metadata exceeds 512 bytes" };
  }

  return { ok: true, payload: placeholder };
}

export function checkNoisiness(payload: SignalProducerPayload): ValidationWarning | null {
  if (payload.signal_kind !== "info" && payload.signal_kind !== "progress") {
    return null;
  }

  const ts = Date.parse(payload.timestamp);
  const windowStart = ts - 60_000;
  const sourceKey = payload.source_ai;
  const previous = emitLog.get(sourceKey) ?? [];
  const inWindow = previous.filter((value) => value >= windowStart);
  const next = [...inWindow, ts];
  emitLog.set(sourceKey, next);

  if (next.length > 3) {
    return {
      kind: "noise_guardrail",
      message: `${payload.source_ai} emitted more than 3 info/progress signals within 60s`,
      signal_id: payload.signal_id
    };
  }

  return null;
}

export function validateSignal(raw: unknown): ValidationResult {
  const required = validateRequiredFields(raw);
  if (!required.ok) {
    return required;
  }

  const unique = validateSignalId(required.payload);
  if (!unique.ok) {
    return unique;
  }

  const metadata = validateMetadata(required.payload.metadata);
  if (!metadata.ok) {
    return metadata;
  }

  return { ok: true, payload: required.payload };
}
