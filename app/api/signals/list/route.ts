import { NextResponse } from "next/server";
import { getSignalEngine } from "@/lib/signal-engine-store";
import type { TargetModule } from "@/types/signal-producer";

const allowedModules: TargetModule[] = ["inbox", "signal", "approvals", "voice", "today_summary_only"];

function priorityWeight(priority: string): number {
  if (priority === "critical") {
    return 4;
  }
  if (priority === "high") {
    return 3;
  }
  if (priority === "normal") {
    return 2;
  }
  return 1;
}

function sortSignals<T extends { signal_priority: string; created_at: string }>(signals: T[]): T[] {
  return [...signals].sort((a, b) => {
    const byPriority = priorityWeight(b.signal_priority) - priorityWeight(a.signal_priority);
    if (byPriority !== 0) {
      return byPriority;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function handleSignalsListGet(module?: string): { status: number; body: Record<string, unknown> } {
  const engine = getSignalEngine();
  const activeSignals = engine.getSignals().filter((signal) => !signal.is_dismissed);

  if (!module) {
    const signals = sortSignals(activeSignals);
    return { status: 200, body: { ok: true, signals, count: signals.length } };
  }

  if (!allowedModules.includes(module as TargetModule)) {
    return { status: 422, body: { ok: false, error: "Invalid module filter" } };
  }

  const filtered = activeSignals.filter((signal) => signal.target_module === module);
  const signals = sortSignals(filtered);
  return { status: 200, body: { ok: true, signals, count: signals.length } };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const module = url.searchParams.get("module") ?? undefined;
  const result = handleSignalsListGet(module);
  return NextResponse.json(result.body, { status: result.status });
}
