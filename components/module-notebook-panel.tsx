import { useEffect, useState } from "react";
import type { CoreModule } from "@/types/modules";
import type { LocalSignalAction, SignalItem } from "@/types/signal";
import type { ApprovalRecord, ApprovalStatus } from "@/lib/approval-engine";
import { useApprovals } from "@/lib/use-approvals";
import { useSignalAction, useSignals } from "@/lib/use-signals";
import { useWorkflows } from "@/lib/use-workflows";
import type { WorkflowStatus } from "@/lib/workflow-engine";
import { ModulePill } from "@/ui/module-pill";

type ModuleNotebookPanelProps = {
  module: CoreModule;
};

type RoutingDecision = {
  signal_id: string;
  routing_hint: string | null;
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

function approvalBadgeClass(status: ApprovalStatus): string {
  if (status === "pending") {
    return "border-amber-500/40 text-amber-300";
  }
  if (status === "approved") {
    return "border-emerald-500/40 text-emerald-300";
  }
  if (status === "rejected") {
    return "border-red-500/40 text-red-300";
  }
  return "border-slate-500/40 text-slate-300";
}

function relativeTime(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  const mins = Math.max(1, Math.floor(deltaMs / 60000));
  if (mins < 60) {
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function shortId(id: string): string {
  if (id.length <= 20) {
    return id;
  }
  return `${id.slice(0, 10)}...${id.slice(-6)}`;
}

export function ModuleNotebookPanel({ module }: ModuleNotebookPanelProps) {
  const moduleKey = module.id === "today" ? undefined : module.id;
  const { signals, loading, error } = useSignals(moduleKey);
  const { performAction, loading: actionLoading, error: actionError } = useSignalAction();
  const { approvals } = useApprovals();
  const { workflows } = useWorkflows();
  const [expandedWorkflows, setExpandedWorkflows] = useState<Record<string, boolean>>({});
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, Partial<ApprovalRecord>>>({});
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [routingHints, setRoutingHints] = useState<Record<string, string>>({});
  const moduleWorkflows =
    module.id === "signal" ? workflows.filter((workflow) => workflow.status === "blocked" || workflow.status === "pending") : [];
  const mergedApprovals =
    module.id === "approvals"
      ? approvals.map((approval) => ({
          ...approval,
          ...(approvalOverrides[approval.approval_id] ?? {})
        }))
      : [];
  const pendingApprovals = mergedApprovals.filter((approval) => approval.status === "pending");
  const decidedApprovals = mergedApprovals.filter((approval) => approval.status !== "pending");

  async function onAction(signalId: string, action: LocalSignalAction) {
    await performAction(signalId, action);
  }

  useEffect(() => {
    if (module.id !== "signal" || signals.length === 0) {
      return;
    }
    let cancelled = false;
    const loadRoutingHints = async () => {
      try {
        const response = await fetch("/api/routing");
        const data = (await response.json()) as { ok: boolean; recent_decisions?: RoutingDecision[] };
        if (!response.ok || !data.ok) {
          return;
        }
        const current = new Set(signals.map((signal) => signal.signal_id));
        const mapped = (data.recent_decisions ?? []).reduce<Record<string, string>>((acc, decision) => {
          if (decision.routing_hint && current.has(decision.signal_id)) {
            acc[decision.signal_id] = decision.routing_hint;
          }
          return acc;
        }, {});
        if (!cancelled) {
          setRoutingHints(mapped);
        }
      } catch {
        // non-blocking UI enhancement
      }
    };
    void loadRoutingHints();
    const timer = window.setInterval(() => {
      void loadRoutingHints();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [module.id, signals]);

  async function onApprovalDecision(approvalId: string, status: "approved" | "rejected" | "deferred") {
    const optimistic: Partial<ApprovalRecord> = {
      status,
      decided_at: new Date().toISOString(),
      decided_by: "operator"
    };
    setApprovalOverrides((prev) => ({ ...prev, [approvalId]: { ...(prev[approvalId] ?? {}), ...optimistic } }));
    setApprovalError(null);

    const response = await fetch(`/api/approvals/${encodeURIComponent(approvalId)}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      setApprovalError(`Approval action failed (${response.status})`);
      setApprovalOverrides((prev) => {
        const next = { ...prev };
        delete next[approvalId];
        return next;
      });
    }
  }

  return (
    <article className="min-h-[440px] rounded-2xl border border-slate-800 bg-panel p-6">
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-wide text-textPrimary">{module.name}</h2>
        <ModulePill tone={module.tone} state={module.state} />
      </header>

      <p className="mb-5 text-sm text-textMuted">{module.summary}</p>

      <div className="space-y-3">
        {module.id === "approvals" ? (
          <section className="mb-4 rounded-lg border border-slate-800 p-3">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-textMuted">Pending Approvals</p>
            {approvalError ? <p className="mb-2 text-xs text-textMuted">{approvalError}</p> : null}
            {pendingApprovals.length === 0 ? <p className="text-sm text-textMuted">No pending approvals.</p> : null}
            <div className="space-y-2">
              {pendingApprovals.map((approval) => (
                <div key={approval.approval_id} className="rounded border border-slate-800 px-2 py-2">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${approvalBadgeClass(approval.status)}`}>
                      {approval.status}
                    </span>
                    <span className="text-xs text-textMuted">{shortId(approval.approval_id)}</span>
                    <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                      {approval.source_ai.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-textPrimary">{approval.title}</p>
                  <p className="mt-1 text-sm text-textMuted">{approval.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-textMuted">
                    <span>{relativeTime(approval.requested_at)}</span>
                    {approval.workflow_id ? <span className="rounded border border-slate-700 px-1 py-0.5">{approval.workflow_id}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onApprovalDecision(approval.approval_id, "approved")}
                      className="rounded border border-emerald-600/60 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-300"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprovalDecision(approval.approval_id, "rejected")}
                      className="rounded border border-red-600/60 px-2 py-1 text-[11px] uppercase tracking-wide text-red-300"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprovalDecision(approval.approval_id, "deferred")}
                      className="rounded border border-slate-600/70 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300"
                    >
                      Defer
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {decidedApprovals.length > 0 ? (
              <div className="mt-3 border-t border-slate-800 pt-2">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-textMuted">Recently Decided</p>
                <div className="space-y-1">
                  {decidedApprovals.slice(0, 6).map((approval) => (
                    <div key={approval.approval_id} className="flex items-center gap-2 text-xs text-textMuted">
                      <span className={`rounded border px-1.5 py-0.5 uppercase ${approvalBadgeClass(approval.status)}`}>{approval.status}</span>
                      <span>{shortId(approval.approval_id)}</span>
                      <span>{approval.decided_at ? relativeTime(approval.decided_at) : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
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
            {module.id === "signal" && routingHints[signal.signal_id] ? (
              <p className="mt-1 text-xs text-textMuted">routed: {routingHints[signal.signal_id]}</p>
            ) : null}
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
