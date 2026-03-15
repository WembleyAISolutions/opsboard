import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { EmitResult } from "../../types/signal-producer";

export type OpenAIRunStatus = {
  id: string;
  status:
    | "queued"
    | "in_progress"
    | "requires_action"
    | "cancelling"
    | "cancelled"
    | "failed"
    | "completed"
    | "incomplete"
    | "expired";
  required_action?: { type: string };
  last_error?: { code: string; message: string };
};

export type OpenAIAdapterContext = {
  source_ai_instance: string;
  task_description: string;
};

export async function emitFromOpenAIRun(
  run: OpenAIRunStatus,
  context: OpenAIAdapterContext,
  engine: SignalEngine
): Promise<EmitResult> {
  const base = {
    protocol_version: "1.0" as const,
    source_ai: "OPENAI" as const,
    source_ai_instance: context.source_ai_instance,
    correlation_id: run.id,
    timestamp: new Date().toISOString()
  };

  if (run.status === "requires_action") {
    return emitSignal(
      {
        ...base,
        signal_id: `openai-requires-action-${run.id}`,
        signal_kind: "approval",
        signal_priority: "high",
        human_action_needed: true,
        title: "OpenAI Assistant requires action",
        summary: `${context.task_description} — action type: ${run.required_action?.type ?? "unknown"}`
      },
      engine
    );
  }

  if (run.status === "completed") {
    return emitSignal(
      {
        ...base,
        signal_id: `openai-completed-${run.id}`,
        signal_kind: "progress",
        signal_priority: "normal",
        human_action_needed: false,
        title: "OpenAI run completed",
        summary: `${context.task_description} finished successfully.`
      },
      engine
    );
  }

  if (run.status === "failed") {
    return emitSignal(
      {
        ...base,
        signal_id: `openai-failed-${run.id}`,
        signal_kind: "blocked",
        signal_priority: "high",
        human_action_needed: true,
        title: "OpenAI run failed",
        summary: run.last_error?.message ?? "Run failed. Check assistant logs."
      },
      engine
    );
  }

  if (run.status === "in_progress") {
    return emitSignal(
      {
        ...base,
        signal_id: `openai-in-progress-${run.id}`,
        signal_kind: "progress",
        signal_priority: "low",
        human_action_needed: false,
        title: "OpenAI run in progress",
        summary: `${context.task_description} is running.`
      },
      engine
    );
  }

  if (run.status === "expired" || run.status === "cancelled") {
    return emitSignal(
      {
        ...base,
        signal_id: `openai-${run.status}-${run.id}`,
        signal_kind: "attention",
        signal_priority: "normal",
        human_action_needed: true,
        title: `OpenAI run ${run.status}`,
        summary: `${context.task_description} did not complete. Review required.`
      },
      engine
    );
  }

  return { ok: true, signal_id: `openai-skip-${run.id}` };
}
