import type { SignalProducerPayload } from "@/types/signal-producer";

export type WorkflowStatus = "active" | "blocked" | "pending" | "complete";

export type WorkflowSignalRef = {
  signal_id: string;
  signal_kind: string;
  signal_priority: string;
  title: string;
  status: string;
  timestamp: string;
};

export type Workflow = {
  workflow_id: string;
  status: WorkflowStatus;
  signal_count: number;
  signals: WorkflowSignalRef[];
  created_at: string;
  updated_at: string;
  source_ais: string[];
};

export type WorkflowEngine = {
  registerSignal: (signal: SignalProducerPayload) => void;
  updateSignal: (signal_id: string, status: string) => void;
  getWorkflow: (workflow_id: string) => Workflow | null;
  getAllWorkflows: () => Workflow[];
  getActiveCount: () => number;
};

type WorkflowSignalPayload = SignalProducerPayload & {
  workflow_id?: string;
  signal_status?: string;
  created_at?: string;
  updated_at?: string;
};

function deriveStatus(signals: WorkflowSignalRef[]): WorkflowStatus {
  const isResolved = (status: string) => status === "done" || status === "dismissed" || status === "mark_reviewed";

  if (signals.some((signal) => signal.signal_kind === "blocked" && !isResolved(signal.status))) {
    return "blocked";
  }

  if (signals.some((signal) => signal.signal_kind === "approval" && (signal.status === "approval" || signal.status === "pending"))) {
    return "pending";
  }

  if (signals.length > 0 && signals.every((signal) => isResolved(signal.status))) {
    return "complete";
  }

  return "active";
}

function initialStatus(signal: WorkflowSignalPayload): string {
  if (typeof signal.signal_status === "string") {
    return signal.signal_status;
  }
  if (signal.signal_kind === "approval") {
    return "approval";
  }
  if (signal.signal_kind === "blocked") {
    return "blocked";
  }
  if (signal.signal_kind === "progress") {
    return "doing";
  }
  return "pending";
}

function signalTimestamp(signal: WorkflowSignalPayload): string {
  return signal.updated_at ?? signal.created_at ?? signal.timestamp ?? new Date().toISOString();
}

function asWorkflowSignal(signal: WorkflowSignalPayload): WorkflowSignalRef {
  return {
    signal_id: signal.signal_id,
    signal_kind: signal.signal_kind,
    signal_priority: signal.signal_priority,
    title: signal.title,
    status: initialStatus(signal),
    timestamp: signalTimestamp(signal)
  };
}

export function createWorkflowEngine(): WorkflowEngine {
  const workflows = new Map<string, Workflow>();

  return {
    registerSignal(signal) {
      const item = signal as WorkflowSignalPayload;
      const workflowId = item.workflow_id;
      if (!workflowId) {
        return;
      }

      const now = new Date().toISOString();
      const nextSignal = asWorkflowSignal(item);
      const existing = workflows.get(workflowId);

      if (!existing) {
        const created = nextSignal.timestamp || now;
        const source = item.source_ai ?? "unknown";
        const workflow: Workflow = {
          workflow_id: workflowId,
          status: "active",
          signal_count: 1,
          signals: [nextSignal],
          created_at: created,
          updated_at: created,
          source_ais: [source]
        };
        workflow.status = deriveStatus(workflow.signals);
        workflows.set(workflowId, workflow);
        return;
      }

      if (!existing.signals.some((signalRef) => signalRef.signal_id === nextSignal.signal_id)) {
        existing.signals.push(nextSignal);
      }

      existing.signal_count = existing.signals.length;
      existing.updated_at = now;
      if (item.source_ai && !existing.source_ais.includes(item.source_ai)) {
        existing.source_ais = [...existing.source_ais, item.source_ai];
      }
      existing.status = deriveStatus(existing.signals);
    },

    updateSignal(signal_id, status) {
      const now = new Date().toISOString();
      for (const workflow of workflows.values()) {
        const target = workflow.signals.find((signal) => signal.signal_id === signal_id);
        if (!target) {
          continue;
        }
        target.status = status;
        workflow.updated_at = now;
        workflow.status = deriveStatus(workflow.signals);
        return;
      }
    },

    getWorkflow(workflow_id) {
      const workflow = workflows.get(workflow_id);
      return workflow ? { ...workflow, signals: [...workflow.signals], source_ais: [...workflow.source_ais] } : null;
    },

    getAllWorkflows() {
      return [...workflows.values()].map((workflow) => ({
        ...workflow,
        signals: [...workflow.signals],
        source_ais: [...workflow.source_ais]
      }));
    },

    getActiveCount() {
      return [...workflows.values()].filter((workflow) => workflow.status !== "complete").length;
    }
  };
}

export function getWorkflowEngine(): WorkflowEngine {
  const globalState = globalThis as typeof globalThis & { _workflowEngine?: WorkflowEngine };
  if (!globalState._workflowEngine) {
    globalState._workflowEngine = createWorkflowEngine();
  }
  return globalState._workflowEngine;
}
