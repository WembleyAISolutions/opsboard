import { NextResponse } from "next/server";
import { getSignalEngine } from "@/lib/signal-engine-store";
import type { LocalSignalAction, SignalItem } from "@/types/signal";

type ActionBody = {
  signal_id: string;
  action: LocalSignalAction;
};

const allowedActions: LocalSignalAction[] = ["approve", "reject", "later", "mark_reviewed", "dismiss", "send_to_inbox"];

function updateSignalForAction(signal: SignalItem, action: LocalSignalAction): SignalItem | null {
  const updatedAt = new Date().toISOString();

  if (action === "approve") {
    return {
      ...signal,
      human_action_needed: false,
      signal_status: "done",
      target_module: "today_summary_only",
      updated_at: updatedAt
    };
  }

  if (action === "reject") {
    return {
      ...signal,
      human_action_needed: false,
      signal_status: "blocked",
      target_module: "signal",
      updated_at: updatedAt
    };
  }

  if (action === "later") {
    return {
      ...signal,
      signal_priority: "low",
      updated_at: updatedAt
    };
  }

  if (action === "mark_reviewed") {
    return {
      ...signal,
      human_action_needed: false,
      signal_status: "doing",
      updated_at: updatedAt
    };
  }

  if (action === "dismiss") {
    return null;
  }

  return {
    ...signal,
    target_module: "inbox",
    signal_status: "pending",
    updated_at: updatedAt
  };
}

export function handleSignalActionPost(body: ActionBody): { status: number; body: Record<string, unknown> } {
  if (!body.signal_id || !allowedActions.includes(body.action)) {
    return { status: 422, body: { ok: false, error: "Invalid action payload" } };
  }

  const engine = getSignalEngine();
  const target = engine.getSignals().find((signal) => signal.signal_id === body.signal_id && !signal.is_dismissed);
  if (!target) {
    return { status: 404, body: { ok: false, error: "Signal not found" } };
  }

  if (body.action === "send_to_inbox" && target.target_module !== "voice") {
    return { status: 422, body: { ok: false, error: "send_to_inbox is valid only for voice signals" } };
  }

  // Keep core engine untouched: retire current active record then append updated active record.
  engine.applyLocalAction(body.signal_id, "dismiss");
  const updated = updateSignalForAction(target, body.action);
  if (updated) {
    engine.ingest(updated);
  }

  return {
    status: 200,
    body: {
      ok: true,
      signal_id: body.signal_id,
      action: body.action,
      updated_status: updated?.signal_status ?? "dismissed"
    }
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as ActionBody;
  const result = handleSignalActionPost(body);
  return NextResponse.json(result.body, { status: result.status });
}
