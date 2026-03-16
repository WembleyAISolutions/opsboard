import { NextResponse } from "next/server";
import {
  getActiveSignalCount,
  getSignalCountsByModule,
  getSignalEngine,
  getSignalEngineUptimeMs,
  getSignalSourceBreakdown
} from "@/lib/signal-engine-store";

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Protocol-Version");
  return response;
}

function handleSignalsStatusGet(): { status: number; body: Record<string, unknown> } {
  const engine = getSignalEngine();
  return {
    status: 200,
    body: {
      ok: true,
      active_signals: getActiveSignalCount(),
      dead_signal_count: engine.getDeadSignals().length,
      warning_count: engine.getWarnings().length,
      source_breakdown: getSignalSourceBreakdown(),
      counts_by_module: getSignalCountsByModule(),
      uptime_ms: getSignalEngineUptimeMs()
    }
  };
}

export async function GET() {
  const result = handleSignalsStatusGet();
  return withCors(NextResponse.json(result.body, { status: result.status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
