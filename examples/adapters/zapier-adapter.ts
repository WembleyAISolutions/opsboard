import type { SignalKind, SignalPriority, SignalProducerPayload, SourceAI } from "../../types/signal-producer";

/*
 * Zapier setup (no code, 2 minutes):
 * Add action -> Webhooks by Zapier -> POST
 * URL: http://localhost:3002/api/webhooks/zapier
 * Payload type: json
 * Data: { source, kind, priority, title, summary, action_needed }
 *
 * Make (Integromat) setup:
 * HTTP module -> Make a request -> POST -> JSON body
 * Same fields as above.
 */

type SimplifiedZapierPayload = {
  source?: string;
  kind?: string;
  priority?: string;
  title?: string;
  summary?: string;
  action_needed?: boolean;
  ref?: string;
  workflow?: string;
  approval?: string;
};

const KNOWN_SOURCE_AI: ReadonlySet<SourceAI> = new Set<SourceAI>([
  "DEV_AI",
  "FINANCE_AI",
  "HOME_AI",
  "BUSINESS_AI",
  "TAX_AI",
  "SYSTEM",
  "CLAUDE",
  "CLAUDE_CODE",
  "OPENAI",
  "GEMINI",
  "APPLE_DEV",
  "CUSTOM"
]);

const KNOWN_SIGNAL_KINDS: ReadonlySet<SignalKind> = new Set<SignalKind>([
  "input",
  "info",
  "attention",
  "approval",
  "progress",
  "blocked"
]);

const KNOWN_SIGNAL_PRIORITIES: ReadonlySet<SignalPriority> = new Set<SignalPriority>(["low", "normal", "high"]);

function random4(): string {
  return Math.random().toString(36).slice(2, 6);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asSignalProducerPayload(raw: unknown): SignalProducerPayload | null {
  const body = asObject(raw);
  if (!body) {
    return null;
  }
  return body as SignalProducerPayload;
}

function hasNativeProtocol(raw: unknown): raw is SignalProducerPayload {
  const payload = asSignalProducerPayload(raw);
  return Boolean(payload?.protocol_version);
}

function isNativePayloadValid(payload: SignalProducerPayload): boolean {
  return (
    typeof payload.protocol_version === "string" &&
    typeof payload.signal_id === "string" &&
    payload.signal_id.length > 0 &&
    typeof payload.title === "string" &&
    payload.title.length > 0 &&
    typeof payload.summary === "string" &&
    payload.summary.length > 0 &&
    KNOWN_SOURCE_AI.has(payload.source_ai) &&
    KNOWN_SIGNAL_KINDS.has(payload.signal_kind) &&
    KNOWN_SIGNAL_PRIORITIES.has(payload.signal_priority) &&
    typeof payload.human_action_needed === "boolean" &&
    typeof payload.timestamp === "string" &&
    Number.isFinite(Date.parse(payload.timestamp))
  );
}

function mapSimplifiedPayload(body: SimplifiedZapierPayload): SignalProducerPayload | null {
  if (!body.source || !body.kind || !body.title || !body.summary) {
    console.error("[zapier-adapter] invalid simplified payload: missing required fields");
    return null;
  }

  if (!KNOWN_SIGNAL_KINDS.has(body.kind as SignalKind)) {
    console.error(`[zapier-adapter] invalid kind: ${String(body.kind)}`);
    return null;
  }

  const signalPriority = KNOWN_SIGNAL_PRIORITIES.has(body.priority as SignalPriority)
    ? (body.priority as SignalPriority)
    : "normal";

  const sourceAI = KNOWN_SOURCE_AI.has(body.source as SourceAI) ? (body.source as SourceAI) : "CUSTOM";
  const sourceLower = String(body.source).toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  return {
    protocol_version: "1.0",
    signal_id: `zap-${sourceLower}-${Date.now()}-${random4()}`,
    source_ai: sourceAI,
    title: body.title,
    summary: body.summary,
    signal_kind: body.kind as SignalKind,
    signal_priority: signalPriority,
    human_action_needed: typeof body.action_needed === "boolean" ? body.action_needed : true,
    timestamp: new Date().toISOString(),
    source_ref: body.ref,
    producer_name: "zapier-adapter",
    correlation_id: body.workflow
  };
}

export function mapZapierPayloadToSignal(body: unknown): SignalProducerPayload | null {
  if (hasNativeProtocol(body)) {
    if (!isNativePayloadValid(body)) {
      console.error("[zapier-adapter] invalid native protocol payload");
      return null;
    }
    return body;
  }

  const simplified = asObject(body) as SimplifiedZapierPayload | null;
  if (!simplified) {
    console.error("[zapier-adapter] payload must be an object");
    return null;
  }

  return mapSimplifiedPayload(simplified);
}

export const ZAPIER_FINANCE_TEST = {
  source: "FINANCE_AI",
  kind: "approval",
  priority: "high",
  title: "Invoice approval required",
  summary: "Supplier invoice $4,200 AUD due Friday.",
  action_needed: true,
  ref: "https://app.xero.com/invoices/INV-0042",
  workflow: "wf_finance_mar_2026"
};

export const ZAPIER_BUSINESS_TEST = {
  source: "BUSINESS_AI",
  kind: "attention",
  priority: "normal",
  title: "Customer inquiry flagged as urgent",
  summary: "High-priority support request received. Review within 24h.",
  action_needed: true
};
