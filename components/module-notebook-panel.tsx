import type { CoreModule } from "@/types/modules";
import type { SignalItem } from "@/types/signal";
import { ModulePill } from "@/ui/module-pill";

type ModuleNotebookPanelProps = {
  module: CoreModule;
  signals: SignalItem[];
};

function formatSourceName(source: SignalItem["source_ai"]): string {
  return source.replaceAll("_", " ");
}

function actionLabels(moduleId: CoreModule["id"]): string[] {
  if (moduleId === "approvals") {
    return ["approve", "reject", "later"];
  }
  if (moduleId === "signal") {
    return ["mark reviewed", "dismiss"];
  }
  return ["later"];
}

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
          <div key={signal.signal_id} className="rounded-lg border border-slate-800 px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">{formatSourceName(signal.source_ai)}</p>
            <p className="text-sm font-medium text-textPrimary">{signal.title}</p>
            <p className="mt-1 text-sm text-textMuted">{signal.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {actionLabels(module.id).map((label) => (
                <button
                  key={`${signal.signal_id}-${label}`}
                  type="button"
                  className="rounded border border-slate-700 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
