import type { CoreModule } from "@/types/modules";
import { ModulePill } from "@/ui/module-pill";

type ModuleCardProps = {
  module: CoreModule;
};

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <article className="rounded-xl border border-slate-700 bg-panel p-4 shadow-lg shadow-black/20">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-textPrimary">{module.name}</h3>
        <ModulePill tone={module.tone} state={module.state} />
      </div>
      <p className="text-sm leading-relaxed text-textMuted">{module.summary}</p>
    </article>
  );
}
