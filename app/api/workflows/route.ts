import { NextRequest, NextResponse } from "next/server";
import type { WorkflowStatus } from "@/lib/workflow-engine";
import { getWorkflowEngine } from "@/lib/signal-engine-store";

const allowedStatus = new Set<WorkflowStatus>(["blocked", "pending", "active", "complete"]);

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const workflowEngine = getWorkflowEngine();
  let workflows = workflowEngine.getAllWorkflows();

  if (status) {
    if (!allowedStatus.has(status as WorkflowStatus)) {
      return NextResponse.json({ ok: false, error: "invalid status filter" }, { status: 422 });
    }
    workflows = workflows.filter((workflow) => workflow.status === status);
  }

  workflows = workflows.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  return NextResponse.json({ ok: true, count: workflows.length, workflows });
}
