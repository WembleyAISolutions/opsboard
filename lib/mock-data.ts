import type { CoreModule, CoreModuleId, ModuleSignalItem, TodaySummary } from "@/types/modules";

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
    name: "Voice",
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

export const moduleSignals: Partial<Record<CoreModuleId, ModuleSignalItem[]>> = {
  inbox: [
    { id: "inbox-1", source: "DEV AI", text: "Deployment notes received and ready for owner review." },
    { id: "inbox-2", source: "HOME AI", text: "Personal scheduling request captured for later routing." }
  ],
  signal: [
    { id: "signal-1", source: "FINANCE AI", text: "Cost variance flag surfaced for current week." },
    { id: "signal-2", source: "DEV AI", text: "Code quality drift warning requires a quick scan." }
  ],
  approvals: [
    { id: "approvals-1", source: "FINANCE AI", text: "Budget adjustment is waiting for explicit approval." },
    { id: "approvals-2", source: "DEV AI", text: "Release gate remains paused until confirmation." }
  ],
  "voice-capture": [
    { id: "voice-1", source: "HOME AI", text: "Voice note converted into concise handoff text." },
    { id: "voice-2", source: "DEV AI", text: "Architecture reminder extracted from spoken draft." }
  ]
};
