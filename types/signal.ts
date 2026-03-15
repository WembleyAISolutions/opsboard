export type AiSourceName =
  | "DEV_AI"
  | "FINANCE_AI"
  | "HOME_AI"
  | "BUSINESS_AI"
  | "TAX_AI"
  | "SYSTEM"
  | "CLAUDE"
  | "CLAUDE_CODE"
  | "OPENAI"
  | "GEMINI"
  | "APPLE_DEV"
  | "CUSTOM";

export type SignalStatus = "pending" | "approval" | "doing" | "done" | "blocked";

export type SignalKind = "input" | "info" | "attention" | "approval" | "progress" | "blocked";

export type SignalPriority = "low" | "normal" | "high";

export type TargetModule = "inbox" | "signal" | "approvals" | "voice" | "today_summary_only";

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
  is_dismissed?: boolean;
}

export type LocalSignalAction = "approve" | "reject" | "later" | "mark_reviewed" | "dismiss" | "send_to_inbox";

export interface TodaySummary {
  approvalsWaiting: number;
  signalsNeedingReview: number;
  inboxItems: number;
}

export interface WeekSummary {
  itemsInProgress: number;
  waitingApproval: number;
  completed: number;
}
