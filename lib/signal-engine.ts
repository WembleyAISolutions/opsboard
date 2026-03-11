import type { SignalItem, SignalKind, SignalPriority, SignalStatus, TargetModule, TodaySummary, WeekSummary } from "../types/signal";
import type { DeadSignal, NormalizedSignal, ValidationWarning } from "../types/signal-producer";
import { getSignalsByModule as selectSignalsByModule, sortSignalsForModule } from "./signal-selectors";

type RawSignalInput = Partial<SignalItem> &
  Pick<SignalItem, "signal_id" | "source_ai" | "title" | "summary" | "created_at" | "updated_at">;

export function resolveTargetModule(signal: SignalItem): TargetModule {
  if (signal.target_module === "today_summary_only") {
    return "today_summary_only";
  }

  if (signal.target_module === "voice") {
    return "voice";
  }

  if (signal.signal_kind === "approval" || signal.signal_status === "approval" || signal.human_action_needed) {
    return "approvals";
  }

  if (signal.signal_kind === "attention" || signal.signal_kind === "blocked") {
    return "signal";
  }

  if (signal.signal_kind === "input" && signal.signal_status === "pending") {
    return "inbox";
  }

  return signal.target_module;
}

function normalizePriority(priority: SignalItem["signal_priority"] | undefined): SignalPriority {
  if (priority === "high" || priority === "low") {
    return priority;
  }
  return "normal";
}

function normalizeKind(kind: SignalItem["signal_kind"] | undefined): SignalKind {
  switch (kind) {
    case "approval":
    case "attention":
    case "blocked":
    case "input":
    case "progress":
      return kind;
    case "info":
      return "info";
    default: {
      const unreachable: never = kind as never;
      void unreachable;
      return "info";
    }
  }
}

function normalizeStatus(status: SignalItem["signal_status"] | undefined): SignalStatus {
  switch (status) {
    case "approval":
    case "blocked":
    case "doing":
    case "done":
      return status;
    case "pending":
      return "pending";
    default: {
      const unreachable: never = status as never;
      void unreachable;
      return "pending";
    }
  }
}

export function normalizeSignal(raw: RawSignalInput): SignalItem {
  const base: SignalItem = {
    signal_id: raw.signal_id,
    source_ai: raw.source_ai,
    title: raw.title,
    summary: raw.summary,
    signal_kind: normalizeKind(raw.signal_kind),
    signal_status: normalizeStatus(raw.signal_status),
    signal_priority: normalizePriority(raw.signal_priority),
    target_module: raw.target_module ?? "signal",
    human_action_needed: raw.human_action_needed ?? false,
    created_at: raw.created_at,
    updated_at: raw.updated_at
  };

  if (base.target_module === "today_summary_only") {
    return base;
  }

  if (base.signal_kind === "approval" || base.signal_status === "approval") {
    base.signal_kind = "approval";
    base.signal_status = "approval";
    base.target_module = "approvals";
    base.human_action_needed = true;
  } else if (base.signal_kind === "attention" || base.signal_kind === "blocked") {
    base.target_module = "signal";
  } else if (base.signal_kind === "input" && base.signal_status === "pending" && base.target_module !== "voice") {
    base.target_module = "inbox";
  }

  base.target_module = resolveTargetModule(base);
  return base;
}

export function getTodaySummary(signals: SignalItem[]): TodaySummary {
  return {
    approvalsWaiting: signals.filter((item) => item.target_module === "approvals" && item.signal_status === "approval").length,
    signalsNeedingReview: signals.filter(
      (item) => item.target_module === "signal" && (item.signal_kind === "attention" || item.signal_kind === "blocked")
    ).length,
    inboxItems: signals.filter((item) => item.target_module === "inbox" && item.signal_status === "pending").length
  };
}

export function getWeekSummary(signals: SignalItem[]): WeekSummary {
  return {
    itemsInProgress: signals.filter((item) => item.signal_status === "doing").length,
    waitingApproval: signals.filter((item) => item.signal_status === "approval").length,
    completed: signals.filter((item) => item.signal_status === "done").length
  };
}

type EngineModule = "inbox" | "signal" | "approvals" | "voice" | "today_summary_only";
type EngineAction = "approve" | "reject" | "later" | "mark_reviewed" | "dismiss" | "send_to_inbox";
type EngineInputSignal = SignalItem | NormalizedSignal;

function toSignalItem(signal: EngineInputSignal): SignalItem {
  if ("created_at" in signal && "updated_at" in signal) {
    return signal;
  }

  return {
    signal_id: signal.signal_id,
    source_ai: signal.source_ai,
    title: signal.title,
    summary: signal.summary,
    signal_kind: signal.signal_kind,
    signal_status: signal.signal_status,
    signal_priority: signal.signal_priority,
    target_module: signal.target_module,
    human_action_needed: signal.human_action_needed,
    created_at: signal.timestamp,
    updated_at: signal.timestamp
  };
}

function touch(signal: SignalItem): SignalItem {
  return {
    ...signal,
    updated_at: new Date().toISOString()
  };
}

function applyAction(signal: SignalItem, action: EngineAction): SignalItem {
  switch (action) {
    case "approve":
      return touch({ ...signal, signal_status: "done", human_action_needed: false, target_module: "today_summary_only" });
    case "reject":
      return touch({ ...signal, signal_status: "blocked", human_action_needed: false, target_module: "signal" });
    case "later":
      return touch(signal);
    case "mark_reviewed":
      return touch({ ...signal, signal_status: "done", human_action_needed: false, target_module: "today_summary_only" });
    case "dismiss":
      return touch({ ...signal, is_dismissed: true });
    case "send_to_inbox":
      return touch({ ...signal, target_module: "inbox", signal_status: "pending" });
    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled local action: ${String(exhaustive)}`);
    }
  }
}

export interface LocalSignalEngine {
  ingest(signal: EngineInputSignal): void;
  ingestMany(signals: EngineInputSignal[]): void;
  getSignals(): SignalItem[];
  getSignalsByModule(module: EngineModule): SignalItem[];
  getTodaySummary(): TodaySummary;
  getWeekSummary(): WeekSummary;
  recordDeadSignal(dead: DeadSignal): void;
  getDeadSignals(): DeadSignal[];
  recordWarning(warning: ValidationWarning): void;
  getWarnings(): ValidationWarning[];
  applyLocalAction(signalId: string, action: EngineAction): void;
}

export function createSignalEngine(initialSignals: EngineInputSignal[] = []): LocalSignalEngine {
  let signals: SignalItem[] = initialSignals.map((signal) => toSignalItem(signal));
  let deadSignals: DeadSignal[] = [];
  let warnings: ValidationWarning[] = [];

  return {
    ingest(signal) {
      signals = [...signals, toSignalItem(signal)];
    },
    ingestMany(nextSignals) {
      signals = [...signals, ...nextSignals.map((signal) => toSignalItem(signal))];
    },
    getSignals() {
      return [...signals];
    },
    getSignalsByModule(module) {
      return sortSignalsForModule(selectSignalsByModule(signals, module), module);
    },
    getTodaySummary() {
      return getTodaySummary(signals.filter((signal) => !signal.is_dismissed));
    },
    getWeekSummary() {
      return getWeekSummary(signals.filter((signal) => !signal.is_dismissed));
    },
    recordDeadSignal(dead) {
      deadSignals = [...deadSignals, dead];
    },
    getDeadSignals() {
      return [...deadSignals];
    },
    recordWarning(warning) {
      warnings = [...warnings, warning];
    },
    getWarnings() {
      return [...warnings];
    },
    applyLocalAction(signalId, action) {
      signals = signals.map((signal) => {
        if (signal.signal_id !== signalId) {
          return signal;
        }
        return applyAction(signal, action);
      });
    }
  };
}

