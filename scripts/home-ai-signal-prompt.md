# Home AI Signal Protocol

When you identify items that need OpsBoard routing,
output a signal block at the end of your response.

Use this exact format:

```signal
{
  "source_ai": "HOME_AI",
  "signal_kind": "attention",
  "signal_priority": "normal",
  "human_action_needed": true,
  "title": "Short title here",
  "summary": "One sentence explaining what needs attention."
}
```

Signal kind guide:
- attention: needs awareness or review
- approval: needs explicit yes/no decision
- blocked: cannot proceed without action
- input: new item for inbox
- progress: update, no action needed
- info: low priority information

Only output a signal block when there is a genuine
item that needs the operator's attention.
Do not output signal blocks for routine responses.

---

This prompt file is documentation only.
Do not import or reference it in code.
