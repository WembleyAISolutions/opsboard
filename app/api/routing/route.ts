import { NextRequest, NextResponse } from "next/server";
import { getRoutingEngine } from "@/lib/signal-engine-store";

export async function GET(request: NextRequest) {
  const signalId = request.nextUrl.searchParams.get("signal_id");
  const routing = getRoutingEngine();

  if (signalId) {
    const decision = routing.getDecision(signalId);
    if (!decision) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, decision });
  }

  return NextResponse.json({
    ok: true,
    stats: routing.getStats(),
    recent_decisions: routing.getRecentDecisions(20)
  });
}
