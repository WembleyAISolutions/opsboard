import type { SignalProducerPayload } from "@/types/signal-producer";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "deferred";

export type ApprovalRecord = {
  approval_id: string;
  signal_id: string;
  workflow_id?: string;
  source_ai: string;
  title: string;
  summary: string;
  status: ApprovalStatus;
  requested_at: string;
  decided_at?: string;
  decided_by: "operator";
  notes?: string;
};

export type ApprovalDecision = {
  status: "approved" | "rejected" | "deferred";
  notes?: string;
};

export type ApprovalEngine = {
  registerApproval: (signal: SignalProducerPayload) => void;
  decide: (approval_id: string, decision: ApprovalDecision) => ApprovalRecord | null;
  getApproval: (approval_id: string) => ApprovalRecord | null;
  getBySignalId: (signal_id: string) => ApprovalRecord | null;
  getAllApprovals: (filter?: ApprovalStatus) => ApprovalRecord[];
  getPendingCount: () => number;
};

type ApprovalSignal = SignalProducerPayload & {
  approval_id?: string;
  workflow_id?: string;
};

function sortApprovals(a: ApprovalRecord, b: ApprovalRecord): number {
  const aWeight = a.status === "pending" ? 0 : 1;
  const bWeight = b.status === "pending" ? 0 : 1;
  if (aWeight !== bWeight) {
    return aWeight - bWeight;
  }
  return Date.parse(b.requested_at) - Date.parse(a.requested_at);
}

export function createApprovalEngine(): ApprovalEngine {
  const records = new Map<string, ApprovalRecord>();

  return {
    registerApproval(signal) {
      const input = signal as ApprovalSignal;
      const approvalId = input.approval_id;
      if (!approvalId || records.has(approvalId)) {
        return;
      }

      records.set(approvalId, {
        approval_id: approvalId,
        signal_id: input.signal_id,
        workflow_id: input.workflow_id,
        source_ai: input.source_ai,
        title: input.title,
        summary: input.summary,
        status: "pending",
        requested_at: input.timestamp,
        decided_by: "operator"
      });
    },

    decide(approval_id, decision) {
      const existing = records.get(approval_id);
      if (!existing) {
        return null;
      }
      if (existing.status === "approved" || existing.status === "rejected") {
        return { ...existing };
      }

      const updated: ApprovalRecord = {
        ...existing,
        status: decision.status,
        decided_at: new Date().toISOString(),
        notes: decision.notes
      };
      records.set(approval_id, updated);
      return { ...updated };
    },

    getApproval(approval_id) {
      const record = records.get(approval_id);
      return record ? { ...record } : null;
    },

    getBySignalId(signal_id) {
      for (const record of records.values()) {
        if (record.signal_id === signal_id) {
          return { ...record };
        }
      }
      return null;
    },

    getAllApprovals(filter) {
      const all = [...records.values()];
      const filtered = filter ? all.filter((record) => record.status === filter) : all;
      return filtered.sort(sortApprovals).map((record) => ({ ...record }));
    },

    getPendingCount() {
      return [...records.values()].filter((record) => record.status === "pending").length;
    }
  };
}

export function getApprovalEngine(): ApprovalEngine {
  const globalState = globalThis as typeof globalThis & { _approvalEngine?: ApprovalEngine };
  if (!globalState._approvalEngine) {
    globalState._approvalEngine = createApprovalEngine();
  }
  return globalState._approvalEngine;
}
