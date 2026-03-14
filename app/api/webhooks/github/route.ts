import { NextRequest, NextResponse } from "next/server";
import { mapGitHubEventToSignal } from "@/examples/adapters/github-adapter";
import { getSignalEngine } from "@/lib/signal-engine-store";
import { emitSignal } from "@/lib/signal-producer-transport";

export async function POST(req: NextRequest) {
  try {
    const event = req.headers.get("x-github-event") ?? "";
    const payload = (await req.json()) as unknown;
    const signal = mapGitHubEventToSignal({ event, payload });
    if (!signal) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const engine = getSignalEngine();
    const result = await emitSignal(signal, engine);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
