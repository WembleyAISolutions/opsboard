import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { EmitResult } from "../../types/signal-producer";

export type GeminiApiResponse = {
  finishReason: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER" | "BLOCKLIST" | "PROHIBITED_CONTENT" | "SPII";
  candidates?: Array<{ content?: unknown }>;
};

export type GeminiAdapterContext = {
  source_ai_instance: string;
  task_description: string;
  correlation_id?: string;
};

function emitBase(context: GeminiAdapterContext) {
  return {
    protocol_version: "1.0" as const,
    source_ai: "GEMINI" as const,
    source_ai_instance: context.source_ai_instance,
    correlation_id: context.correlation_id,
    timestamp: new Date().toISOString()
  };
}

export async function emitFromGeminiResponse(
  response: GeminiApiResponse,
  context: GeminiAdapterContext,
  engine: SignalEngine
): Promise<EmitResult> {
  const base = emitBase(context);

  if (response.finishReason === "STOP") {
    return emitSignal(
      {
        ...base,
        signal_id: `gemini-stop-${Date.now()}`,
        signal_kind: "progress",
        signal_priority: "normal",
        human_action_needed: false,
        title: "Gemini task completed",
        summary: `${context.task_description} — output ready.`
      },
      engine
    );
  }

  if (response.finishReason === "MAX_TOKENS") {
    return emitSignal(
      {
        ...base,
        signal_id: `gemini-max-tokens-${Date.now()}`,
        signal_kind: "attention",
        signal_priority: "normal",
        human_action_needed: true,
        title: "Gemini response truncated",
        summary: `${context.task_description} hit token limit. Review or retry.`
      },
      engine
    );
  }

  if (
    response.finishReason === "SAFETY" ||
    response.finishReason === "RECITATION" ||
    response.finishReason === "PROHIBITED_CONTENT" ||
    response.finishReason === "BLOCKLIST" ||
    response.finishReason === "SPII"
  ) {
    return emitSignal(
      {
        ...base,
        signal_id: `gemini-blocked-${Date.now()}`,
        signal_kind: "blocked",
        signal_priority: "high",
        human_action_needed: true,
        title: `Gemini blocked: ${response.finishReason}`,
        summary: `${context.task_description} was blocked by Gemini safety filters.`
      },
      engine
    );
  }

  return emitSignal(
    {
      ...base,
      signal_id: `gemini-other-${Date.now()}`,
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      title: "Gemini finished with unspecified reason",
      summary: `${context.task_description} completed with reason: OTHER.`
    },
    engine
  );
}
