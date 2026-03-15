import type { CoreModule } from "@/types/modules";
import type { LocalSignalAction, SignalItem } from "@/types/signal";
import { useSignalAction, useSignals } from "@/lib/use-signals";
import { ModulePill } from "@/ui/module-pill";

type ModuleNotebookPanelProps = {
  module: CoreModule;
};

function formatSourceName(source: SignalItem["source_ai"]): string {
  return source.replaceAll("_", " ");
}

function actionLabels(moduleId: CoreModule["id"]): Array<{ label: string; action: LocalSignalAction }> {
  if (moduleId === "approvals") {
    return [
      { label: "approve", action: "approve" },
      { label: "reject", action: "reject" },
      { label: "later", action: "later" }
    ];
  }
  if (moduleId === "signal") {
    return [
      { label: "mark reviewed", action: "mark_reviewed" },
      { label: "dismiss", action: "dismiss" }
    ];
  }
  if (moduleId === "inbox") {
    return [
      { label: "mark reviewed", action: "mark_reviewed" },
      { label: "dismiss", action: "dismiss" }
    ];
  }
  if (moduleId === "voice") {
    return [
      { label: "dismiss", action: "dismiss" },
      { label: "send to inbox", action: "send_to_inbox" }
    ];
  }
  return [{ label: "later", action: "later" }];
}

export function ModuleNotebookPanel({ module }: ModuleNotebookPanelProps) {
  const moduleKey = module.id === "today" ? undefined : module.id;
  const { signals, loading, error } = useSignals(moduleKey);
  const { performAction, loading: actionLoading, error: actionError } = useSignalAction();

  async function onAction(signalId: string, action: LocalSignalAction) {
    await performAction(signalId, action);
  }

  return (
    <article className="min-h-[440px] rounded-2xl border border-slate-800 bg-panel p-6">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-wide text-textPrimary">{module.name}</h2>
        <ModulePill tone={module.tone} state={module.state} />
      </header>

      <p className="mb-5 text-sm text-textMuted">{module.summary}</p>

      <div className="space-y-3">
        {loading ? <p className="text-sm text-textMuted">Loading signals...</p> : null}
        {error ? <p className="text-sm text-textMuted">Signal refresh error. Showing last known state.</p> : null}
        {actionError ? <p className="text-sm text-textMuted">Action error: {actionError}</p> : null}
        {!loading && signals.length === 0 ? <p className="text-sm text-textMuted">No active signals in this module.</p> : null}
        {signals.map((signal) => (
          <div key={signal.signal_id} className="rounded-lg border border-slate-800 px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">{formatSourceName(signal.source_ai)}</p>
            <p className="text-sm font-medium text-textPrimary">{signal.title}</p>
            <p className="mt-1 text-sm text-textMuted">{signal.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {actionLabels(module.id).map(({ label, action }) => (
                <button
                  key={`${signal.signal_id}-${action}`}
                  type="button"
                  disabled={actionLoading}
                  onClick={() => onAction(signal.signal_id, action)}
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
