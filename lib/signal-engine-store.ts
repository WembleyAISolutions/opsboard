import { createSignalEngine } from "@/lib/signal-engine";
import { normalize } from "@/lib/signal-producer-adapter";
import type { LocalSignalEngine } from "@/lib/signal-engine";
import type { SignalProducerPayload } from "@/types/signal-producer";

const STORE_KEY = "__opsboard_signal_engine__";
const START_KEY = "__opsboard_signal_engine_started_at__";

const seedSignals: SignalProducerPayload[] = [
  {
    protocol_version: "1.0",
    signal_id: "seed-dev-001",
    source_ai: "DEV_AI",
    source_ai_instance: "backend",
    signal_kind: "blocked",
    signal_priority: "high",
    human_action_needed: true,
    title: "Build pipeline blocked",
    summary: "Dependency install failed in CI. Manual review required.",
    timestamp: "2026-03-11T09:00:00.000Z"
  },
  {
    protocol_version: "1.0",
    signal_id: "seed-finance-001",
    source_ai: "FINANCE_AI",
    signal_kind: "approval",
    signal_priority: "high",
    human_action_needed: true,
    title: "Invoice approval required",
    summary: "Supplier invoice $4,200 AUD due Friday. Approve to schedule payment.",
    timestamp: "2026-03-11T09:02:00.000Z"
  },
  {
    protocol_version: "1.0",
    signal_id: "seed-home-001",
    source_ai: "HOME_AI",
    signal_kind: "attention",
    signal_priority: "normal",
    human_action_needed: true,
    title: "Parent-teacher booking needed",
    summary: "Booking window closes Friday. Confirm preferred time slot.",
    timestamp: "2026-03-11T09:04:00.000Z"
  },
  {
    protocol_version: "1.0",
    signal_id: "seed-system-001",
    source_ai: "SYSTEM",
    signal_kind: "info",
    signal_priority: "low",
    human_action_needed: false,
    title: "OpsBoard v0.4 active",
    summary: "Signal gateway is live. Webhook transport ready at POST /api/signals.",
    timestamp: "2026-03-11T09:06:00.000Z"
  }
];

function activeSignals(engine: LocalSignalEngine) {
  return engine.getSignals().filter((signal) => !signal.is_dismissed);
}

export function getSignalEngine(): LocalSignalEngine {
  const globalState = globalThis as typeof globalThis & {
    [STORE_KEY]?: LocalSignalEngine;
    [START_KEY]?: number;
  };

  if (!globalState[STORE_KEY]) {
    const engine = createSignalEngine();
    engine.ingestMany(seedSignals.map((payload) => normalize(payload)));
    globalState[STORE_KEY] = engine;
    globalState[START_KEY] = Date.now();
  }

  return globalState[STORE_KEY] as LocalSignalEngine;
}

export function getSignalEngineUptimeMs(): number {
  const globalState = globalThis as typeof globalThis & { [START_KEY]?: number };
  const started = globalState[START_KEY] ?? Date.now();
  return Date.now() - started;
}

export function getSignalSourceBreakdown(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const signal of activeSignals(getSignalEngine())) {
    result[signal.source_ai] = (result[signal.source_ai] ?? 0) + 1;
  }
  return result;
}

export function getSignalCountsByModule(): Record<string, number> {
  const base: Record<string, number> = {
    inbox: 0,
    signal: 0,
    approvals: 0,
    voice: 0,
    today_summary_only: 0
  };

  for (const signal of activeSignals(getSignalEngine())) {
    base[signal.target_module] = (base[signal.target_module] ?? 0) + 1;
  }

  return base;
}

export function getActiveSignalCount(): number {
  return activeSignals(getSignalEngine()).length;
}

export function resetSignalEngineStoreForTests(): void {
  const globalState = globalThis as typeof globalThis & {
    [STORE_KEY]?: LocalSignalEngine;
    [START_KEY]?: number;
  };
  delete globalState[STORE_KEY];
  delete globalState[START_KEY];
}
