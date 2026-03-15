import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { EmitResult } from "../../types/signal-producer";

export type ClaudeCodeHookPayload = {
  event: "PreToolUse" | "PostToolUse" | "Stop" | "SubagentStop";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  exit_code?: number;
  session_id?: string;
  project?: string;
};

function buildSignalId(event: ClaudeCodeHookPayload["event"]): string {
  return `claude-code-${event.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function emitFromClaudeCodeHook(hook: ClaudeCodeHookPayload, engine: SignalEngine): Promise<EmitResult> {
  const project = hook.project ?? "unknown";
  const sourceInstance = hook.project ?? "cli";

  if (hook.event === "PreToolUse") {
    return emitSignal(
      {
        protocol_version: "1.0",
        signal_id: buildSignalId("PreToolUse"),
        source_ai: "CLAUDE_CODE",
        source_ai_instance: sourceInstance,
        correlation_id: hook.session_id,
        title: `Claude Code about to use tool: ${hook.tool_name ?? "unknown-tool"}`,
        summary: `Review before execution. Project: ${project}`,
        signal_kind: "approval",
        signal_priority: "high",
        human_action_needed: true,
        timestamp: new Date().toISOString()
      },
      engine
    );
  }

  if (hook.event === "PostToolUse") {
    return emitSignal(
      {
        protocol_version: "1.0",
        signal_id: buildSignalId("PostToolUse"),
        source_ai: "CLAUDE_CODE",
        source_ai_instance: sourceInstance,
        correlation_id: hook.session_id,
        title: `Claude Code used tool: ${hook.tool_name ?? "unknown-tool"}`,
        summary: `Tool execution completed in project: ${project}`,
        signal_kind: "progress",
        signal_priority: "low",
        human_action_needed: false,
        timestamp: new Date().toISOString()
      },
      engine
    );
  }

  if (hook.event === "Stop") {
    if (hook.exit_code === 0) {
      return emitSignal(
        {
          protocol_version: "1.0",
          signal_id: buildSignalId("Stop"),
          source_ai: "CLAUDE_CODE",
          source_ai_instance: sourceInstance,
          correlation_id: hook.session_id,
          title: "Claude Code session completed",
          summary: `Session finished successfully. Project: ${project}`,
          signal_kind: "progress",
          signal_priority: "normal",
          human_action_needed: false,
          timestamp: new Date().toISOString()
        },
        engine
      );
    }

    return emitSignal(
      {
        protocol_version: "1.0",
        signal_id: buildSignalId("Stop"),
        source_ai: "CLAUDE_CODE",
        source_ai_instance: sourceInstance,
        correlation_id: hook.session_id,
        title: "Claude Code session failed",
        summary: `Session exited with code ${hook.exit_code ?? -1}. Project: ${project}`,
        signal_kind: "blocked",
        signal_priority: "high",
        human_action_needed: true,
        timestamp: new Date().toISOString()
      },
      engine
    );
  }

  return emitSignal(
    {
      protocol_version: "1.0",
      signal_id: buildSignalId("SubagentStop"),
      source_ai: "CLAUDE_CODE",
      source_ai_instance: sourceInstance,
      correlation_id: hook.session_id,
      title: "Claude Code subagent completed",
      summary: `Subagent task finished. Project: ${project}`,
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      timestamp: new Date().toISOString()
    },
    engine
  );
}
