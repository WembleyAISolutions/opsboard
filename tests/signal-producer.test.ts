import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/signal-producer-adapter";
import { createSignalEngine } from "../lib/signal-engine";
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
