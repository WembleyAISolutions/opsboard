import { NextRequest, NextResponse } from "next/server";
import type { ApprovalStatus } from "@/lib/approval-engine";
import { getApprovalEngine } from "@/lib/signal-engine-store";

const allowedStatuses = new Set<ApprovalStatus>(["pending", "approved", "rejected", "deferred"]);

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  if (statusParam && !allowedStatuses.has(statusParam as ApprovalStatus)) {
    return NextResponse.json({ ok: false, error: "invalid status filter" }, { status: 422 });
  }

  const engine = getApprovalEngine();
  const approvals = engine.getAllApprovals(statusParam as ApprovalStatus | undefined);
  return NextResponse.json({
    ok: true,
    count: approvals.length,
    pending_count: engine.getPendingCount(),
    approvals
  });
}
