import { NextResponse } from "next/server";
import type { ApprovalDecision } from "@/lib/approval-engine";
import { getApprovalEngine } from "@/lib/signal-engine-store";

type Params = { params: Promise<{ id: string }> };
const allowedStatuses = new Set<ApprovalDecision["status"]>(["approved", "rejected", "deferred"]);

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as { status?: string; notes?: string };
  if (!body.status || !allowedStatuses.has(body.status as ApprovalDecision["status"])) {
    return NextResponse.json({ ok: false, error: "invalid decision status" }, { status: 422 });
  }

  const approval = getApprovalEngine().decide(id, {
    status: body.status as ApprovalDecision["status"],
    notes: body.notes
  });
  if (!approval) {
    return NextResponse.json({ ok: false, error: "approval not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, approval });
}
