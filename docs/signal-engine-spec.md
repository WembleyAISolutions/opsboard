# Signal Engine Specification

## Purpose

The OpsBoard Signal Engine is the core interpretation layer between AI activity and human awareness.

It is designed to:

- collect AI-originated work signals
- normalize them into a stable structure
- classify them into OpsBoard modules
- support human review and approvals
- generate lightweight Today / This Week summaries

The Signal Engine is **not**:

- a task execution engine
- a workflow orchestrator
- a project management system
- a chat layer
- a full backend event bus

Its purpose is to provide a **signal-first, priority-aware, human-visible work control surface**.

---

# Design Goals

The Signal Engine must satisfy the following goals:

## 1. Keep work visible
No important AI-originated work state should disappear into hidden conversations or isolated tool threads.

## 2. Avoid turning OpsBoard into a task manager
The engine should classify and summarize work states, not create a traditional task board.

## 3. Support human intervention
Signals must make it obvious when human approval or review is required.

## 4. Enable gradual autonomy
The Signal Engine must support future autonomy expansion by preserving completion and intervention patterns over time.

## 5. Stay lightweight
The first version should work entirely with local mock data and a simple in-memory or local state model.

---

# Core Concepts

## Signal
A signal is a structured unit representing AI-originated work state, input, alert, progress, or approval need.

A signal is not a task.

Examples:

- DEV AI reports a build failure
- FINANCE AI reports an invoice awaiting approval
- HOME AI reports a school email received
- Voice note captured and awaiting review

---

## Source AI
Each signal must have a clear source identity.

Examples:

- DEV_AI
- FINANCE_AI
- HOME_AI
- BUSINESS_AI
- TAX_AI
- SYSTEM

Only the AI source name may receive subtle visual accent treatment in the UI.

---

## Module Routing
Each signal must resolve into one display destination:

- inbox
- signal
- approvals
- voice
- today_summary_only

Signals should not appear in arbitrary locations.

---

## Human Action Requirement
Each signal must indicate whether human action is required.

This is critical to preserve OpsBoard as a practical work control surface.

---

# Signal Model

## Type Definitions

```ts
export type AiSourceName =
  | "DEV_AI"
  | "FINANCE_AI"
  | "HOME_AI"
  | "BUSINESS_AI"
  | "TAX_AI"
  | "SYSTEM";

export type SignalStatus =
  | "pending"
  | "approval"
  | "doing"
  | "done"
  | "blocked";

export type SignalKind =
  | "input"
  | "info"
  | "attention"
  | "approval"
  | "progress"
  | "blocked";

export type SignalPriority =
  | "low"
  | "normal"
  | "high";

export type TargetModule =
  | "inbox"
  | "signal"
  | "approvals"
  | "voice"
  | "today_summary_only";

export interface SignalItem {
  signal_id: string;
  source_ai: AiSourceName;
  title: string;
  summary: string;
  signal_kind: SignalKind;
  signal_status: SignalStatus;
  signal_priority: SignalPriority;
  target_module: TargetModule;
  human_action_needed: boolean;
  created_at: string;
  updated_at: string;
}

## Field Definitions

### signal_id

Unique identifier for the signal.

Each signal must have a stable unique ID so that it can be updated, resolved, or referenced later.

Example:

- `dev-build-001`
- `finance-invoice-approval-002`

---

### source_ai

The AI domain or source that emitted the signal.

This allows OpsBoard to show which AI system produced the signal.

Examples:

- `DEV_AI`
- `FINANCE_AI`
- `HOME_AI`
- `BUSINESS_AI`
- `TAX_AI`
- `SYSTEM`

Only the **AI source label** may receive subtle visual accent styling in the UI.

---

### title

A short human-readable title describing the signal.

Examples:

- Build pipeline needs review
- Invoice awaiting approval
- Scholarship application follow-up needed

Titles should remain concise.

---

### summary

A concise descriptive line providing additional context.

Examples:

- CI build failed during dependency install.
- Client invoice requires approval before payment.
- Monash scholarship response not yet received.

---

### signal_kind

The semantic type of the signal.

Possible values include:

- `input`
- `info`
- `attention`
- `approval`
- `progress`
- `blocked`

This field helps determine how the signal is interpreted.

---

### signal_status

The current work-state classification.

Typical values:

- `pending`
- `approval`
- `doing`
- `done`
- `blocked`

This field reflects the **operational state** of the signal.

---

### signal_priority

Used for sorting and emphasis logic.

Possible values:

- `low`
- `normal`
- `high`

Priority mainly affects ordering rather than heavy UI styling.

---

### target_module

The OpsBoard module where the signal should appear.

Possible modules:

- `inbox`
- `signal`
- `approvals`
- `voice`
- `today_summary_only`

Each signal must resolve to **one destination module**.

---

### human_action_needed

Boolean indicator for whether explicit human action is required.

Example:

human_action_needed = true

Used especially for:

- approvals
- escalation cases
- blocked items needing attention

---

### created_at / updated_at

Timestamps used for ordering and summaries.

These timestamps allow:

- chronological sorting
- weekly summary calculation
- state update tracking

---

# Signal Classification Rules

The first version should use lightweight deterministic rules.

---

## Rule 1: Approval

If a signal requires a direct human go / no-go decision:

signal_kind = "approval"
signal_status = "approval"
target_module = "approvals"
human_action_needed = true

Examples:

- Approve deployment
- Approve invoice payment
- Approve client reply

---

## Rule 2: Attention / Blocked

If the signal represents an issue, concern, or review-worthy state:

signal_kind = "attention" OR "blocked"
target_module = "signal"

Examples:

- Build failed
- Deadline approaching
- Missing required document

---

## Rule 3: Input

If the signal is new incoming information without a decision yet:

signal_kind = "input"
signal_status = "pending"
target_module = "inbox"

Examples:

- New incoming email summary
- New voice note transcript
- New AI generated note

---

## Rule 4: Summary Only

Some signals contribute only to summary statistics.

target_module = "today_summary_only"


These signals should not appear prominently in the interface.

---

# Module Mapping

Signals must resolve into one OpsBoard module.

---

## Inbox

Used for newly arrived information.

Typical items:

- incoming messages
- captured voice transcripts
- informational updates

---

## Signal

Used for awareness-level operational signals.

Typical items:

- warnings
- blocked work
- alerts requiring attention

---

## Approvals

Used only for explicit human decisions.

Examples:

- deployment approval
- financial approval
- response approval

---

## Voice

Used for voice captured input awaiting review.

Examples:

- voice capture snippet
- transcript draft

---

## Today

Today is a **summary module**.

It should not contain full signal lists.

Instead it displays **count-based activity summaries**.

---

# Today Summary Rules

Today displays two sections:

TODAY
THIS WEEK

---

## TODAY

### approvals waiting

Count signals where:

target_module === "approvals"
AND signal_status === "approval"

---

## THIS WEEK

### items in progress

Count signals where:

signal_status === "doing"

---

### waiting approval

Count signals where:

signal_status === "approval"

---

### completed

Count signals where:

signal_status === "done"


---

# Priority Rules

Priority affects ordering.

The UI should remain calm and minimal.

Priority levels:

- low
- normal
- high

Examples of high priority signals:

- build pipeline failure
- urgent financial approval
- compliance deadline warning

---

# Human Actions

Each module supports minimal human actions.

---

## Inbox Actions

- mark reviewed
- dismiss
- move to signal
- move to approvals

---

## Signal Actions

- mark reviewed
- escalate
- mark resolved
- dismiss

---

## Approval Actions

- approve
- reject
- later

Approval decisions must remain explicit.

---

## Voice Actions

- review transcript
- send to inbox
- dismiss

---

# State Transition Guidance

Signals follow simple state transitions.

---

## Input Flow

pending → doing → done

Example:

new email summary
pending → reviewed → done

---

## Approval Flow

approval → doing → done
approval → blocked
approval → dismissed

Example:

approve deployment
approval → approved → doing → done

---

## Blocked Flow

blocked → doing → done
blocked → approval

Example:

build pipeline failed
blocked → investigating → doing → done


---

# Sorting Rules

---

## Approvals

Sort by:

1. high priority
2. newest updated_at
3. oldest unresolved approval

---

## Signal

Sort by:

1. blocked
2. attention
3. high priority
4. newest updated_at

---

## Inbox

Sort by:

1. newest pending items
2. newest updated_at

---

## Voice

Sort by:

1. newest captured item
2. pending review first

---

# Mock Data Requirements

Initial development should rely on local mock signals.

Example sources:

### DEV AI

- build pipeline failed
- deployment approval required
- pull request merged

### FINANCE AI

- invoice awaiting approval
- BAS reminder
- payment processed

### HOME AI

- school email received
- scholarship follow-up pending
- form submitted

Mock data should exercise all modules.

---

# UI Rendering Rules

OpsBoard should remain visually calm.

The UI should remain **mostly monochrome**.

Only AI source tags may use subtle accent color.

Example:

DEV AI
FINANCE AI
HOME AI

Do not color:

- full cards
- module backgrounds
- dashboard panels

Accent color should apply only to **AI labels**.

---

# Engine Utilities

Recommended helper functions:

normalizeSignal(rawSignal): SignalItem
resolveTargetModule(signal): TargetModule
getTodaySummary(signals): TodaySummary
getWeekSummary(signals): WeekSummary
sortSignalsForModule(signals, module): SignalItem[]

---

# Summary Types

Example structures:

export interface TodaySummary {
approvalsWaiting: number
signalsNeedingReview: number
inboxItems: number
}
export interface WeekSummary {
itemsInProgress: number
waitingApproval: number
completed: number
}

---

# Recommended File Structure

types/
signal.ts
schema/
signal.ts
lib/
signal-engine.ts
signal-selectors.ts
mock-data.ts


---

# Non-Goals

The Signal Engine intentionally avoids:

- task objects
- assignees
- deadlines
- kanban boards
- chat threads
- backend orchestration
- enterprise workflow systems

OpsBoard must remain lightweight.

---

# Evolution Path

### v0.3

Initial Signal Engine.

Capabilities:

- signal normalization
- module routing
- summary generation
- priority ordering

---

### v0.4

Add:

- review actions
- approval workflow
- state transitions

---

### v0.5

Add:

- progress aggregation
- weekly completion summaries
- blocked trend tracking

---

### v0.6+

Add:

- AI autonomy tiers
- permission-based execution
- reduced human intervention

---

# Final Principle

The Signal Engine exists to answer one key question:

**What does the human need to know, decide, or notice right now?**

Everything else should remain outside the surface.
