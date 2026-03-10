import type { CoreModule, ModuleSignalItem } from "@/types/modules";
import { ModulePill } from "@/ui/module-pill";

type ModuleNotebookPanelProps = {
  module: CoreModule;
  signals: ModuleSignalItem[];
};

export function ModuleNotebookPanel({ module, signals }: ModuleNotebookPanelProps) {
  return (
    <article className="min-h-[440px] rounded-2xl border border-slate-800 bg-panel p-6">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-wide text-textPrimary">{module.name}</h2>
        <ModulePill tone={module.tone} state={module.state} />
      </header>

      <p className="mb-5 text-sm text-textMuted">{module.summary}</p>

      <div className="space-y-3">
        {signals.map((signal) => (
          <div key={signal.id} className="rounded-lg border border-slate-800 px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">{signal.source}</p>
            <p className="text-sm text-textMuted">{signal.text}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
