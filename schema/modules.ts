import type { CoreModule } from "@/types/modules";

export const coreModuleIds: CoreModule["id"][] = ["inbox", "signal", "approvals", "voice", "today"];

export function isCoreModuleId(value: string): value is CoreModule["id"] {
  return coreModuleIds.includes(value as CoreModule["id"]);
}
