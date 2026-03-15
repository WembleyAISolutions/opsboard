import assert from "node:assert/strict";
import test from "node:test";
import { emitFromAppStoreConnect, emitFromTestFlight, emitFromXcodeBuild } from "../examples/adapters/apple-dev-adapter";
import { emitFromClaudeResponse, emitClaudeError } from "../examples/adapters/claude-adapter";
import { emitFromClaudeCodeHook } from "../examples/adapters/claude-code-adapter";
import { emitFromGeminiResponse } from "../examples/adapters/gemini-adapter";
import { emitFromOpenAIRun } from "../examples/adapters/openai-adapter";
import { getWebhookHandlerInfo, handleWebhookPayload } from "../examples/adapters/webhook-receiver";
import { runHomeAIMockProducer } from "../examples/producers/home-ai-mock";
import { handleSignalActionPost } from "../app/api/signals/action/route";
import { handleSignalsListGet } from "../app/api/signals/list/route";
import { handleSignalsPost, handleSignalsStatusGet } from "../app/api/signals/route";
import { handleSignalsSummaryGet } from "../app/api/signals/summary/route";
import { normalize } from "../lib/signal-producer-adapter";
import { createSignalEngine } from "../lib/signal-engine";
import { getSignalEngine, resetSignalEngineStoreForTests } from "../lib/signal-engine-store";
import { emitSignal, ingestLocalProducerSignals } from "../lib/signal-producer-transport";
import {
  checkNoisiness,
  resetSignalProducerValidatorState,
  validateMetadata,
  validateRequiredFields,
  validateSignal
} from "../lib/signal-producer-validator";
import type { DeadSignal, NormalizedSignal, SignalProducerPayload, ValidationWarning } from "../types/signal-producer";

function basePayload(overrides: Partial<SignalProducerPayload> = {}): SignalProducerPayload {
  return {
    protocol_version: "1.0",
    signal_id: "sig-001",
    source_ai: "DEV_AI",
    title: "Build pipeline needs review",
    summary: "CI failed during dependency install.",
    signal_kind: "blocked",
    signal_priority: "high",
    human_action_needed: true,
    timestamp: "2026-03-11T12:00:00.000Z",
    ...overrides
  };
}

test("validateRequiredFields", () => {
  resetSignalProducerValidatorState();

  const valid = validateRequiredFields(basePayload());
  assert.equal(valid.ok, true);

  const missingId = validateRequiredFields(basePayload({ signal_id: "" }));
  assert.equal(missingId.ok, false);

  const invalidKind = validateRequiredFields({ ...basePayload(), signal_kind: "unknown" } as unknown);
  assert.equal(invalidKind.ok, false);

  const nonBoolean = validateRequiredFields({ ...basePayload(), human_action_needed: "true" } as unknown);
  assert.equal(nonBoolean.ok, false);

  const invalidTimestamp = validateRequiredFields(basePayload({ timestamp: "not-a-date" }));
  assert.equal(invalidTimestamp.ok, false);
});

test("validateSignalId deduplication", () => {
  resetSignalProducerValidatorState();

  const first = validateSignal(basePayload({ signal_id: "dup-1" }));
  assert.equal(first.ok, true);

  const second = validateSignal(basePayload({ signal_id: "dup-1" }));
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.match(second.error, /DUPLICATE/);
  }

  const third = validateSignal(basePayload({ signal_id: "dup-2" }));
  assert.equal(third.ok, true);
});

test("validateMetadata", () => {
  resetSignalProducerValidatorState();

  const undefinedMeta = validateMetadata(undefined);
  assert.equal(undefinedMeta.ok, true);

  const nineKeys = validateMetadata({
    a: 1,
    b: 2,
    c: 3,
    d: 4,
    e: 5,
    f: 6,
    g: 7,
    h: 8,
    i: 9
  });
  assert.equal(nineKeys.ok, false);

  const restricted = validateMetadata({ _internal_trace: "x" });
  assert.equal(restricted.ok, false);

  const oversized = validateMetadata({ data: "x".repeat(600) });
  assert.equal(oversized.ok, false);

  const valid = validateMetadata({ env: "prod", retries: 1 });
  assert.equal(valid.ok, true);
});

test("checkNoisiness guardrail", () => {
  resetSignalProducerValidatorState();
  const start = Date.now();

  const one = checkNoisiness(basePayload({ signal_id: "n1", signal_kind: "info", timestamp: new Date(start).toISOString() }));
  const two = checkNoisiness(basePayload({ signal_id: "n2", signal_kind: "info", timestamp: new Date(start + 1000).toISOString() }));
  const three = checkNoisiness(basePayload({ signal_id: "n3", signal_kind: "info", timestamp: new Date(start + 2000).toISOString() }));
  const four = checkNoisiness(basePayload({ signal_id: "n4", signal_kind: "info", timestamp: new Date(start + 3000).toISOString() }));
  const progressOther = checkNoisiness(
    basePayload({
      signal_id: "n5",
      source_ai: "FINANCE_AI",
      signal_kind: "progress",
      timestamp: new Date(start + 4000).toISOString()
    })
  );

  assert.equal(one, null);
  assert.equal(two, null);
  assert.equal(three, null);
  assert.notEqual(four, null);
  assert.equal(progressOther, null);
});

test("normalize matrix rows", () => {
  const rows: Array<{ payload: SignalProducerPayload; module: string; status: string }> = [
    { payload: basePayload({ signal_kind: "approval", human_action_needed: true }), module: "approvals", status: "approval" },
    { payload: basePayload({ signal_kind: "blocked", human_action_needed: true }), module: "signal", status: "blocked" },
    { payload: basePayload({ signal_kind: "blocked", human_action_needed: false }), module: "signal", status: "blocked" },
    { payload: basePayload({ signal_kind: "attention", human_action_needed: true }), module: "signal", status: "pending" },
    { payload: basePayload({ signal_kind: "attention", human_action_needed: false }), module: "signal", status: "pending" },
    { payload: basePayload({ signal_kind: "input", human_action_needed: false, target_module_hint: undefined }), module: "inbox", status: "pending" },
    { payload: basePayload({ signal_kind: "input", human_action_needed: false, target_module_hint: "voice" }), module: "voice", status: "pending" },
    { payload: basePayload({ signal_kind: "progress", human_action_needed: true }), module: "signal", status: "doing" },
    { payload: basePayload({ signal_kind: "progress", human_action_needed: false }), module: "signal", status: "doing" },
    { payload: basePayload({ signal_kind: "info", human_action_needed: true }), module: "signal", status: "pending" },
    { payload: basePayload({ signal_kind: "info", human_action_needed: false }), module: "inbox", status: "pending" }
  ];

  rows.forEach((row, index) => {
    const normalized = normalize({ ...row.payload, signal_id: `matrix-${index}` });
    assert.equal(normalized.target_module, row.module);
    assert.equal(normalized.signal_status, row.status);
  });
});

test("emitSignal valid payload", async () => {
  resetSignalProducerValidatorState();
  const ingested: NormalizedSignal[] = [];
  const dead: DeadSignal[] = [];

  const engine = {
    ingest(signal: NormalizedSignal) {
      ingested.push(signal);
    },
    recordDeadSignal(deadSignal: DeadSignal) {
      dead.push(deadSignal);
    }
  };

  const result = await emitSignal(basePayload({ signal_id: "transport-valid-1" }), engine);
  assert.equal(result.ok, true);
  assert.equal(ingested.length, 1);
  assert.equal(dead.length, 0);
});

test("emitSignal invalid payload", async () => {
  resetSignalProducerValidatorState();
  const ingested: NormalizedSignal[] = [];
  const dead: DeadSignal[] = [];

  const engine = {
    ingest(signal: NormalizedSignal) {
      ingested.push(signal);
    },
    recordDeadSignal(deadSignal: DeadSignal) {
      dead.push(deadSignal);
    }
  };

  const result = await emitSignal(basePayload({ signal_id: "" }), engine);
  assert.equal(result.ok, false);
  assert.equal(ingested.length, 0);
  assert.equal(dead.length, 1);
});

test("emitSignal duplicate signal_id", async () => {
  resetSignalProducerValidatorState();
  const dead: DeadSignal[] = [];
  const engine = {
    ingest(_signal: NormalizedSignal) {
      // no-op
    },
    recordDeadSignal(deadSignal: DeadSignal) {
      dead.push(deadSignal);
    }
  };

  const first = await emitSignal(basePayload({ signal_id: "dup-transport-1" }), engine);
  const second = await emitSignal(basePayload({ signal_id: "dup-transport-1" }), engine);

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(dead.length, 1);
});

test("full emit chain", async () => {
  resetSignalProducerValidatorState();
  const ingested: NormalizedSignal[] = [];
  const dead: DeadSignal[] = [];
  const warnings: ValidationWarning[] = [];

  const engine = {
    ingest(signal: NormalizedSignal) {
      ingested.push(signal);
    },
    recordDeadSignal(deadSignal: DeadSignal) {
      dead.push(deadSignal);
    },
    recordWarning(warning: ValidationWarning) {
      warnings.push(warning);
    }
  };

  const devBlocked = await emitSignal(
    basePayload({
      signal_id: "e2e-dev-blocked",
      source_ai: "DEV_AI",
      signal_kind: "blocked",
      human_action_needed: true
    }),
    engine
  );
  const financeApproval = await emitSignal(
    basePayload({
      signal_id: "e2e-finance-approval",
      source_ai: "FINANCE_AI",
      signal_kind: "approval",
      human_action_needed: true
    }),
    engine
  );

  assert.equal(devBlocked.ok, true);
  assert.equal(financeApproval.ok, true);
  assert.equal(ingested.length, 2);
  assert.equal(dead.length, 0);
  assert.equal(warnings.length, 0);

  assert.equal(ingested[0]?.target_module, "signal");
  assert.equal(ingested[0]?.signal_status, "blocked");
  assert.equal(ingested[1]?.target_module, "approvals");
  assert.equal(ingested[1]?.signal_status, "approval");
});

test("signal engine ingests and retrieves by module", () => {
  const engine = createSignalEngine();
  engine.ingest({
    signal_id: "engine-1",
    source_ai: "DEV_AI",
    title: "Blocked build",
    summary: "Pipeline is blocked.",
    signal_kind: "blocked",
    signal_status: "blocked",
    signal_priority: "high",
    target_module: "signal",
    human_action_needed: true,
    created_at: "2026-03-11T12:00:00.000Z",
    updated_at: "2026-03-11T12:00:00.000Z"
  });
  engine.ingest({
    signal_id: "engine-2",
    source_ai: "FINANCE_AI",
    title: "Invoice approval",
    summary: "Needs approval.",
    signal_kind: "approval",
    signal_status: "approval",
    signal_priority: "high",
    target_module: "approvals",
    human_action_needed: true,
    created_at: "2026-03-11T12:05:00.000Z",
    updated_at: "2026-03-11T12:05:00.000Z"
  });

  assert.equal(engine.getSignals().length, 2);
  assert.equal(engine.getSignalsByModule("signal").length, 1);
  assert.equal(engine.getSignalsByModule("approvals").length, 1);
});

test("signal engine sorting and summaries", () => {
  const engine = createSignalEngine();
  engine.ingestMany([
    {
      signal_id: "s-1",
      source_ai: "DEV_AI",
      title: "Attention",
      summary: "Needs review",
      signal_kind: "attention",
      signal_status: "pending",
      signal_priority: "normal",
      target_module: "signal",
      human_action_needed: true,
      created_at: "2026-03-11T12:00:00.000Z",
      updated_at: "2026-03-11T12:00:00.000Z"
    },
    {
      signal_id: "s-2",
      source_ai: "DEV_AI",
      title: "Blocked",
      summary: "Failure",
      signal_kind: "blocked",
      signal_status: "blocked",
      signal_priority: "high",
      target_module: "signal",
      human_action_needed: true,
      created_at: "2026-03-11T12:01:00.000Z",
      updated_at: "2026-03-11T12:01:00.000Z"
    },
    {
      signal_id: "a-1",
      source_ai: "FINANCE_AI",
      title: "Approval",
      summary: "Approve payment",
      signal_kind: "approval",
      signal_status: "approval",
      signal_priority: "high",
      target_module: "approvals",
      human_action_needed: true,
      created_at: "2026-03-11T12:02:00.000Z",
      updated_at: "2026-03-11T12:02:00.000Z"
    },
    {
      signal_id: "i-1",
      source_ai: "HOME_AI",
      title: "Inbox item",
      summary: "Email arrived",
      signal_kind: "input",
      signal_status: "pending",
      signal_priority: "low",
      target_module: "inbox",
      human_action_needed: false,
      created_at: "2026-03-11T12:03:00.000Z",
      updated_at: "2026-03-11T12:03:00.000Z"
    },
    {
      signal_id: "p-1",
      source_ai: "DEV_AI",
      title: "Progress",
      summary: "In progress",
      signal_kind: "progress",
      signal_status: "doing",
      signal_priority: "normal",
      target_module: "today_summary_only",
      human_action_needed: false,
      created_at: "2026-03-11T12:04:00.000Z",
      updated_at: "2026-03-11T12:04:00.000Z"
    },
    {
      signal_id: "d-1",
      source_ai: "DEV_AI",
      title: "Done",
      summary: "Completed",
      signal_kind: "progress",
      signal_status: "done",
      signal_priority: "normal",
      target_module: "today_summary_only",
      human_action_needed: false,
      created_at: "2026-03-11T12:05:00.000Z",
      updated_at: "2026-03-11T12:05:00.000Z"
    }
  ]);

  const signalList = engine.getSignalsByModule("signal");
  assert.equal(signalList[0]?.signal_kind, "blocked");

  const today = engine.getTodaySummary();
  const week = engine.getWeekSummary();
  assert.equal(today.approvalsWaiting, 1);
  assert.equal(today.signalsNeedingReview, 2);
  assert.equal(today.inboxItems, 1);
  assert.equal(week.itemsInProgress, 1);
  assert.equal(week.waitingApproval, 1);
  assert.equal(week.completed, 1);
});

test("signal engine stores dead signals and warnings", () => {
  const engine = createSignalEngine();
  engine.recordDeadSignal({
    signal_id: "dead-1",
    source_ai: "SYSTEM",
    error: "invalid payload",
    raw: {},
    failed_at: "2026-03-11T12:00:00.000Z"
  });
  engine.recordWarning({ kind: "noise_guardrail", message: "too noisy", signal_id: "warn-1" });
  assert.equal(engine.getDeadSignals().length, 1);
  assert.equal(engine.getWarnings().length, 1);
});

test("signal engine local actions update module lists", () => {
  const engine = createSignalEngine([
    {
      signal_id: "act-1",
      source_ai: "FINANCE_AI",
      title: "Approval",
      summary: "Needs go/no-go",
      signal_kind: "approval",
      signal_status: "approval",
      signal_priority: "high",
      target_module: "approvals",
      human_action_needed: true,
      created_at: "2026-03-11T12:00:00.000Z",
      updated_at: "2026-03-11T12:00:00.000Z"
    },
    {
      signal_id: "act-2",
      source_ai: "HOME_AI",
      title: "Voice note",
      summary: "Captured note",
      signal_kind: "input",
      signal_status: "pending",
      signal_priority: "low",
      target_module: "voice",
      human_action_needed: false,
      created_at: "2026-03-11T12:00:00.000Z",
      updated_at: "2026-03-11T12:00:00.000Z"
    }
  ]);

  engine.applyLocalAction("act-1", "approve");
  engine.applyLocalAction("act-2", "send_to_inbox");
  assert.equal(engine.getSignalsByModule("approvals").length, 0);
  assert.equal(engine.getSignalsByModule("inbox").length, 1);
});

test("local batch ingest helper returns per-signal results", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();
  const results = await ingestLocalProducerSignals(
    [
      basePayload({ signal_id: "batch-1" }),
      basePayload({ signal_id: "batch-1" }),
      basePayload({ signal_id: "batch-2", signal_kind: "approval", source_ai: "FINANCE_AI" })
    ],
    engine
  );

  assert.equal(results.length, 3);
  assert.equal(results[0]?.ok, true);
  assert.equal(results[1]?.ok, false);
  assert.equal(results[2]?.ok, true);
});

test("home producer emits complete HOME_AI flow", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();
  const results = await runHomeAIMockProducer(engine);

  assert.equal(results.length, 4);
  assert.equal(results.every((item) => item.ok), true);

  const inbox = engine.getSignalsByModule("inbox");
  const signal = engine.getSignalsByModule("signal");
  assert.equal(inbox.some((item) => item.signal_id === "home-001" && item.signal_status === "pending"), true);
  assert.equal(signal.some((item) => item.signal_id === "home-002" && item.signal_status === "pending"), true);
  assert.equal(signal.some((item) => item.signal_id === "home-003" && item.signal_status === "doing"), true);
  assert.equal(inbox.some((item) => item.signal_id === "home-004" && item.signal_status === "pending"), true);
});

test("claude adapter maps stop_reason and errors correctly", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();

  await emitFromClaudeResponse(
    {
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: "run_tests" }]
    },
    { source_ai_instance: "analysis", task_description: "Review failing CI", correlation_id: "claude-corr-1" },
    engine
  );
  await emitFromClaudeResponse(
    {
      stop_reason: "end_turn",
      content: [{ type: "text", text: "done" }]
    },
    { source_ai_instance: "analysis", task_description: "Summarize release notes" },
    engine
  );
  await emitFromClaudeResponse(
    {
      stop_reason: "max_tokens",
      content: [{ type: "text", text: "long output" }]
    },
    { source_ai_instance: "analysis", task_description: "Generate long report" },
    engine
  );
  await emitClaudeError({ message: "Rate limit exceeded" }, { source_ai_instance: "analysis", task_description: "API call" }, engine);

  const approvals = engine.getSignalsByModule("approvals");
  const signal = engine.getSignalsByModule("signal");
  assert.equal(approvals.some((item) => item.source_ai === "CLAUDE" && item.signal_status === "approval"), true);
  assert.equal(signal.some((item) => item.source_ai === "CLAUDE" && item.signal_kind === "progress"), true);
  assert.equal(signal.some((item) => item.source_ai === "CLAUDE" && item.signal_kind === "attention"), true);
  assert.equal(signal.some((item) => item.source_ai === "CLAUDE" && item.signal_kind === "blocked"), true);
});

test("claude code adapter maps hook events correctly", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();

  await emitFromClaudeCodeHook({ event: "PreToolUse", tool_name: "npm test", session_id: "sess-1", project: "opsboard" }, engine);
  await emitFromClaudeCodeHook({ event: "PostToolUse", tool_name: "npm test", session_id: "sess-1", project: "opsboard" }, engine);
  await emitFromClaudeCodeHook({ event: "Stop", exit_code: 0, session_id: "sess-1", project: "opsboard" }, engine);
  await emitFromClaudeCodeHook({ event: "Stop", exit_code: 1, session_id: "sess-2", project: "opsboard" }, engine);
  await emitFromClaudeCodeHook({ event: "SubagentStop", session_id: "sess-1", project: "opsboard" }, engine);

  const approvals = engine.getSignalsByModule("approvals");
  const signal = engine.getSignalsByModule("signal");
  const inbox = engine.getSignalsByModule("inbox");
  assert.equal(approvals.some((item) => item.source_ai === "CLAUDE_CODE" && item.signal_status === "approval"), true);
  assert.equal(signal.some((item) => item.source_ai === "CLAUDE_CODE" && item.signal_kind === "progress"), true);
  assert.equal(signal.some((item) => item.source_ai === "CLAUDE_CODE" && item.signal_kind === "blocked"), true);
  assert.equal(inbox.some((item) => item.source_ai === "CLAUDE_CODE" && item.signal_kind === "info"), true);
});

test("openai adapter maps run statuses correctly", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();

  await emitFromOpenAIRun(
    { id: "run-1", status: "requires_action", required_action: { type: "submit_tool_outputs" } },
    { source_ai_instance: "assistant-1", task_description: "Prepare investor brief" },
    engine
  );
  await emitFromOpenAIRun(
    { id: "run-2", status: "completed" },
    { source_ai_instance: "assistant-1", task_description: "Draft release note" },
    engine
  );
  await emitFromOpenAIRun(
    { id: "run-3", status: "failed", last_error: { code: "500", message: "Tool execution failed" } },
    { source_ai_instance: "assistant-1", task_description: "Generate deployment plan" },
    engine
  );
  await emitFromOpenAIRun(
    { id: "run-4", status: "expired" },
    { source_ai_instance: "assistant-1", task_description: "Create migration checklist" },
    engine
  );

  const approvals = engine.getSignalsByModule("approvals");
  const signal = engine.getSignalsByModule("signal");
  assert.equal(approvals.some((item) => item.source_ai === "OPENAI"), true);
  assert.equal(signal.some((item) => item.source_ai === "OPENAI" && item.signal_kind === "progress"), true);
  assert.equal(signal.some((item) => item.source_ai === "OPENAI" && item.signal_kind === "blocked"), true);
  assert.equal(signal.some((item) => item.source_ai === "OPENAI" && item.signal_kind === "attention"), true);
});

test("gemini adapter maps finish reasons correctly", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();

  await emitFromGeminiResponse(
    { finishReason: "STOP", candidates: [] },
    { source_ai_instance: "research", task_description: "Summarize quarterly trends" },
    engine
  );
  await emitFromGeminiResponse(
    { finishReason: "MAX_TOKENS", candidates: [] },
    { source_ai_instance: "research", task_description: "Generate deep analysis" },
    engine
  );
  await emitFromGeminiResponse(
    { finishReason: "SAFETY", candidates: [] },
    { source_ai_instance: "research", task_description: "Evaluate external content" },
    engine
  );
  await emitFromGeminiResponse(
    { finishReason: "OTHER", candidates: [] },
    { source_ai_instance: "research", task_description: "Quick status check" },
    engine
  );

  const signal = engine.getSignalsByModule("signal");
  const inbox = engine.getSignalsByModule("inbox");
  assert.equal(signal.some((item) => item.source_ai === "GEMINI" && item.signal_kind === "progress"), true);
  assert.equal(signal.some((item) => item.source_ai === "GEMINI" && item.signal_kind === "attention"), true);
  assert.equal(signal.some((item) => item.source_ai === "GEMINI" && item.signal_kind === "blocked"), true);
  assert.equal(inbox.some((item) => item.source_ai === "GEMINI" && item.signal_kind === "info"), true);
});

test("apple dev adapter maps xcode, testflight, and app store events", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();

  await emitFromXcodeBuild({ result: "failed", scheme: "OpsBoard", target: "iOS", error_message: "Code signing failed" }, engine);
  await emitFromXcodeBuild({ result: "succeeded", scheme: "OpsBoard", target: "iOS" }, engine);
  await emitFromXcodeBuild({ result: "warning", scheme: "OpsBoard", target: "iOS", warning_message: "Deprecated API use" }, engine);

  await emitFromTestFlight({ version: "1.0.0", build_number: "12", processing_state: "FAILED", failure_reason: "Invalid binary" }, engine);
  await emitFromTestFlight({ version: "1.0.1", build_number: "13", processing_state: "VALID" }, engine);
  const processing = await emitFromTestFlight({ version: "1.0.2", build_number: "14", processing_state: "PROCESSING" }, engine);

  await emitFromAppStoreConnect({ type: "review_approved", app_name: "OpsBoard", version: "1.0.1" }, engine);
  await emitFromAppStoreConnect({ type: "ready_for_sale", app_name: "OpsBoard", version: "1.0.1" }, engine);
  await emitFromAppStoreConnect({ type: "review_rejected", app_name: "OpsBoard", version: "1.0.2", notes: "Guideline 2.1" }, engine);

  const approvals = engine.getSignalsByModule("approvals");
  const signal = engine.getSignalsByModule("signal");
  assert.equal(processing.ok, true);
  assert.match(processing.signal_id, /apple-testflight-skip/);
  assert.equal(approvals.some((item) => item.source_ai === "APPLE_DEV" && item.title.includes("ready")), true);
  assert.equal(approvals.some((item) => item.source_ai === "APPLE_DEV" && item.title.includes("approved")), true);
  assert.equal(signal.some((item) => item.source_ai === "APPLE_DEV" && item.signal_kind === "blocked"), true);
  assert.equal(signal.some((item) => item.source_ai === "APPLE_DEV" && item.signal_kind === "progress"), true);
  assert.equal(signal.some((item) => item.source_ai === "APPLE_DEV" && item.signal_kind === "attention"), true);
});

test("webhook receiver validates and ingests payloads", async () => {
  resetSignalProducerValidatorState();
  const engine = createSignalEngine();

  const ok = await handleWebhookPayload(basePayload({ signal_id: "webhook-1" }), engine);
  const invalid = await handleWebhookPayload({ signal_id: "" }, engine);
  const duplicate = await handleWebhookPayload(basePayload({ signal_id: "webhook-1" }), engine);
  const info = getWebhookHandlerInfo();

  assert.equal(ok.ok, true);
  assert.equal(invalid.ok, false);
  assert.equal(duplicate.ok, false);
  assert.equal(engine.getSignals().length, 1);
  assert.equal(engine.getDeadSignals().length, 2);
  assert.equal(info.method, "POST");
  assert.equal(info.path, "/signals");
});

test("validator accepts expanded SourceAI values", () => {
  resetSignalProducerValidatorState();
  const accepted = ["CLAUDE", "CLAUDE_CODE", "OPENAI", "GEMINI", "APPLE_DEV", "CUSTOM"] as const;

  accepted.forEach((source, index) => {
    const result = validateRequiredFields(basePayload({ signal_id: `source-${index}`, source_ai: source }));
    assert.equal(result.ok, true);
  });

  const rejected = validateRequiredFields({ ...basePayload({ signal_id: "bad-source" }), source_ai: "UNKNOWN_AI" } as unknown);
  assert.equal(rejected.ok, false);
});

test("signal engine store returns singleton and seed state", () => {
  resetSignalEngineStoreForTests();
  const first = getSignalEngine();
  const second = getSignalEngine();

  assert.equal(first, second);
  const all = first.getSignals();
  assert.equal(all.some((signal) => signal.signal_id === "seed-dev-001"), true);
  assert.equal(all.some((signal) => signal.signal_id === "seed-finance-001"), true);

  const signalModule = first.getSignalsByModule("signal");
  const approvalsModule = first.getSignalsByModule("approvals");
  assert.equal(signalModule.some((signal) => signal.signal_id === "seed-dev-001" && signal.signal_status === "blocked"), true);
  assert.equal(approvalsModule.some((signal) => signal.signal_id === "seed-finance-001"), true);
});

test("POST /api/signals handler status mapping", async () => {
  resetSignalEngineStoreForTests();
  resetSignalProducerValidatorState();

  const valid = await handleSignalsPost(basePayload({ signal_id: "api-post-1" }));
  const invalid = await handleSignalsPost({ signal_id: "" });
  const duplicate = await handleSignalsPost(basePayload({ signal_id: "api-post-1" }));

  assert.equal(valid.status, 200);
  assert.equal((valid.body.ok as boolean) ?? false, true);
  assert.equal(invalid.status, 422);
  assert.equal(duplicate.status, 409);
});

test("GET /api/signals/list returns active and filtered signals", () => {
  resetSignalEngineStoreForTests();
  const engine = getSignalEngine();
  engine.ingest(
    normalize(
      basePayload({
        signal_id: "list-dismiss-1",
        signal_kind: "input",
        source_ai: "HOME_AI",
        human_action_needed: false
      })
    )
  );
  engine.applyLocalAction("list-dismiss-1", "dismiss");

  const all = handleSignalsListGet();
  const signalOnly = handleSignalsListGet("signal");

  assert.equal(all.status, 200);
  assert.equal((all.body.ok as boolean) ?? false, true);
  assert.equal((all.body.signals as Array<{ signal_id: string }>).some((signal) => signal.signal_id === "list-dismiss-1"), false);
  assert.equal(signalOnly.status, 200);
  assert.equal(
    (signalOnly.body.signals as Array<{ target_module: string }>).every((signal) => signal.target_module === "signal"),
    true
  );
});

test("POST /api/signals/action applies approve dismiss and later", async () => {
  resetSignalEngineStoreForTests();
  resetSignalProducerValidatorState();

  const posted = await handleSignalsPost(
    basePayload({
      signal_id: "act-api-1",
      signal_kind: "approval",
      source_ai: "FINANCE_AI",
      human_action_needed: true
    })
  );
  assert.equal(posted.status, 200);

  const approve = handleSignalActionPost({ signal_id: "act-api-1", action: "approve" });
  assert.equal(approve.status, 200);
  assert.equal(approve.body.updated_status, "done");

  const posted2 = await handleSignalsPost(
    basePayload({
      signal_id: "act-api-2",
      signal_kind: "attention",
      source_ai: "HOME_AI",
      human_action_needed: true
    })
  );
  assert.equal(posted2.status, 200);

  const later = handleSignalActionPost({ signal_id: "act-api-2", action: "later" });
  assert.equal(later.status, 200);
  const listAfterLater = handleSignalsListGet("signal");
  const laterSignal = (listAfterLater.body.signals as Array<{ signal_id: string; signal_priority: string }>).find(
    (signal) => signal.signal_id === "act-api-2"
  );
  assert.equal(laterSignal?.signal_priority, "low");

  const dismiss = handleSignalActionPost({ signal_id: "act-api-2", action: "dismiss" });
  assert.equal(dismiss.status, 200);
  const listAfterDismiss = handleSignalsListGet("signal");
  assert.equal((listAfterDismiss.body.signals as Array<{ signal_id: string }>).some((signal) => signal.signal_id === "act-api-2"), false);

  const missing = handleSignalActionPost({ signal_id: "missing-id", action: "dismiss" });
  assert.equal(missing.status, 404);
});

test("GET /api/signals/summary reflects engine changes", async () => {
  resetSignalEngineStoreForTests();
  resetSignalProducerValidatorState();

  const summaryBefore = handleSignalsSummaryGet();
  const approvalsBefore = (summaryBefore.body.today as { approvals_waiting: number }).approvals_waiting;

  const posted = await handleSignalsPost(
    basePayload({
      signal_id: "summary-approval-1",
      signal_kind: "approval",
      source_ai: "FINANCE_AI",
      human_action_needed: true
    })
  );
  assert.equal(posted.status, 200);

  const summaryAfterIngest = handleSignalsSummaryGet();
  const approvalsAfterIngest = (summaryAfterIngest.body.today as { approvals_waiting: number }).approvals_waiting;
  assert.equal(approvalsAfterIngest >= approvalsBefore, true);

  handleSignalActionPost({ signal_id: "summary-approval-1", action: "approve" });
  const summaryAfterApprove = handleSignalsSummaryGet();
  const approvalsAfterApprove = (summaryAfterApprove.body.today as { approvals_waiting: number }).approvals_waiting;
  assert.equal(approvalsAfterApprove < approvalsAfterIngest, true);
});

test("GET /api/signals/status returns health fields", () => {
  resetSignalEngineStoreForTests();
  const result = handleSignalsStatusGet();
  assert.equal(result.status, 200);
  assert.equal((result.body.ok as boolean) ?? false, true);
  assert.equal(typeof result.body.active_signals, "number");
  assert.equal(typeof result.body.dead_signal_count, "number");
  assert.equal(typeof result.body.warning_count, "number");
  assert.equal(typeof result.body.uptime_ms, "number");
});

test("full v0.4 API lifecycle", async () => {
  resetSignalEngineStoreForTests();
  resetSignalProducerValidatorState();

  const postBlocked = await handleSignalsPost(
    basePayload({
      signal_id: "v04-dev-blocked-1",
      signal_kind: "blocked",
      source_ai: "DEV_AI",
      human_action_needed: true
    })
  );
  assert.equal(postBlocked.status, 200);

  const listSignal = handleSignalsListGet("signal");
  assert.equal((listSignal.body.signals as Array<{ signal_id: string }>).some((signal) => signal.signal_id === "v04-dev-blocked-1"), true);

  const summaryBefore = handleSignalsSummaryGet();
  const approvalsBefore = (summaryBefore.body.today as { approvals_waiting: number }).approvals_waiting;

  const approvalSignal = getSignalEngine().getSignals().find((signal) => signal.target_module === "approvals" && !signal.is_dismissed);
  assert.notEqual(approvalSignal, undefined);
  if (approvalSignal) {
    handleSignalActionPost({ signal_id: approvalSignal.signal_id, action: "approve" });
  }

  const summaryAfterApprove = handleSignalsSummaryGet();
  const approvalsAfterApprove = (summaryAfterApprove.body.today as { approvals_waiting: number }).approvals_waiting;
  assert.equal(approvalsAfterApprove <= approvalsBefore, true);

  handleSignalActionPost({ signal_id: "v04-dev-blocked-1", action: "dismiss" });
  const listAfterDismiss = handleSignalsListGet("signal");
  assert.equal(
    (listAfterDismiss.body.signals as Array<{ signal_id: string }>).some((signal) => signal.signal_id === "v04-dev-blocked-1"),
    false
  );
});
