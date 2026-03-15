import { NextResponse } from "next/server";
import { getSignalCountsByModule, getSignalEngine, getSignalSourceBreakdown } from "@/lib/signal-engine-store";

export function handleSignalsSummaryGet(): { status: number; body: Record<string, unknown> } {
  const engine = getSignalEngine();
  const today = engine.getTodaySummary();
  const week = engine.getWeekSummary();

  return {
    status: 200,
    body: {
      ok: true,
      today: {
        approvals_waiting: today.approvalsWaiting,
        signals_needing_review: today.signalsNeedingReview,
        inbox_items: today.inboxItems
      },
      this_week: {
        in_progress: week.itemsInProgress,
        waiting_approval: week.waitingApproval,
        completed: week.completed
      },
      source_breakdown: getSignalSourceBreakdown(),
      counts_by_module: getSignalCountsByModule()
    }
  };
}

export async function GET() {
  const result = handleSignalsSummaryGet();
  return NextResponse.json(result.body, { status: result.status });
}
