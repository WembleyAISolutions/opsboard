"use client";

import { useMemo, useState } from "react";

type QuickSource = "HOME_AI" | "DEV_AI" | "FINANCE_AI" | "BUSINESS_AI" | "TAX_AI" | "SYSTEM";
type SignalKind = "input" | "attention" | "approval" | "blocked" | "progress" | "info";
type SignalPriority = "low" | "normal" | "high";

type BridgeLog = {
  timestamp: string;
  source_ai: string;
  title: string;
  status: "ok" | "failed";
};

type SignalPayload = {
  protocol_version: "1.0";
  signal_id: string;
  source_ai: string;
  title: string;
  summary: string;
  signal_kind: SignalKind;
  signal_priority: SignalPriority;
  human_action_needed: boolean;
  timestamp: string;
  correlation_id?: string;
  source_ai_instance?: string;
  producer_name?: string;
};

function makeSignalId(source: string): string {
  const prefix = source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${Date.now()}-${rand}`;
}

function extractJsonCandidate(input: string): string | null {
  const fenced = input.match(/```(?:json|signal)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  return input.trim() || null;
}

function isValidSignalPayload(value: unknown): value is SignalPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const requiredStringKeys = [
    "protocol_version",
    "signal_id",
    "source_ai",
    "title",
    "summary",
    "signal_kind",
    "signal_priority",
    "timestamp"
  ];

  const hasRequiredStrings = requiredStringKeys.every((key) => typeof payload[key] === "string" && String(payload[key]).trim().length > 0);
  if (!hasRequiredStrings) {
    return false;
  }

  if (typeof payload.human_action_needed !== "boolean") {
    return false;
  }

  return true;
}

export default function BridgePage() {
  const [mode, setMode] = useState<"quick" | "paste">("quick");

  const [sourceAi, setSourceAi] = useState<QuickSource>("HOME_AI");
  const [signalKind, setSignalKind] = useState<SignalKind>("attention");
  const [priority, setPriority] = useState<SignalPriority>("normal");
  const [humanActionNeeded, setHumanActionNeeded] = useState(true);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [logs, setLogs] = useState<BridgeLog[]>([]);

  const statusStrip = useMemo(() => logs.slice(0, 5), [logs]);

  function pushLog(entry: BridgeLog): void {
    setLogs((prev) => [entry, ...prev].slice(0, 5));
  }

  async function postSignal(payload: SignalPayload): Promise<void> {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { ok?: boolean; signal_id?: string; error?: string };

      if (response.ok && body.ok) {
        setMessage(`Sent successfully: ${body.signal_id ?? payload.signal_id}`);
        pushLog({
          timestamp: new Date().toISOString(),
          source_ai: payload.source_ai,
          title: payload.title,
          status: "ok"
        });
        return;
      }

      const err = body.error ?? `Request failed (${response.status})`;
      setMessage(`Send failed: ${err}`);
      pushLog({
        timestamp: new Date().toISOString(),
        source_ai: payload.source_ai,
        title: payload.title,
        status: "failed"
      });
    } catch (error) {
      const err = error instanceof Error ? error.message : "Unknown network error";
      setMessage(`Send failed: ${err}`);
      pushLog({
        timestamp: new Date().toISOString(),
        source_ai: payload.source_ai,
        title: payload.title || "Untitled signal",
        status: "failed"
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendQuick(): Promise<void> {
    if (!title.trim() || !summary.trim()) {
      setMessage("Title and summary are required.");
      return;
    }

    const payload: SignalPayload = {
      protocol_version: "1.0",
      signal_id: makeSignalId(sourceAi),
      source_ai: sourceAi,
      title: title.trim(),
      summary: summary.trim(),
      signal_kind: signalKind,
      signal_priority: priority,
      human_action_needed: humanActionNeeded,
      timestamp: new Date().toISOString()
    };

    await postSignal(payload);
    setTitle("");
    setSummary("");
    setHumanActionNeeded(true);
    setSignalKind("attention");
    setPriority("normal");
    setSourceAi("HOME_AI");
  }

  async function sendPaste(): Promise<void> {
    const candidate = extractJsonCandidate(pasteText);
    if (!candidate) {
      setMessage("not a valid signal payload");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      setMessage("not a valid signal payload");
      return;
    }

    if (!isValidSignalPayload(parsed)) {
      setMessage("not a valid signal payload");
      return;
    }

    await postSignal(parsed);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-textPrimary">Signal Bridge</h1>
        <a href="/" className="text-sm text-textMuted hover:text-textPrimary">
          &lt;- Back to OpsBoard
        </a>
      </div>

      <div className="rounded-xl border border-slate-800 bg-panel p-4">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("quick")}
            className={`rounded px-3 py-1 text-sm ${mode === "quick" ? "bg-slate-700 text-textPrimary" : "bg-slate-900 text-textMuted"}`}
          >
            Quick Send
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`rounded px-3 py-1 text-sm ${mode === "paste" ? "bg-slate-700 text-textPrimary" : "bg-slate-900 text-textMuted"}`}
          >
            Paste JSON
          </button>
        </div>

        {mode === "quick" ? (
          <div className="grid grid-cols-1 gap-3">
            <label className="text-sm text-textMuted">
              Source AI
              <select value={sourceAi} onChange={(e) => setSourceAi(e.target.value as QuickSource)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-textPrimary">
                <option value="HOME_AI">HOME_AI</option>
                <option value="DEV_AI">DEV_AI</option>
                <option value="FINANCE_AI">FINANCE_AI</option>
                <option value="BUSINESS_AI">BUSINESS_AI</option>
                <option value="TAX_AI">TAX_AI</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>
            </label>

            <label className="text-sm text-textMuted">
              Signal Kind
              <select value={signalKind} onChange={(e) => setSignalKind(e.target.value as SignalKind)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-textPrimary">
                <option value="input">input</option>
                <option value="attention">attention</option>
                <option value="approval">approval</option>
                <option value="blocked">blocked</option>
                <option value="progress">progress</option>
                <option value="info">info</option>
              </select>
            </label>

            <label className="text-sm text-textMuted">
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value as SignalPriority)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-textPrimary">
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-textMuted">
              <input type="checkbox" checked={humanActionNeeded} onChange={(e) => setHumanActionNeeded(e.target.checked)} />
              Human Action Needed
            </label>

            <label className="text-sm text-textMuted">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Parent-teacher booking needed"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-textPrimary"
              />
            </label>

            <label className="text-sm text-textMuted">
              Summary
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Booking window closes Friday. Confirm preferred time slot."
                rows={4}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-textPrimary"
              />
            </label>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void sendQuick();
              }}
              className="rounded bg-slate-700 px-3 py-2 text-sm text-textPrimary disabled:opacity-60"
            >
              Send Signal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <label className="text-sm text-textMuted">
              Paste JSON
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste ChatGPT signal output here"
                rows={10}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-textPrimary"
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void sendPaste();
              }}
              className="rounded bg-slate-700 px-3 py-2 text-sm text-textPrimary disabled:opacity-60"
            >
              Send Signal
            </button>
          </div>
        )}

        {message ? <p className="mt-3 text-sm text-textMuted">{message}</p> : null}
      </div>

      <div className="mt-auto rounded-xl border border-slate-800 bg-panel p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-textMuted">Bridge Session Log (last 5)</p>
        {statusStrip.length === 0 ? (
          <p className="text-sm text-textMuted">No bridge sends yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-textMuted">
            {statusStrip.map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`}>
                [{new Date(entry.timestamp).toLocaleTimeString()}] {entry.source_ai} - {entry.title} - {entry.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
