# OpsBoard

OpsBoard is for people who already run an AI team — and feel the coordination load.

If you have ever had:
- 6–10 AI conversations open
- multiple AI roles running in parallel
- work waiting in different places
- your brain acting as the scheduler

then you already know the problem.

OpsBoard is a lightweight signal layer between you and your AI workers.

AI agents emit signals.  
OpsBoard organizes them into a calm control surface.  
You only look at what needs a decision.

---

## How It Works

Every AI worker emits **signals** — lightweight events that represent:

| Signal Kind | Meaning |
|-------------|---------|
| `approval`  | Needs your explicit go / no-go |
| `blocked`   | Cannot continue without you |
| `attention` | Needs your awareness |
| `input`     | New item has arrived |
| `progress`  | Work is moving forward |
| `info`      | Low-urgency update |

OpsBoard classifies each signal, routes it to the right module,  
and shows you only what matters right now.

---

## Interface

OpsBoard Desktop Lite runs as a quiet side panel alongside your work.

**Modules**

| Module | What it shows |
|--------|---------------|
| Inbox | Incoming items and reminders |
| Signal | AI status updates and attention requests |
| Approvals | Items waiting for your decision |
| Voice | Quick voice captures |

**Today Summary**

```
TODAY
  2 approvals waiting
  1 signal needs review
  1 inbox item

THIS WEEK
  3 items in progress
  1 waiting approval
  2 completed
```

Counts only. No task list. No noise.

**Actions**

Every signal can be resolved with a small quiet action:

```
Approvals  →  approve / reject / later
Signal     →  mark reviewed / dismiss
Inbox      →  mark reviewed / dismiss
Voice      →  dismiss / send to inbox
```

No forms. No modals. No confirmation dialogs.

---

## Signal Producer Protocol

AI workers connect to OpsBoard through the **Signal Producer Protocol**.

Any AI system — Claude Code, LangGraph, AutoGen, CrewAI,  
a local script, or a manual producer — can emit signals  
using a simple JSON payload.

Current protocol version: **v0.9 / Pre-implementation Review**

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
  "timestamp": "2026-03-11T12:15:00.000Z"
}
```

The protocol is designed so that:

- a local mock producer can implement it in minutes
- a real orchestrator can connect without deep coupling
- OpsBoard handles all normalization and routing

---

## Architecture

```
Your AI Team
(Dev AI, Finance AI, Home AI, Business AI ...)
        ↓
Signal Producer Protocol
        ↓
OpsBoard Signal Engine
(classify → normalize → route)
        ↓
OpsBoard UI
(surface → action → resolve)
        ↓
You
```

OpsBoard does not execute work.  
OpsBoard does not orchestrate agents.  
OpsBoard does not store decisions.

It surfaces. You resolve. Work continues.

---

## Who This Is For

**Primary user: AI-heavy solo operators**

One human. Multiple AI workers. Real output every day.

You already know the coordination friction is real.  
You already wish something would just show you what needs you.

That is who OpsBoard is built for.

---

## Product Family

**OpsBoard Desktop Lite**  
Side panel for daily work. Runs alongside ChatGPT or any AI workspace.

**OpsBoard Mobile** *(roadmap)*  
Quick approvals and voice capture on the go.

**OpsBoard Pad** *(roadmap)*  
Tablet workspace for signal review and instruction entry.

---

## Development Principles

OpsBoard must remain:

- small
- focused
- calm
- easy to understand in one session
- extensible for real AI workflows

It will never become an enterprise dashboard.  
Complexity is a failure state, not a feature.

---

## Roadmap

| Version | Focus |
|---------|-------|
| v0.1 | Core UI prototype, signal model, mock data |
| v0.2 | Local signal actions, today summary, signal engine |
| v0.3 | Signal Producer Protocol v1.0, real producer integration |
| v0.4 | Central AI connection, multi-agent workflows |

---

## Repository Structure

```
opsboard/
├── docs/
│   ├── signal-producer-protocol-v0.9.md
│   ├── architecture/
│   ├── product/
│   └── ux/
├── app/
├── components/
│   ├── desktop-lite-shell.tsx
│   ├── module-notebook-panel.tsx
│   └── today-summary-card.tsx
├── lib/
│   ├── signal-engine.ts
│   ├── signal-producer-validator.ts
│   ├── signal-producer-adapter.ts
│   ├── signal-producer-transport.ts
│   └── signal-selectors.ts
├── types/
│   └── signal-producer.ts
├── examples/
│   └── producers/
│       ├── dev-ai-mock.ts
│       ├── finance-mock.ts
│       └── home-ai-mock.ts
├── tests/
│   └── signal-producer.test.ts
└── README.md
```

---

## Development Language

All engineering files use English:  
code, comments, component names, schema definitions, docs.

User inputs may be multilingual.  
The engineering baseline is English.

---

## Open Source

OpsBoard is released under the MIT License.

The goal is a small but real open-source interface layer  
for people running AI-driven operations.

Not another productivity app.  
A calm control surface for AI work.

---

# License

MIT License

---

# Organization

WembleyAISolutions
