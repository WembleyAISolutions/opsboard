import type { CoreModule, TodaySummary } from "@/types/modules";

export const coreModules: CoreModule[] = [
  {
    id: "inbox",
    name: "Inbox",
    summary: "New items that need a first look.",
    tone: "normal",
    state: "active"
  },
  {
    id: "signal",
    name: "Signal",
    summary: "High-value updates surfaced from activity.",
    tone: "high",
    state: "attention"
  },
  {
    id: "approvals",
    name: "Approvals",
    summary: "Decisions waiting for explicit go/no-go.",
    tone: "normal",
    state: "active"
  },
  {
    id: "voice-capture",
    name: "Voice Capture",
    summary: "Short notes transcribed into follow-up snippets.",
    tone: "low",
    state: "idle"
  },
  {
    id: "today",
    name: "Today",
    summary: "Current focus list for this session.",
    tone: "normal",
    state: "active"
  }
];

export const todaySummary: TodaySummary = {
  today: [
    { id: "approvals-waiting", label: "approvals waiting", count: 3 },
    { id: "signals-needing-review", label: "signals needing review", count: 5 },
    { id: "inbox-items", label: "inbox items", count: 12 }
  ],
  thisWeek: [
    { id: "items-in-progress", label: "items in progress", count: 6 },
    { id: "waiting-approval", label: "waiting approval", count: 2 },
    { id: "completed", label: "completed", count: 9 }
  ]
};
