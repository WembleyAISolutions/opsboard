import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { SignalProducerPayload } from "../../types/signal-producer";

export async function runDevAIMockProducer(engine: SignalEngine): Promise<void> {
  const baseTimestamp = Date.now();

  const signals: SignalProducerPayload[] = [
    {
      protocol_version: "1.0",
      signal_id: "dev-mock-001",
      source_ai: "DEV_AI",
      source_ai_instance: "backend",
      title: "Build pipeline needs review",
      summary: "CI failed during dependency install.",
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      timestamp: new Date(baseTimestamp).toISOString()
    },
    {
      protocol_version: "1.0",
      signal_id: "dev-mock-002",
      source_ai: "DEV_AI",
      source_ai_instance: "backend",
      title: "Dependency install complete",
      summary: "Pipeline resumed after manual intervention.",
      signal_kind: "progress",
      signal_priority: "normal",
      human_action_needed: false,
      timestamp: new Date(baseTimestamp + 1000).toISOString()
    },
    {
      protocol_version: "1.0",
      signal_id: "dev-mock-001",
      source_ai: "DEV_AI",
      title: "Duplicate signal test",
      summary: "This signal must be rejected.",
      signal_kind: "attention",
      signal_priority: "low",
      human_action_needed: false,
      timestamp: new Date(baseTimestamp + 2000).toISOString()
    }
  ];

  for (const payload of signals) {
    const result = await emitSignal(payload, engine);
    if (!result.ok) {
      console.log("[REJECTED]", result.error);
    } else {
      console.log(result);
    }
  }
}
