import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { EmitResult, SignalProducerPayload } from "../../types/signal-producer";

export type ClaudeApiResponse = {
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  content: Array<{ type: string; name?: string; text?: string }>;
};

export type ClaudeAdapterContext = {
  source_ai_instance: string;
  task_description: string;
  correlation_id?: string;
};

function buildSignalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function firstToolName(content: ClaudeApiResponse["content"]): string {
  const tool = content.find((item) => item.type === "tool_use" || item.name);
  return tool?.name ?? "unknown-tool";
}

export async function emitFromClaudeResponse(
  response: ClaudeApiResponse,
  context: ClaudeAdapterContext,
  engine: SignalEngine
): Promise<EmitResult> {
  const base: Omit<SignalProducerPayload, "signal_id" | "signal_kind" | "signal_priority" | "human_action_needed" | "title" | "summary"> = {
    protocol_version: "1.0",
    source_ai: "CLAUDE",
    timestamp: new Date().toISOString(),
    source_ai_instance: context.source_ai_instance,
    correlation_id: context.correlation_id
  };

  if (response.stop_reason === "tool_use") {
    return emitSignal(
      {
        ...base,
        signal_id: buildSignalId("claude-tool-use"),
        signal_kind: "approval",
        signal_priority: "high",
        human_action_needed: true,
        title: "Claude requesting tool use",
        summary: `Tool: ${firstToolName(response.content)}. Approve to proceed.`
      },
      engine
    );
  }

  if (response.stop_reason === "end_turn") {
    return emitSignal(
      {
        ...base,
        signal_id: buildSignalId("claude-end-turn"),
        signal_kind: "progress",
        signal_priority: "normal",
        human_action_needed: false,
        title: "Claude task completed",
        summary: `${context.task_description} — output ready for review.`
      },
      engine
    );
  }

  if (response.stop_reason === "max_tokens") {
    return emitSignal(
      {
        ...base,
        signal_id: buildSignalId("claude-max-tokens"),
        signal_kind: "attention",
        signal_priority: "high",
        human_action_needed: true,
        title: "Claude response truncated",
        summary: `Response hit token limit during: ${context.task_description}`
      },
      engine
    );
  }

  return emitSignal(
    {
      ...base,
      signal_id: buildSignalId("claude-stop-sequence"),
      signal_kind: "progress",
      signal_priority: "low",
      human_action_needed: false,
      title: "Claude reached stop sequence",
      summary: `${context.task_description} — stopped at defined boundary.`
    },
    engine
  );
}

export async function emitClaudeError(
  error: { message: string; type?: string },
  context: ClaudeAdapterContext,
  engine: SignalEngine
): Promise<EmitResult> {
  return emitSignal(
    {
      protocol_version: "1.0",
      signal_id: buildSignalId("claude-error"),
      source_ai: "CLAUDE",
      source_ai_instance: context.source_ai_instance,
      correlation_id: context.correlation_id,
      title: "Claude API error",
      summary: error.message,
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      timestamp: new Date().toISOString()
    },
    engine
  );
}
