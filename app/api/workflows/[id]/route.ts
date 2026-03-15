import { NextResponse } from "next/server";
import { getWorkflowEngine } from "@/lib/signal-engine-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const workflow = getWorkflowEngine().getWorkflow(id);
  if (!workflow) {
    return NextResponse.json({ ok: false, error: "workflow not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, workflow });
}
