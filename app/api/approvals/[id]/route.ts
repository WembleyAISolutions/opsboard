import { NextResponse } from "next/server";
import { getApprovalEngine } from "@/lib/signal-engine-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const approval = getApprovalEngine().getApproval(id);
  if (!approval) {
    return NextResponse.json({ ok: false, error: "approval not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, approval });
}
