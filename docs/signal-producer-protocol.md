# Signal Producer Protocol

WembleyAISolutions  
OpsBoard Interface Specification

Version: v0.9  
Status: Pre-implementation Review

---

## Review Status

This protocol is currently in **v0.9 / Pre-implementation Review**.

It is intentionally not marked as v1.0 yet.

The following items must be completed before promotion to v1.0 Final:

1. Transport reference implementation
2. Noise guardrails for `info` / `progress`
3. Complete normalization matrix
4. `signal_id` deduplication and rejection behavior

Until these are implemented and validated in code, this protocol should be treated as review-stage only.

---

# 1. Purpose

The Signal Producer Protocol defines the standard way external AI systems emit signals into OpsBoard.

Its purpose is to ensure that:

- any AI worker can publish signals in a predictable format
- OpsBoard can classify signals consistently
- future integrations do not require one-off adapters for every orchestrator
- signal handling remains lightweight, append-only, and human-readable

This protocol is the boundary between:

```text
AI systems / orchestrators
        ↓
Signal Producers
        ↓
OpsBoard Signal Engine
        ↓
OpsBoard UI
```

---

# 2. Scope

This protocol covers:

- signal payload structure
- required and optional fields
- allowed enums
- producer responsibilities
- lifecycle assumptions
- versioning rules
- validation expectations

This protocol does not define:

- workflow execution semantics
- task orchestration
- agent-to-agent communication
- human approval storage logic
- authentication or transport security model
- persistence model
- enterprise multi-tenant controls

---

# 3. Design Principles

## 3.1 Signal-first

Producers emit signals, not tasks.

A signal represents:

- a request for attention
- a request for approval
- an operational state update
- an incoming work item
- a progress update
- a blocked condition

## 3.2 Append-only

Signals should be treated as append-only records.

Producers should not assume they can freely mutate historical signals.

OpsBoard may derive state views from signals, but the producer protocol should favor immutable emission.

## 3.3 Human clarity first

Signals must be readable by a human operator.

Even when emitted by AI, signals must remain understandable without inspecting internal agent logic.

## 3.4 Lightweight integration

The protocol should be simple enough to support:

- custom scripts
- orchestrators
- AI coding agents
- local mock producers
- webhook producers

---

# 4. Producer Model

A Signal Producer is any system that emits OpsBoard-compatible signals.

Examples include:

- code-agent workflows
- LangGraph pipelines
- AutoGen agents
- CrewAI agents
- custom internal AI workers
- local scripts
- UI-based manual producers

A producer is responsible only for emitting valid signals.

A producer is not responsible for:

- rendering UI
- deciding final human priorities
- maintaining approval history in OpsBoard
- becoming the central control plane

---

# 5. Transport Model

> ⚠️ **v0.9 Blocking Item — Fix 1**  
> Transport reference implementation is required before v1.0 promotion.  
> See recommended dual-track approach: local function call (Phase 1–3) + webhook POST (Phase 4).

v1.0 defines the payload contract first.

Transport may be implemented through:

- local in-memory injection
- local JSON file
- internal function call
- webhook POST
- queue consumer

Recommended future transport:

```text
POST /signals
Content-Type: application/json
```

Transport details remain implementation-specific in v0.9.

---

# 6. Canonical Signal Schema

## 6.1 Required Fields

```json
{
  "protocol_version": "1.0",
  "signal_id": "dev-001",
  "source_ai": "DEV_AI",
  "title": "Build pipeline needs review",
  "summary": "CI failed during dependency install.",
  "signal_kind": "blocked",
  "signal_priority": "high",
  "human_action_needed": true,
  "timestamp": "2026-03-11T12:00:00.000Z"
}
```

## 6.2 Required Fields Definition

### protocol_version

Protocol version string.

```text
1.0
```

### signal_id

Unique identifier for the emitted signal.

Requirements:

- must be unique within the producer domain
- must be rejected if duplicate (see Fix 4)
- should remain stable if referenced later
- recommended format: UUID v7 (time-ordered, collision-resistant)

Examples:

- `dev-001`
- `finance-approval-002`
- `550e8400-e29b-41d4-a716-446655440000`

### source_ai

The source AI domain or producer identity.

Allowed canonical values in v0.9:

- `DEV_AI`
- `FINANCE_AI`
- `HOME_AI`
- `BUSINESS_AI`
- `TAX_AI`
- `SYSTEM`

Custom values may be added later, but v0.9 implementations should start with a controlled enum.

### title

Short human-readable title.

Requirements:

- concise
- readable without internal AI context
- ideally under 80 characters

### summary

One-line human-readable explanation.

Requirements:

- explain context briefly
- avoid verbose agent output
- avoid raw chain-of-thought
- avoid implementation noise

### signal_kind

Semantic classification.

Allowed values:

| Value | Definition | Emission Constraint |
|-------|-----------|---------------------|
| `input` | New incoming item without decision yet | Default for new external items |
| `info` | Informational status with low urgency | ⚠️ Do not emit when `attention` is more appropriate. Max 3 per source_ai per 60s. |
| `attention` | Needs review or awareness | Use instead of `info` when human awareness is meaningful |
| `approval` | Needs explicit human go / no-go decision | Always pair with `human_action_needed: true` |
| `progress` | Represents work movement or completion | ⚠️ Do not emit for every internal step. Emit only at meaningful milestones. Max 3 per source_ai per 60s. |
| `blocked` | Represents a blocked or failed state | Use when work cannot continue without intervention |

> ⚠️ **v0.9 Blocking Item — Fix 2**  
> Noise guardrails for `info` and `progress` must be enforced in the validator layer before v1.0 promotion.

### signal_priority

Ordering priority.

| Value | Definition |
|-------|-----------|
| `low` | Low urgency, can remain in background |
| `normal` | Default priority |
| `high` | Should surface near the top of its module |

### human_action_needed

Boolean indicating whether explicit human action is required.

- `true` for approvals
- `true` for critical blocked items needing intervention
- `false` for passive progress updates

### timestamp

Producer timestamp in ISO 8601 format.

```text
2026-03-11T12:00:00.000Z
```

---

# 7. Optional Fields

```json
{
  "status_hint": "approval",
  "target_module_hint": "approvals",
  "producer_name": "claude-code",
  "source_ai_instance": "frontend",
  "correlation_id": "deploy-run-14",
  "source_ref": "build/123",
  "metadata": {
    "environment": "production"
  }
}
```

## 7.1 Optional Field Definitions

### status_hint

Optional hint for suggested lifecycle state.

Allowed values: `pending` / `approval` / `doing` / `done` / `blocked`

Advisory only. OpsBoard may normalize differently.

### target_module_hint

Optional hint for display destination.

Allowed values: `inbox` / `signal` / `approvals` / `voice` / `today_summary_only`

Advisory only. OpsBoard remains the source of final routing.

### producer_name

Human-readable name of the producing system.

Examples: `claude-code` / `langgraph` / `autogen` / `local-script`

### source_ai_instance

Optional identifier to distinguish multiple instances of the same AI type.

Examples: `frontend` / `backend` / `staging` / `prod-eu`

When present, OpsBoard displays source as `DEV_AI:frontend` rather than `DEV_AI`.

### correlation_id

Shared identifier for grouping related signals.

### source_ref

Opaque reference to producer-local context.

Examples: `build/123` / `invoice/INV-882`

### metadata

Flexible machine-readable key/value object.

Constraints:

- maximum 8 keys
- maximum 512 bytes total (serialized)
- keys must not begin with `_internal`, `_chain`, `_reasoning`, or `_trace`
- must not contain AI reasoning chains or agent internal state

---

# 8. Validation Rules

A valid signal must satisfy all required schema fields.

Validation requirements:

- `protocol_version` must be present
- `signal_id` must be non-empty and **not previously seen** (reject duplicates)
- `source_ai` must be a valid enum value
- `title` must be non-empty
- `summary` must be non-empty
- `signal_kind` must be a valid enum value
- `signal_priority` must be a valid enum value
- `human_action_needed` must be boolean
- `timestamp` must be valid ISO 8601
- `metadata` must satisfy size and key constraints if present

Signals that fail validation must be:

- rejected
- logged to the dead signal store
- surfaced in OpsBoard UI as dead signal count
- never silently accepted

> ⚠️ **v0.9 Blocking Item — Fix 4**  
> `signal_id` deduplication and rejection behavior must be implemented in the validator layer before v1.0 promotion.

---

# 9. Normalization Rules in OpsBoard

> ⚠️ **v0.9 Blocking Item — Fix 3**  
> The normalization matrix below is complete for v0.9. It must be implemented as an exhaustive switch in `lib/signal-producer-adapter.ts`. No `default` fallback is permitted — unmatched combinations must throw.

Signal Producers emit raw protocol-compliant signals. OpsBoard Signal Engine is responsible for normalization.

## Complete Normalization Matrix

| signal_kind | human_action_needed | target_module | signal_status | Notes |
|-------------|---------------------|---------------|---------------|-------|
| `approval` | `true` | `approvals` | `approval` | Always routes to approvals |
| `blocked` | `true` | `signal` | `blocked` | Human intervention required |
| `blocked` | `false` | `signal` | `blocked` | Notify only, no forced approval |
| `attention` | `true` | `signal` | `pending` | Requires review |
| `attention` | `false` | `signal` | `pending` | Display only |
| `input` | any | `inbox` | `pending` | Unless `target_module_hint=voice` |
| `input` + voice hint | any | `voice` | `pending` | When `target_module_hint=voice` |
| `progress` | `false` | `signal` | `doing` | Silent update, low priority |
| `progress` | `true` | `signal` | `doing` | Uncommon, keep visible |
| `info` | `false` | `inbox` | `pending` | Lowest priority |
| `info` | `true` | `signal` | `pending` | Treat as `attention` — upgrade recommended |

---

# 10. Producer Responsibilities

Signal Producers **must**:

- emit valid protocol payloads
- keep titles and summaries human-readable
- avoid excessive verbosity
- avoid mutable task-like semantics
- avoid UI-coupled payload assumptions

Signal Producers **should**:

- emit one clear signal per meaningful event
- avoid emitting duplicate noisy signals
- preserve source identity clearly
- use correlation IDs when useful
- use UUID v7 for `signal_id` generation

Signal Producers **must not**:

- emit chain-of-thought or private reasoning
- emit raw task trees
- assume task ownership semantics
- assume assignees, deadlines, or kanban states exist
- turn OpsBoard into a task system
- re-emit a signal with an existing `signal_id`

---

# 11. Signal Immutability Guardrails

Signals are:

- append-only
- non-editable from producer perspective
- non-nestable
- not comment threads
- not task containers

Signals must not support:

- child signals as subtasks
- user-written threaded commentary
- assignment fields
- due dates
- project grouping semantics

---

# 12. Example Payloads

## 12.1 DEV AI blocked signal

```json
{
  "protocol_version": "1.0",
  "signal_id": "dev-001",
  "source_ai": "DEV_AI",
  "source_ai_instance": "backend",
  "title": "Build pipeline needs review",
  "summary": "CI failed during dependency install.",
  "signal_kind": "blocked",
  "signal_priority": "high",
  "human_action_needed": true,
  "timestamp": "2026-03-11T12:00:00.000Z",
  "producer_name": "claude-code"
}
```

## 12.2 FINANCE AI approval signal

```json
{
  "protocol_version": "1.0",
  "signal_id": "finance-001",
  "source_ai": "FINANCE_AI",
  "title": "Invoice awaiting approval",
  "summary": "Supplier invoice requires payment approval.",
  "signal_kind": "approval",
  "signal_priority": "high",
  "human_action_needed": true,
  "timestamp": "2026-03-11T12:15:00.000Z",
  "producer_name": "local-script",
  "correlation_id": "invoice-batch-mar-11"
}
```

## 12.3 HOME AI input signal

```json
{
  "protocol_version": "1.0",
  "signal_id": "home-001",
  "source_ai": "HOME_AI",
  "title": "School email received",
  "summary": "A new school-related message has been captured for review.",
  "signal_kind": "input",
  "signal_priority": "normal",
  "human_action_needed": false,
  "timestamp": "2026-03-11T12:20:00.000Z",
  "producer_name": "email-capture"
}
```

## 12.4 SYSTEM voice capture signal

```json
{
  "protocol_version": "1.0",
  "signal_id": "voice-001",
  "source_ai": "SYSTEM",
  "title": "Voice note captured",
  "summary": "Short note captured and waiting for review.",
  "signal_kind": "input",
  "signal_priority": "low",
  "human_action_needed": false,
  "timestamp": "2026-03-11T12:25:00.000Z",
  "target_module_hint": "voice",
  "producer_name": "voice-capture"
}
```

---

# 13. Error Handling

If a producer emits invalid payloads:

- reject the signal
- log to dead signal store
- surface dead signal count in OpsBoard UI
- do not silently coerce unknown enums

If a producer becomes noisy:

- validator issues warnings for `info` / `progress` above threshold
- rate-limiting and deduplication are future concerns

---

# 14. Observability Hooks

Producers should support minimal observability through:

- `source_ai` + `source_ai_instance`
- `timestamp`
- `producer_name`
- optional `correlation_id`
- optional `source_ref`

These support future source tracing, signal debugging, silent producer detection, and backlog diagnostics.

---

# 15. Versioning Policy

Current version: `v0.9`

Rules:

- additive optional fields may be added in minor revisions
- enum deprecation requires one minor version `@deprecated` period before removal
- breaking enum or payload changes require a new major version
- OpsBoard should reject unknown major versions unless compatibility is declared

---

# 16. Compatibility Goal

Signal Producer Protocol v0.9 is designed so that:

- a local mock producer can implement it in minutes
- a custom orchestrator can implement it without deep coupling
- multiple orchestrators can emit compatible signals
- OpsBoard remains the normalization and human-interface layer

---

# 17. Non-Goals

This protocol does not define:

- task execution
- approval persistence
- user identity
- agent memory
- workflow DAG semantics
- role permissions
- chat transport
- enterprise governance controls

---

# 18. Recommended Implementation Files

```text
types/signal-producer.ts
lib/signal-producer-validator.ts
lib/signal-producer-adapter.ts
lib/signal-producer-transport.ts
examples/producers/dev-ai-mock.ts
examples/producers/finance-mock.ts
tests/signal-producer.test.ts
```

---

# 19. Adoption Sequence

## Phase 1 — Documentation (current)

- finalize v0.9 protocol
- align enums with Signal Engine
- complete normalization matrix

## Phase 2+3 — Validation + Adapter (merged sprint)

- implement validator (all rules including Fix 2 + Fix 4)
- implement adapter (normalization matrix as exhaustive switch)
- implement transport reference (Fix 1)
- deliver 2 runnable mock producers
- end-to-end test: emit → validate → normalize → UI

## Phase 4 — Real Producer Integration

- connect first orchestrator or AI worker
- test with real signal flow
- upgrade webhook transport

## v1.0 Final — Protocol Promotion

Requires all four blocking items resolved and validated in code:

- [ ] Fix 1: Transport reference implementation
- [ ] Fix 2: Noise guardrails for `info` / `progress`
- [ ] Fix 3: Complete normalization matrix (implemented in adapter)
- [ ] Fix 4: `signal_id` deduplication and rejection

---

# 20. Final Principle

A Signal Producer should answer one simple question:

> **What meaningful work-state event should the human see right now?**

If the payload does not improve that answer, it should not be emitted.
