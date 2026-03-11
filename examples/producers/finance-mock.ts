import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { SignalProducerPayload } from "../../types/signal-producer";

export async function runFinanceMockProducer(engine: SignalEngine): Promise<void> {
  const baseTimestamp = Date.now();

  const signals: SignalProducerPayload[] = [
    {
      protocol_version: "1.0",
      signal_id: "finance-mock-001",
      source_ai: "FINANCE_AI",
      title: "Invoice awaiting approval",
      summary: "Supplier invoice requires payment approval.",
      signal_kind: "approval",
      signal_priority: "high",
      human_action_needed: true,
      timestamp: new Date(baseTimestamp).toISOString(),
      correlation_id: "invoice-batch-mar-11"
    },
    {
      protocol_version: "1.0",
      signal_id: "finance-mock-002",
      source_ai: "FINANCE_AI",
      title: "Invoice batch processing",
      summary: "Processing 3 invoices in current batch.",
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      timestamp: new Date(baseTimestamp + 1000).toISOString()
    },
    {
      protocol_version: "1.0",
      signal_id: "finance-mock-003",
      source_ai: "FINANCE_AI",
      title: "Tax calculation started",
      summary: "Monthly tax calculation has begun.",
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      timestamp: new Date(baseTimestamp + 2000).toISOString()
    },
    {
      protocol_version: "1.0",
      signal_id: "finance-mock-004",
      source_ai: "FINANCE_AI",
      title: "Report generation queued",
      summary: "End of month report is queued.",
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      timestamp: new Date(baseTimestamp + 3000).toISOString()
    }
  ];

  for (const payload of signals) {
    const result = await emitSignal(payload, engine);
    console.log(result);
  }
}
