#!/usr/bin/env node

const OPSBOARD_URL = process.env.OPSBOARD_URL || "http://localhost:3002";
const ENDPOINT = `${OPSBOARD_URL}/api/signals`;

let raw = "";
process.stdin.on("data", (chunk) => {
  raw += chunk;
});

process.stdin.on("end", async () => {
  let hook;

  try {
    hook = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const signal = buildSignal(hook);
  if (!signal) process.exit(0);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signal)
    });
    if (!res.ok) {
      const body = await res.text();
      process.stderr.write(`[OpsBoard hook] emit failed: ${res.status} ${body}\n`);
    }
  } catch (err) {
    process.stderr.write(`[OpsBoard hook] unreachable: ${err.message}\n`);
  }

  process.exit(0);
});

function buildSignal(hook) {
  const event = hook.event ?? hook.type ?? "";
  const toolName = hook.tool_name ?? hook.tool ?? "";
  const exitCode = hook.exit_code ?? hook.exitCode ?? null;
  const project = hook.cwd ?? hook.project ?? hook.session_id ?? "unknown";
  const sessionId = hook.session_id ?? null;

  const base = {
    protocol_version: "1.0",
    signal_id: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source_ai: "CLAUDE_CODE",
    source_ai_instance: shortenPath(project),
    timestamp: new Date().toISOString(),
    ...(sessionId ? { correlation_id: sessionId } : {}),
    producer_name: "claude-code-hook"
  };

  if (event === "PreToolUse") {
    if (["Read", "LS", "Glob", "Grep"].includes(toolName)) return null;
    return {
      ...base,
      signal_kind: "approval",
      signal_priority: isHighRiskTool(toolName) ? "high" : "normal",
      human_action_needed: true,
      title: `Claude Code: ${toolName}`,
      summary: buildToolSummary(toolName, hook.tool_input)
    };
  }

  if (event === "PostToolUse") {
    if (!isMeaningfulTool(toolName)) return null;
    return {
      ...base,
      signal_kind: "progress",
      signal_priority: "low",
      human_action_needed: false,
      title: `${toolName} completed`,
      summary: `Claude Code used ${toolName} in ${shortenPath(project)}.`
    };
  }

  if (event === "Stop") {
    const succeeded = exitCode === 0 || exitCode === null;
    return {
      ...base,
      signal_kind: succeeded ? "progress" : "blocked",
      signal_priority: succeeded ? "normal" : "high",
      human_action_needed: !succeeded,
      title: succeeded ? "Claude Code session completed" : `Claude Code session failed (exit ${exitCode})`,
      summary: succeeded
        ? `Session finished in ${shortenPath(project)}. Output ready for review.`
        : `Session exited with code ${exitCode} in ${shortenPath(project)}. Review required.`
    };
  }

  if (event === "SubagentStop") {
    return {
      ...base,
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      title: "Claude Code subagent completed",
      summary: `Subagent task finished in ${shortenPath(project)}.`
    };
  }

  return null;
}

function isHighRiskTool(name) {
  return ["Bash", "Write", "Edit", "MultiEdit", "WebFetch"].includes(name);
}

function isMeaningfulTool(name) {
  return ["Bash", "Write", "Edit", "MultiEdit", "WebSearch"].includes(name);
}

function buildToolSummary(toolName, input) {
  if (!input) return `About to use ${toolName} in Claude Code session.`;
  if (toolName === "Bash" && input.command) {
    const cmd = String(input.command).slice(0, 80);
    return `Command: ${cmd}${input.command.length > 80 ? "..." : ""}`;
  }
  if ((toolName === "Write" || toolName === "Edit") && input.path) {
    return `File: ${shortenPath(input.path)}`;
  }
  if (toolName === "WebFetch" && input.url) {
    return `Fetching: ${input.url}`;
  }
  return `${toolName} about to execute in Claude Code session.`;
}

function shortenPath(p) {
  if (!p) return "unknown";
  const parts = String(p).split("/");
  return parts.slice(-2).join("/") || p;
}
