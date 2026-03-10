export type CoreModuleId = "inbox" | "signal" | "approvals" | "voice-capture" | "today";

export type ModuleTone = "low" | "normal" | "high";

export type ModuleState = "idle" | "active" | "attention";

export interface CoreModule {
  id: CoreModuleId;
  name: string;
  summary: string;
  tone: ModuleTone;
  state: ModuleState;
}

export type TodayBucketId =
  | "approvals-waiting"
  | "signals-needing-review"
  | "inbox-items"
  | "items-in-progress"
  | "waiting-approval"
  | "completed";

export interface TodayBucket {
  id: TodayBucketId;
  label: string;
  count: number;
}

export interface TodaySummary {
  today: TodayBucket[];
  thisWeek: TodayBucket[];
}
