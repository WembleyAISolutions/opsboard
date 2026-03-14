import { NextRequest, NextResponse } from "next/server";
import { mapAppleDevEventToSignal } from "@/examples/adapters/apple-dev-adapter";
import { getSignalEngine } from "@/lib/signal-engine-store";
import { emitSignal } from "@/lib/signal-producer-transport";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const signal = mapAppleDevEventToSignal(body as { type: string; payload: unknown });
    if (!signal) {
      return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 422 });
    }

    const engine = getSignalEngine();
    const result = await emitSignal(signal, engine);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
