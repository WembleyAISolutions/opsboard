# OpsBoard Signal Integration for Codex

Add this block to your Codex system prompt or at the start of each task:

---

## OpsBoard Signal Protocol

You have access to an OpsBoard signal emitter at:
  scripts/opsboard-codex-signal.js

Call it using Node.js at key moments in your task execution.

### When to emit signals

**At task start:**
```bash
node scripts/opsboard-codex-signal.js \
  --event task_start \
  --title "Starting: {brief task description}" \
  --summary "Codex beginning task: {task description}." \
  --session "{task_id or session_id}"
```

**When blocked (cannot proceed without operator input):**
```bash
node scripts/opsboard-codex-signal.js \
  --event task_blocked \
  --title "Blocked: {what is blocking you}" \
  --summary "{explain what is missing and what you need from the operator}" \
  --priority high \
  --session "{task_id}"
```

**When you need explicit approval before a risky action:**
```bash
node scripts/opsboard-codex-signal.js \
  --event approval_needed \
  --title "Approval needed: {action description}" \
  --summary "{describe the action and why approval is needed}" \
  --priority high \
  --session "{task_id}"
```

**At task completion:**
```bash
node scripts/opsboard-codex-signal.js \
  --event task_complete \
  --title "Completed: {brief task description}" \
  --summary "{summarize what was done and what the operator should review}" \
  --session "{task_id}"
```

**On task failure:**
```bash
node scripts/opsboard-codex-signal.js \
  --event task_failed \
  --title "Failed: {what failed}" \
  --summary "{explain what failed and what the operator needs to do}" \
  --priority high \
  --session "{task_id}"
```

### Rules

- Always call task_start at the beginning of a task
- Always call task_complete or task_failed at the end
- Call task_blocked immediately when you cannot proceed
- Call approval_needed before any destructive, irreversible, or high-risk action
- Do NOT emit signals for every small step — only meaningful events
- These calls are fire-and-forget. If they fail, continue your task normally.
- The signal emitter always exits 0 and will never block your execution.

### Signal emitter location

The signal emitter is at: scripts/opsboard-codex-signal.js
It supports both local OpsBoard (localhost:3002) and
Vercel OpsBoard (opsboard-seven.vercel.app) automatically.

---

## Adding this to Codex

### Option A — Add to every task prompt
Paste the block above at the top of your Codex task instructions.

### Option B — Add to Codex system prompt (if supported)
In Codex settings or configuration, add this block to the system prompt
so it applies to all tasks automatically.

### Option C — Reference in sprint instructions
Add this line to the top of any Codex sprint instruction:

  "Before starting, read scripts/codex-system-prompt-addition.md
   and follow the OpsBoard Signal Protocol throughout this task."
