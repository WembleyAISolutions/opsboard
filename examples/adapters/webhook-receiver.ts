import { normalize } from "../../lib/signal-producer-adapter";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import { validateSignal } from "../../lib/signal-producer-validator";
import type { EmitResult, SignalProducerPayload } from "../../types/signal-producer";

function toDeadSignal(payload: SignalProducerPayload, error: string) {
  return {
    signal_id: payload.signal_id || "unknown",
    source_ai: payload.source_ai || "unknown",
    error,
    raw: payload,
    failed_at: new Date().toISOString()
  };
}

export async function handleWebhookPayload(raw: unknown, engine: SignalEngine): Promise<EmitResult> {
  const payload = raw as SignalProducerPayload;
  const validation = validateSignal(payload);
  if (!validation.ok) {
    const error = "error" in validation ? validation.error : "validation failed";
    engine.recordDeadSignal(toDeadSignal(payload, error));
    return { ok: false, error };
  }

  const normalized = normalize(validation.payload);
  engine.ingest(normalized);
  return { ok: true, signal_id: validation.payload.signal_id };
}

export function getWebhookHandlerInfo(): {
  method: "POST";
  path: "/signals";
  content_type: "application/json";
  required_header: "X-Protocol-Version";
  note: "Phase 4 — wire to Express/Next.js API route when ready";
} {
  return {
    method: "POST",
    path: "/signals",
    content_type: "application/json",
    required_header: "X-Protocol-Version",
    note: "Phase 4 — wire to Express/Next.js API route when ready"
  };
}
