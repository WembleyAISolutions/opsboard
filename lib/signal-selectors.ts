import type { SignalItem } from "@/types/signal";

type ModuleKey = "inbox" | "signal" | "approvals" | "voice" | "today";

const priorityWeight: Record<SignalItem["signal_priority"], number> = {
  low: 0,
  normal: 1,
  high: 2
};

const signalKindWeight: Record<SignalItem["signal_kind"], number> = {
  blocked: 3,
  attention: 2,
  approval: 1,
  progress: 1,
  input: 1,
  info: 0
};

function byNewestUpdated(a: SignalItem, b: SignalItem): number {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export function getSignalsByModule(signals: SignalItem[], module: ModuleKey): SignalItem[] {
  if (module === "today") {
    return [];
  }

  return signals.filter((item) => item.target_module === module);
}

export function sortSignalsForModule(signals: SignalItem[], module: ModuleKey): SignalItem[] {
  const cloned = [...signals];

  if (module === "approvals") {
    return cloned.sort((a, b) => {
      const priorityDiff = priorityWeight[b.signal_priority] - priorityWeight[a.signal_priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return byNewestUpdated(a, b);
    });
  }

  if (module === "signal") {
    return cloned.sort((a, b) => {
      const kindDiff = signalKindWeight[b.signal_kind] - signalKindWeight[a.signal_kind];
      if (kindDiff !== 0) {
        return kindDiff;
      }
      const priorityDiff = priorityWeight[b.signal_priority] - priorityWeight[a.signal_priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return byNewestUpdated(a, b);
    });
  }

  if (module === "inbox" || module === "voice") {
    return cloned.sort(byNewestUpdated);
  }

  return cloned;
}
