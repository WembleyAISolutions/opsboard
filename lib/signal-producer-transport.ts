import { normalize } from "./signal-producer-adapter";
import { checkNoisiness, validateSignal } from "./signal-producer-validator";
import type { SignalItem } from "../types/signal";
import type { DeadSignal, EmitResult, NormalizedSignal, SignalProducerPayload, ValidationWarning } from "../types/signal-producer";

export interface SignalEngine {
  ingest(signal: NormalizedSignal): void;
  recordDeadSignal(dead: DeadSignal): void;
  recordWarning?(warning: ValidationWarning): void;
}

function toDeadSignal(payload: SignalProducerPayload, error: string): DeadSignal {
  return {
    signal_id: payload.signal_id || "unknown",
    source_ai: payload.source_ai || "unknown",
    error,
    raw: payload,
    failed_at: new Date().toISOString()
  };
}

export async function emitSignal(payload: SignalProducerPayload, engine: SignalEngine): Promise<EmitResult> {
  const validation = validateSignal(payload);
  if (!validation.ok) {
    const error = "error" in validation ? validation.error : "validation failed";
    engine.recordDeadSignal(toDeadSignal(payload, error));
    return { ok: false, error };
  }

  const warning = checkNoisiness(validation.payload);
  if (warning) {
    console.warn(`[SIGNAL WARNING] ${warning.signal_id}: ${warning.message}`);
    if (engine.recordWarning) {
      engine.recordWarning(warning);
    }
  }

  const normalized = normalize(validation.payload);
  engine.ingest(normalized);
  return { ok: true, signal_id: validation.payload.signal_id };
}

export async function emitSignalRemote(payload: SignalProducerPayload, endpoint: string): Promise<EmitResult> {
  const validation = validateSignal(payload);
  if (!validation.ok) {
    const error = "error" in validation ? validation.error : "validation failed";
    return { ok: false, error };
  }

  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/signals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Protocol-Version": payload.protocol_version
      },
      body: JSON.stringify(validation.payload)
    });

    if (!response.ok) {
      return { ok: false, error: `remote emit failed: ${response.status}` };
    }

    return { ok: true, signal_id: validation.payload.signal_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown remote emit error";
    return { ok: false, error: message };
  }
}

type ProducerIngestionResult = {
  signals: SignalItem[];
  deadSignals: DeadSignal[];
  warnings: ValidationWarning[];
};

function toSignalItem(signal: NormalizedSignal): SignalItem {
  return {
    signal_id: signal.signal_id,
    source_ai: signal.source_ai,
    title: signal.title,
    summary: signal.summary,
    signal_kind: signal.signal_kind,
    signal_status: signal.signal_status,
    signal_priority: signal.signal_priority,
    target_module: signal.target_module,
    human_action_needed: signal.human_action_needed,
    created_at: signal.timestamp,
    updated_at: signal.timestamp
  };
}

export async function ingestLocalProducerSignals(payloads: SignalProducerPayload[], engine: SignalEngine): Promise<EmitResult[]> {
  const results: EmitResult[] = [];
  for (const payload of payloads) {
    const result = await emitSignal(payload, engine);
    results.push(result);
  }
  return results;
}

export function ingestLocalProducerSignalsSnapshot(payloads: SignalProducerPayload[]): ProducerIngestionResult {
  const normalizedSignals: NormalizedSignal[] = [];
  const deadSignals: DeadSignal[] = [];
  const warnings: ValidationWarning[] = [];

  const engine: SignalEngine = {
    ingest(signal) {
      normalizedSignals.push(signal);
    },
    recordDeadSignal(dead) {
      deadSignals.push(dead);
    },
    recordWarning(warning) {
      warnings.push(warning);
    }
  };

  payloads.forEach((payload) => {
    void emitSignal(payload, engine);
  });

  return {
    signals: normalizedSignals.map(toSignalItem),
    deadSignals,
    warnings
  };
}
