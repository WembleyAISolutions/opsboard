import type { ModuleState, ModuleTone } from "@/types/modules";

type ModulePillProps = {
  tone: ModuleTone;
  state: ModuleState;
};

function toneToClass(tone: ModuleTone): string {
  if (tone === "high") {
    return "border-blue-300/30 bg-blue-400/10 text-blue-200";
  }

  if (tone === "low") {
    return "border-slate-300/20 bg-slate-400/10 text-slate-200";
  }

  return "border-slate-200/20 bg-slate-200/10 text-slate-100";
}

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
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneToClass(tone)}`}>
      {stateToLabel(state)}
    </span>
  );
}
