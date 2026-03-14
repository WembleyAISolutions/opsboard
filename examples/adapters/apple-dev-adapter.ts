import { emitSignal } from "../../lib/signal-producer-transport";
import type { SignalEngine } from "../../lib/signal-producer-transport";
import type { EmitResult, SignalProducerPayload, SourceAI } from "../../types/signal-producer";

/*
 * Xcode: POST events to http://localhost:3002/api/webhooks/apple
 *   from a build phase script or CI pipeline.
 *
 * Shortcuts (macOS/iOS, no code):
 *   Shortcuts -> New -> Get Contents of URL
 *   URL: http://localhost:3002/api/signals
 *   Method: POST, Request Body: JSON
 *   Map your Shortcut inputs to title and summary fields.
 */

export type AppleDevEvent = {
  type: string;
  payload: unknown;
};

type JsonRecord = Record<string, unknown>;

export type XcodeBuildEvent = {
  result: "succeeded" | "failed" | "warning";
  scheme: string;
  target: string;
  error_message?: string;
  warning_message?: string;
};

export type TestFlightBuildEvent = {
  version: string;
  build_number: string;
  processing_state: "PROCESSING" | "FAILED" | "VALID" | "INVALID";
  failure_reason?: string;
};

export type AppStoreConnectEvent = {
  type: "review_approved" | "review_rejected" | "ready_for_sale" | "metadata_rejected" | "pending_developer_release";
  app_name: string;
  version: string;
  notes?: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? (value as JsonRecord) : null;
}

function random4(): string {
  return Math.random().toString(36).slice(2, 6);
}

function normalizedTypeSegment(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function appleBase(eventType: string): Pick<
  SignalProducerPayload,
  "protocol_version" | "signal_id" | "source_ai" | "producer_name" | "timestamp"
> {
  return {
    protocol_version: "1.0",
    signal_id: `apple-${normalizedTypeSegment(eventType)}-${Date.now()}-${random4()}`,
    source_ai: "APPLE_DEV",
    producer_name: "apple-dev-adapter",
    timestamp: new Date().toISOString()
  };
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function mapXcodeEventToSignal(event: AppleDevEvent): SignalProducerPayload | null {
  const payload = asRecord(event.payload) ?? {};

  if (event.type === "xcode.build_failed") {
    const errors = payload.errors;
    const summary = typeof errors === "string" && errors.trim().length > 0 ? errors : "Build failed. Review required.";
    return {
      ...appleBase(event.type),
      source_ai_instance: "xcode",
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      title: "Xcode build failed",
      summary
    };
  }

  if (event.type === "xcode.test_failed") {
    const failedCount = typeof payload.failed_count === "number" ? payload.failed_count : null;
    const firstFailed = typeof payload.first_failed === "string" ? payload.first_failed : null;
    const details =
      failedCount !== null && firstFailed
        ? `${failedCount} test(s) failed. First: ${firstFailed}.`
        : failedCount !== null
          ? `${failedCount} test(s) failed.`
          : "Tests failed. Review required.";
    return {
      ...appleBase(event.type),
      source_ai_instance: "xcode",
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      title: "Tests failed",
      summary: details
    };
  }

  if (event.type === "xcode.archive_ready") {
    const appName = text(payload.app_name, "App");
    const version = text(payload.version, "unknown");
    return {
      ...appleBase(event.type),
      source_ai_instance: "xcode",
      signal_kind: "approval",
      signal_priority: "normal",
      human_action_needed: true,
      title: "Archive ready for distribution",
      summary: `${appName} ${version} archive is ready for distribution approval.`
    };
  }

  if (event.type === "xcode.build_succeeded" || event.type === "xcode.test_succeeded") {
    return null;
  }

  return null;
}

export function mapTestFlightEventToSignal(event: AppleDevEvent): SignalProducerPayload | null {
  const payload = asRecord(event.payload) ?? {};

  if (event.type === "testflight.crash_report") {
    const crashRate = typeof payload.crash_rate === "number" ? payload.crash_rate : 0;
    if (crashRate >= 5) {
      return {
        ...appleBase(event.type),
        source_ai_instance: "testflight",
        signal_kind: "blocked",
        signal_priority: "high",
        human_action_needed: true,
        title: "TestFlight crash rate critical",
        summary: `Crash rate ${crashRate}%. Immediate review required.`
      };
    }
    return {
      ...appleBase(event.type),
      source_ai_instance: "testflight",
      signal_kind: "attention",
      signal_priority: "normal",
      human_action_needed: true,
      title: "TestFlight crashes detected",
      summary: `Crash rate ${crashRate}%. Monitor.`
    };
  }

  if (event.type === "testflight.new_build_available") {
    return {
      ...appleBase(event.type),
      source_ai_instance: "testflight",
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      title: "TestFlight build available",
      summary: "A new TestFlight build is ready for tester access."
    };
  }

  if (event.type === "testflight.tester_feedback") {
    const feedback = typeof payload.feedback_text === "string" ? payload.feedback_text.slice(0, 120) : "Feedback received.";
    return {
      ...appleBase(event.type),
      source_ai_instance: "testflight",
      signal_kind: "input",
      signal_priority: "normal",
      human_action_needed: false,
      title: "TestFlight feedback received",
      summary: feedback
    };
  }

  return null;
}

export function mapAppStoreEventToSignal(event: AppleDevEvent): SignalProducerPayload | null {
  const payload = asRecord(event.payload) ?? {};

  if (event.type === "appstore.review_rejected") {
    return {
      ...appleBase(event.type),
      source_ai_instance: "appstore",
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      title: "App rejected by App Store Review",
      summary: text(payload.rejection_reason, "Review rejection. Response required.")
    };
  }

  if (event.type === "appstore.review_approved") {
    return {
      ...appleBase(event.type),
      source_ai_instance: "appstore",
      signal_kind: "progress",
      signal_priority: "normal",
      human_action_needed: false,
      title: "App approved by App Store Review",
      summary: "Review approved. Continue release flow."
    };
  }

  if (event.type === "appstore.app_live") {
    return {
      ...appleBase(event.type),
      source_ai_instance: "appstore",
      signal_kind: "progress",
      signal_priority: "normal",
      human_action_needed: false,
      title: "App is now live on the App Store",
      summary: "Release is live for users."
    };
  }

  if (event.type === "appstore.review_in_review") {
    return {
      ...appleBase(event.type),
      source_ai_instance: "appstore",
      signal_kind: "info",
      signal_priority: "low",
      human_action_needed: false,
      title: "App Store review in progress",
      summary: "Submission is currently in Apple review."
    };
  }

  return null;
}

export function mapShortcutEventToSignal(event: AppleDevEvent): SignalProducerPayload | null {
  const payload = asRecord(event.payload);
  if (!payload) {
    return null;
  }

  const requiredText = ["protocol_version", "signal_id", "title", "summary", "timestamp"] as const;
  for (const key of requiredText) {
    if (typeof payload[key] !== "string" || (payload[key] as string).trim().length === 0) {
      return null;
    }
  }
  if (typeof payload.signal_kind !== "string" || typeof payload.signal_priority !== "string") {
    return null;
  }
  if (typeof payload.human_action_needed !== "boolean") {
    return null;
  }

  const sourceAI = (payload.source_ai as SourceAI | undefined) ?? "HOME_AI";
  return {
    protocol_version: payload.protocol_version as string,
    signal_id: payload.signal_id as string,
    source_ai: sourceAI,
    title: payload.title as string,
    summary: payload.summary as string,
    signal_kind: payload.signal_kind as SignalProducerPayload["signal_kind"],
    signal_priority: payload.signal_priority as SignalProducerPayload["signal_priority"],
    human_action_needed: payload.human_action_needed as boolean,
    timestamp: payload.timestamp as string,
    source_ref: typeof payload.source_ref === "string" ? payload.source_ref : undefined,
    correlation_id: typeof payload.correlation_id === "string" ? payload.correlation_id : undefined,
    producer_name: "shortcuts-adapter",
    source_ai_instance: typeof payload.source_ai_instance === "string" ? payload.source_ai_instance : "shortcuts",
    metadata: typeof payload.metadata === "object" && payload.metadata !== null ? (payload.metadata as Record<string, unknown>) : undefined
  };
}

export function mapAppleDevEventToSignal(event: AppleDevEvent): SignalProducerPayload | null {
  if (event.type.startsWith("xcode.")) {
    return mapXcodeEventToSignal(event);
  }
  if (event.type.startsWith("testflight.")) {
    return mapTestFlightEventToSignal(event);
  }
  if (event.type.startsWith("appstore.")) {
    return mapAppStoreEventToSignal(event);
  }
  if (event.type.startsWith("shortcut.")) {
    return mapShortcutEventToSignal(event);
  }
  return null;
}

// Backward-compatible emitter wrappers used by existing tests/examples.
export async function emitFromXcodeBuild(build: XcodeBuildEvent, engine: SignalEngine): Promise<EmitResult> {
  let mapped: SignalProducerPayload | null = null;
  if (build.result === "failed") {
    mapped = mapAppleDevEventToSignal({ type: "xcode.build_failed", payload: { errors: build.error_message } });
  } else if (build.result === "succeeded") {
    mapped = mapAppleDevEventToSignal({ type: "xcode.build_succeeded", payload: {} });
  } else {
    mapped = mapAppleDevEventToSignal({
      type: "xcode.test_failed",
      payload: { failed_count: 1, first_failed: build.warning_message ?? "Build warning" }
    });
  }

  if (!mapped) {
    return { ok: true, signal_id: `apple-xcode-skip-${Date.now()}` };
  }
  return emitSignal(mapped, engine);
}

export async function emitFromTestFlight(build: TestFlightBuildEvent, engine: SignalEngine): Promise<EmitResult> {
  let mapped: SignalProducerPayload | null = null;
  if (build.processing_state === "PROCESSING") {
    return { ok: true, signal_id: `apple-testflight-skip-${build.version}-${build.build_number}` };
  }
  if (build.processing_state === "FAILED") {
    mapped = mapAppleDevEventToSignal({ type: "testflight.crash_report", payload: { crash_rate: 6, detail: build.failure_reason } });
  } else if (build.processing_state === "VALID") {
    mapped = mapAppleDevEventToSignal({ type: "testflight.new_build_available", payload: { version: build.version } });
  } else {
    mapped = mapAppleDevEventToSignal({ type: "testflight.tester_feedback", payload: { feedback_text: "Build invalid. Check details." } });
  }

  if (!mapped) {
    return { ok: true, signal_id: `apple-testflight-skip-${Date.now()}` };
  }
  return emitSignal(mapped, engine);
}

export async function emitFromAppStoreConnect(event: AppStoreConnectEvent, engine: SignalEngine): Promise<EmitResult> {
  let mapped: SignalProducerPayload | null = null;
  if (event.type === "review_rejected" || event.type === "metadata_rejected") {
    mapped = mapAppleDevEventToSignal({
      type: "appstore.review_rejected",
      payload: { rejection_reason: event.notes ?? "Review rejection. Response required." }
    });
  } else if (event.type === "review_approved") {
    mapped = mapAppleDevEventToSignal({ type: "appstore.review_approved", payload: { app_name: event.app_name, version: event.version } });
  } else if (event.type === "ready_for_sale") {
    mapped = mapAppleDevEventToSignal({ type: "appstore.app_live", payload: { app_name: event.app_name, version: event.version } });
  } else {
    mapped = mapAppleDevEventToSignal({ type: "appstore.review_in_review", payload: { app_name: event.app_name, version: event.version } });
  }

  if (!mapped) {
    return { ok: true, signal_id: `apple-appstore-skip-${Date.now()}` };
  }
  return emitSignal(mapped, engine);
}
