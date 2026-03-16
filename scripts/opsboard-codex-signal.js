#!/usr/bin/env node

const LOCAL_BASE_URL = "http://localhost:3002";
const FALLBACK_BASE_URL = "https://opsboard-seven.vercel.app";
const LOCAL_TIMEOUT_MS = 2000;

const EVENT_CONFIG = {
  task_start: {
    signal_kind: "progress",
    signal_priority: "low",
    human_action_needed: false
  },
  task_complete: {
    signal_kind: "progress",
    signal_priority: "normal",
    human_action_needed: false
  },
  task_blocked: {
    signal_kind: "blocked",
    signal_priority: "high",
    human_action_needed: true
  },
  task_failed: {
    signal_kind: "blocked",
    signal_priority: "high",
    human_action_needed: true
  },
  approval_needed: {
    signal_kind: "approval",
    signal_priority: "high",
    human_action_needed: true
  },
  progress: {
    signal_kind: "progress",
    signal_priority: "low",
    human_action_needed: false
  }
};

const ALLOWED_PRIORITIES = new Set(["low", "normal", "high"]);

function logErr(message) {
  process.stderr.write(`${message}\n`);
}

function random4() {
  return Math.random().toString(36).slice(2, 6);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isLocalReachable() {
  const statusUrl = `${LOCAL_BASE_URL}/api/signals/status`;
  try {
    const response = await fetchWithTimeout(statusUrl, { method: "GET" }, LOCAL_TIMEOUT_MS);
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveEndpoint() {
  if (process.env.OPSBOARD_URL) {
    return {
      endpoint: `${process.env.OPSBOARD_URL.replace(/\/$/, "")}/api/signals`,
      used: "env"
    };
  }

  const localOk = await isLocalReachable();
  if (localOk) {
    return {
      endpoint: `${LOCAL_BASE_URL}/api/signals`,
      used: "local"
    };
  }

  return {
    endpoint: `${FALLBACK_BASE_URL}/api/signals`,
    used: "vercel-fallback"
  };
}

function buildPayload(args) {
  const event = args.event;
  const eventConfig = EVENT_CONFIG[event];
  if (!eventConfig) {
    logErr(`[codex-signal] invalid --event "${String(event)}"`);
    return null;
  }

  const title = typeof args.title === "string" ? args.title.trim() : "";
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  if (!title || !summary) {
    logErr("[codex-signal] --title and --summary are required");
    return null;
  }

  const requestedPriority = typeof args.priority === "string" ? args.priority.trim() : "";
  const signalPriority = requestedPriority && ALLOWED_PRIORITIES.has(requestedPriority)
    ? requestedPriority
    : eventConfig.signal_priority;

  const payload = {
    protocol_version: "1.0",
    signal_id: `codex-${event}-${Date.now()}-${random4()}`,
    source_ai: "CLAUDE_CODE",
    signal_kind: eventConfig.signal_kind,
    signal_priority: signalPriority,
    human_action_needed: eventConfig.human_action_needed,
    title,
    summary,
    timestamp: new Date().toISOString(),
    producer_name: "codex-signal-emitter"
  };

  if (args.session) {
    payload.correlation_id = args.session;
  }
  if (args.workflow) {
    payload.workflow_id = args.workflow;
  }
  return payload;
}

async function emitSignal(payload) {
  const resolution = await resolveEndpoint();
  const endpoint = resolution.endpoint;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      logErr(`[codex-signal] emit failed via ${resolution.used}: ${response.status} ${body}`);
      return;
    }

    let signalId = payload.signal_id;
    try {
      const json = await response.json();
      if (json && typeof json.signal_id === "string") {
        signalId = json.signal_id;
      }
    } catch {
      // Ignore JSON parse errors and keep fallback signal_id.
    }
    logErr(`[codex-signal] emitted ${signalId} via ${resolution.used} (${endpoint})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logErr(`[codex-signal] unreachable via ${resolution.used}: ${message}`);
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.event) {
      logErr("[codex-signal] --event is required");
      return;
    }
    const payload = buildPayload(args);
    if (!payload) {
      return;
    }
    await emitSignal(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logErr(`[codex-signal] unexpected error: ${message}`);
  }
}

void main().finally(() => {
  process.exit(0);
});
