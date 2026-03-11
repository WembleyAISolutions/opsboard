import type { CoreModule } from "@/types/modules";
import type { SignalItem } from "@/types/signal";

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
    id: "voice",
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

export const mockSignals: SignalItem[] = [
  {
    signal_id: "sig-dev-build-failed",
    source_ai: "DEV_AI",
    title: "Build pipeline failed",
    summary: "CI build failed after dependency update and needs review.",
    signal_kind: "blocked",
    signal_status: "blocked",
    signal_priority: "high",
    target_module: "signal",
    human_action_needed: true,
    created_at: "2026-03-10T07:42:00.000Z",
    updated_at: "2026-03-10T08:04:00.000Z"
  },
  {
    signal_id: "sig-dev-deploy-approval",
    source_ai: "DEV_AI",
    title: "Deployment approval required",
    summary: "Release candidate passed checks and needs go/no-go confirmation.",
    signal_kind: "approval",
    signal_status: "approval",
    signal_priority: "high",
    target_module: "approvals",
    human_action_needed: true,
    created_at: "2026-03-10T08:10:00.000Z",
    updated_at: "2026-03-10T08:22:00.000Z"
  },
  {
    signal_id: "sig-finance-invoice-approval",
    source_ai: "FINANCE_AI",
    title: "Invoice awaiting approval",
    summary: "Vendor invoice queued and waiting for owner confirmation.",
    signal_kind: "approval",
    signal_status: "approval",
    signal_priority: "normal",
    target_module: "approvals",
    human_action_needed: true,
    created_at: "2026-03-10T07:20:00.000Z",
    updated_at: "2026-03-10T08:00:00.000Z"
  },
  {
    signal_id: "sig-finance-bas-reminder",
    source_ai: "FINANCE_AI",
    title: "BAS reminder",
    summary: "BAS preparation window opens this week and documents are ready.",
    signal_kind: "info",
    signal_status: "pending",
    signal_priority: "normal",
    target_module: "inbox",
    human_action_needed: false,
    created_at: "2026-03-10T06:30:00.000Z",
    updated_at: "2026-03-10T07:30:00.000Z"
  },
  {
    signal_id: "sig-home-school-email",
    source_ai: "HOME_AI",
    title: "School email received",
    summary: "School newsletter captured with an upcoming action note.",
    signal_kind: "input",
    signal_status: "pending",
    signal_priority: "low",
    target_module: "inbox",
    human_action_needed: false,
    created_at: "2026-03-10T08:18:00.000Z",
    updated_at: "2026-03-10T08:18:00.000Z"
  },
  {
    signal_id: "sig-home-scholarship-completed",
    source_ai: "HOME_AI",
    title: "Scholarship follow-up completed",
    summary: "Requested scholarship follow-up email has been sent successfully.",
    signal_kind: "progress",
    signal_status: "done",
    signal_priority: "normal",
    target_module: "today_summary_only",
    human_action_needed: false,
    created_at: "2026-03-09T05:20:00.000Z",
    updated_at: "2026-03-10T06:10:00.000Z"
  },
  {
    signal_id: "sig-system-voice-captured",
    source_ai: "SYSTEM",
    title: "Voice note captured",
    summary: "New voice note has been transcribed and is waiting for review.",
    signal_kind: "input",
    signal_status: "pending",
    signal_priority: "normal",
    target_module: "voice",
    human_action_needed: false,
    created_at: "2026-03-10T08:25:00.000Z",
    updated_at: "2026-03-10T08:25:00.000Z"
  },
  {
    signal_id: "sig-dev-refactor-progress",
    source_ai: "DEV_AI",
    title: "Refactor in progress",
    summary: "Signal classification refactor is underway.",
    signal_kind: "progress",
    signal_status: "doing",
    signal_priority: "normal",
    target_module: "today_summary_only",
    human_action_needed: false,
    created_at: "2026-03-10T07:10:00.000Z",
    updated_at: "2026-03-10T08:12:00.000Z"
  }
];
