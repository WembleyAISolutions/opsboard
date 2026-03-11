export type CoreModuleId = "inbox" | "signal" | "approvals" | "voice" | "today";

export type ModuleTone = "low" | "normal" | "high";

export type ModuleState = "idle" | "active" | "attention";

export interface CoreModule {
  id: CoreModuleId;
  name: string;
  summary: string;
  tone: ModuleTone;
  state: ModuleState;
}
