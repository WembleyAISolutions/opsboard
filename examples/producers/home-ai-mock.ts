import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { EmitResult, SignalProducerPayload } from "../../types/signal-producer";

export async function runHomeAIMockProducer(engine: SignalEngine): Promise<EmitResult[]> {
  const baseTimestamp = Date.now();

  const signals: SignalProducerPayload[] = [
    {
      protocol_version: "1.0",
      signal_id: "home-001",
      source_ai: "HOME_AI",
      signal_kind: "input",
      signal_priority: "normal",
      human_action_needed: false,
      title: "School email received",
      summary: "Email from school re: upcoming parent-teacher interviews. Action may be required.",
      timestamp: new Date(baseTimestamp).toISOString()
    },
    {
      protocol_version: "1.0",
      signal_id: "home-002",
      source_ai: "HOME_AI",
      signal_kind: "attention",
      signal_priority: "normal",
      human_action_needed: true,
      title: "Parent-teacher booking needed",
      summary: "Booking window closes Friday. Confirm preferred time slot to proceed.",
      timestamp: new Date(baseTimestamp + 1000).toISOString()
    },
    {
      protocol_version: "1.0",
      signal_id: "home-003",
      source_ai: "HOME_AI",
      signal_kind: "progress",
      signal_priority: "low",
      human_action_needed: false,
      title: "Interview booking confirmed",
      summary: "Thursday 4:30pm slot confirmed. Calendar invite sent.",
      timestamp: new Date(baseTimestamp + 2000).toISOString()
    },
    {
      protocol_version: "1.0",
      signal_id: "home-004",
      source_ai: "HOME_AI",
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      title: "School follow-up complete",
      summary: "All actions from school email resolved. No further follow-up needed.",
      timestamp: new Date(baseTimestamp + 3000).toISOString()
    }
  ];

  const results: EmitResult[] = [];
  for (const payload of signals) {
    const result = await emitSignal(payload, engine);
    results.push(result);
  }
  return results;
}
