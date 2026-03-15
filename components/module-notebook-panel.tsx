import { useState } from "react";
import type { CoreModule } from "@/types/modules";
import type { LocalSignalAction, SignalItem } from "@/types/signal";
import { useSignalAction, useSignals } from "@/lib/use-signals";
import { useWorkflows } from "@/lib/use-workflows";
import type { WorkflowStatus } from "@/lib/workflow-engine";
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

function workflowBadgeClass(status: WorkflowStatus): string {
  if (status === "blocked") {
    return "border-red-500/40 text-red-300";
  }
  if (status === "pending") {
    return "border-amber-500/40 text-amber-300";
  }
  if (status === "active") {
    return "border-blue-500/40 text-blue-300";
  }
  return "border-emerald-500/30 text-emerald-300/80";
}

export function ModuleNotebookPanel({ module }: ModuleNotebookPanelProps) {
  const moduleKey = module.id === "today" ? undefined : module.id;
  const { signals, loading, error } = useSignals(moduleKey);
  const { performAction, loading: actionLoading, error: actionError } = useSignalAction();
  const { workflows } = useWorkflows();
  const [expandedWorkflows, setExpandedWorkflows] = useState<Record<string, boolean>>({});
  const moduleWorkflows =
    module.id === "signal" ? workflows.filter((workflow) => workflow.status === "blocked" || workflow.status === "pending") : [];

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
        {module.id === "signal" && moduleWorkflows.length > 0 ? (
          <section className="mb-4 rounded-lg border border-slate-800 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-textMuted">Workflows</p>
            <div className="space-y-2">
              {moduleWorkflows.map((workflow) => {
                const isExpanded = expandedWorkflows[workflow.workflow_id] ?? false;
                return (
                  <div key={workflow.workflow_id} className="rounded border border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedWorkflows((prev) => ({
                          ...prev,
                          [workflow.workflow_id]: !isExpanded
                        }))
                      }
                      className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-textPrimary"
                    >
                      <span className={`rounded border px-1.5 py-0.5 uppercase tracking-wide ${workflowBadgeClass(workflow.status)}`}>
                        {workflow.status}
                      </span>
                      <span className="font-medium">{workflow.workflow_id}</span>
                      <span className="text-textMuted">- {workflow.signal_count} signals - {workflow.source_ais.join(" · ")}</span>
                    </button>
                    {isExpanded ? (
                      <div className="space-y-1 border-t border-slate-800 px-2 py-2">
                        {workflow.signals.map((signal) => (
                          <p key={signal.signal_id} className="text-xs text-textMuted">
                            {signal.title}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
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
