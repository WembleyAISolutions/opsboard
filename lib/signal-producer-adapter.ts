import type { NormalizedSignal, SignalProducerPayload } from "../types/signal-producer";

function assertNever(value: never): never {
  throw new Error(`Unhandled normalization case: ${String(value)}`);
}

export function normalize(payload: SignalProducerPayload): NormalizedSignal {
  const normalizedAt = new Date().toISOString();

  const build = (signal_status: NormalizedSignal["signal_status"], target_module: NormalizedSignal["target_module"]): NormalizedSignal => ({
    ...payload,
    signal_status,
    target_module,
    normalized_at: normalizedAt
  });

  switch (payload.signal_kind) {
    case "approval":
      return build("approval", "approvals");

    case "blocked":
      if (payload.human_action_needed) {
        return build("blocked", "signal");
      }
      return build("blocked", "signal");

    case "attention":
      if (payload.human_action_needed) {
        return build("pending", "signal");
      }
      return build("pending", "signal");

    case "input":
      if (payload.target_module_hint === "voice") {
        return build("pending", "voice");
      }
      return build("pending", "inbox");

    case "progress":
      if (payload.human_action_needed) {
        return build("doing", "signal");
      }
      return build("doing", "signal");

    case "info":
      if (payload.human_action_needed) {
        return build("pending", "signal");
      }
      return build("pending", "inbox");

    default:
      return assertNever(payload.signal_kind as never);
  }
}

export function adaptProducerSignal(payload: SignalProducerPayload): NormalizedSignal {
  return normalize(payload);
}
