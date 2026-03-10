import type { ModuleState, ModuleTone } from "@/types/modules";

type ModulePillProps = {
  tone: ModuleTone;
  state: ModuleState;
};

function stateToLabel(state: ModuleState): string {
  if (state === "attention") {
    return "Attention";
  }

  if (state === "active") {
    return "Active";
  }

  return "Idle";
}

export function ModulePill({ tone, state }: ModulePillProps) {
  void tone;

  return (
    <span className="inline-flex rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-xs font-medium text-slate-300">
      {stateToLabel(state)}
    </span>
  );
}
