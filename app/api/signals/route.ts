import { NextResponse } from "next/server";
import { handleWebhookPayload } from "@/examples/adapters/webhook-receiver";
import {
  getActiveSignalCount,
  getSignalCountsByModule,
  getSignalEngine,
  getSignalEngineUptimeMs,
  getSignalSourceBreakdown
} from "@/lib/signal-engine-store";

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Protocol-Version");
  return response;
}

function badPayloadSummary(raw: unknown): { source_ai: string; signal_id: string } {
  if (typeof raw !== "object" || raw === null) {
    return { source_ai: "unknown", signal_id: "unknown" };
  }
  const value = raw as { source_ai?: string; signal_id?: string };
  return {
    source_ai: value.source_ai ?? "unknown",
    signal_id: value.signal_id ?? "unknown"
  };
}

export async function handleSignalsPost(raw: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const result = await handleWebhookPayload(raw, getSignalEngine());
    if (result.ok) {
      return { status: 200, body: { ok: true, signal_id: result.signal_id } };
    }

    const summary = badPayloadSummary(raw);
    console.error(`[signals:rejected] source_ai=${summary.source_ai} signal_id=${summary.signal_id} reason=${result.error}`);

    if (result.error.includes("DUPLICATE")) {
      return { status: 409, body: { ok: false, error: "DUPLICATE" } };
    }
    return { status: 422, body: { ok: false, error: result.error } };
  } catch {
    const summary = badPayloadSummary(raw);
    console.error(`[signals:rejected] source_ai=${summary.source_ai} signal_id=${summary.signal_id} reason=INTERNAL`);
    return { status: 500, body: { ok: false, error: "INTERNAL" } };
  }
}

export function handleSignalsStatusGet(): { status: number; body: Record<string, unknown> } {
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

export async function POST(request: Request) {
  const protocolVersion = request.headers.get("X-Protocol-Version");
  if (protocolVersion) {
    console.error(`[signals:protocol] version=${protocolVersion}`);
  }

  const raw = (await request.json()) as unknown;
  const result = await handleSignalsPost(raw);
  return withCors(NextResponse.json(result.body, { status: result.status }));
}

export async function GET() {
  const result = handleSignalsStatusGet();
  return withCors(NextResponse.json(result.body, { status: result.status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
