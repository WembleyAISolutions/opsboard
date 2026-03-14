import type { SignalPriority, SignalProducerPayload } from "../../types/signal-producer";

/*
 * Wire to OpsBoard:
 * GitHub -> Settings -> Webhooks -> Add webhook
 * Payload URL: http://localhost:3002/api/webhooks/github
 * Content type: application/json
 * Events: Pull requests, Pushes, Check runs, Deployments,
 *         Vulnerability alerts, Dependabot alerts
 */

export type GitHubWebhookEvent = {
  event: string;
  payload: unknown;
};

type GitHubRepository = {
  full_name?: string;
  default_branch?: string;
};

type KnownPayload = {
  action?: string;
  repository?: GitHubRepository;
  pull_request?: {
    title?: string;
    number?: number;
    user?: { login?: string };
    html_url?: string;
    merged?: boolean;
  };
  check_run?: {
    name?: string;
    conclusion?: string;
    head_sha?: string;
    html_url?: string;
  };
  deployment_status?: {
    state?: string;
    environment?: string;
    target_url?: string;
  };
  alert?: {
    html_url?: string;
  };
  issue?: {
    title?: string;
    number?: number;
    user?: { login?: string };
    html_url?: string;
  };
  ref?: string;
  commits?: unknown[];
};

function random4(): string {
  return Math.random().toString(36).slice(2, 6);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asKnownPayload(payload: unknown): KnownPayload {
  return (asObject(payload) ?? {}) as KnownPayload;
}

function buildBase(eventType: string, payload: KnownPayload): Omit<SignalProducerPayload, "title" | "summary" | "signal_kind" | "signal_priority" | "human_action_needed"> {
  const repository = payload.repository?.full_name;
  return {
    protocol_version: "1.0",
    signal_id: `gh-${eventType}-${Date.now()}-${random4()}`,
    source_ai: "DEV_AI",
    source_ai_instance: repository ?? "github",
    correlation_id: repository,
    producer_name: "github-adapter",
    timestamp: new Date().toISOString()
  };
}

function buildSignal(
  eventType: string,
  payload: KnownPayload,
  fields: {
    title: string;
    summary: string;
    signal_kind: SignalProducerPayload["signal_kind"];
    signal_priority: SignalPriority;
    human_action_needed: boolean;
    source_ref?: string;
  }
): SignalProducerPayload {
  return {
    ...buildBase(eventType, payload),
    title: fields.title,
    summary: fields.summary,
    signal_kind: fields.signal_kind,
    signal_priority: fields.signal_priority,
    human_action_needed: fields.human_action_needed,
    source_ref: fields.source_ref
  };
}

export function mapGitHubEventToSignal(event: GitHubWebhookEvent): SignalProducerPayload | null {
  const payload = asKnownPayload(event.payload);
  const eventType = event.event;

  if (eventType === "pull_request" && payload.action === "opened") {
    const pr = payload.pull_request;
    return buildSignal(eventType, payload, {
      title: `PR ready for review: ${pr?.title ?? "Untitled PR"}`,
      summary: `#${pr?.number ?? "?"} opened by ${pr?.user?.login ?? "unknown"}.`,
      signal_kind: "approval",
      signal_priority: "normal",
      human_action_needed: true,
      source_ref: pr?.html_url
    });
  }

  if (eventType === "check_run" && payload.action === "completed" && payload.check_run?.conclusion === "failure") {
    const checkRun = payload.check_run;
    const sha = checkRun?.head_sha ?? "";
    return buildSignal(eventType, payload, {
      title: `CI check failed: ${checkRun?.name ?? "Unnamed check"}`,
      summary: `Check failed on ${sha.slice(0, 7) || "unknown"}. Review required.`,
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      source_ref: checkRun?.html_url
    });
  }

  if (eventType === "deployment_status" && payload.deployment_status?.state === "pending") {
    const status = payload.deployment_status;
    const env = status?.environment ?? "unknown";
    return buildSignal(eventType, payload, {
      title: `Deployment pending approval: ${env}`,
      summary: `Deploy to ${env} is pending. Approve to proceed.`,
      signal_kind: "approval",
      signal_priority: "high",
      human_action_needed: true,
      source_ref: status?.target_url
    });
  }

  if (
    eventType === "repository_vulnerability_alert" ||
    (eventType === "dependabot_alert" && payload.action === "created")
  ) {
    return buildSignal(eventType, payload, {
      title: "Security vulnerability detected",
      summary: "A dependency vulnerability was flagged. Review required.",
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      source_ref: payload.alert?.html_url
    });
  }

  if (eventType === "issues" && payload.action === "opened") {
    const issue = payload.issue;
    return buildSignal(eventType, payload, {
      title: `New issue: ${issue?.title ?? "Untitled issue"}`,
      summary: `Issue #${issue?.number ?? "?"} opened by ${issue?.user?.login ?? "unknown"}.`,
      signal_kind: "input",
      signal_priority: "normal",
      human_action_needed: false,
      source_ref: issue?.html_url
    });
  }

  if (eventType === "pull_request" && payload.action === "closed" && payload.pull_request?.merged) {
    return buildSignal(eventType, payload, {
      title: `PR merged: ${payload.pull_request.title ?? "Untitled PR"}`,
      summary: "Pull request merged into target branch.",
      signal_kind: "progress",
      signal_priority: "low",
      human_action_needed: false,
      source_ref: payload.pull_request.html_url
    });
  }

  if (eventType === "push") {
    const ref = payload.ref ?? "unknown-ref";
    const defaultBranch = payload.repository?.default_branch;
    if (defaultBranch && ref === `refs/heads/${defaultBranch}`) {
      const commitCount = Array.isArray(payload.commits) ? payload.commits.length : 0;
      return buildSignal(eventType, payload, {
        title: `Push: ${commitCount} commit(s) to ${ref}`,
        summary: `Push received on default branch ${defaultBranch}.`,
        signal_kind: "progress",
        signal_priority: "low",
        human_action_needed: false
      });
    }
  }

  if (eventType === "deployment_status" && payload.deployment_status?.state === "failure") {
    const status = payload.deployment_status;
    const env = status?.environment ?? "unknown";
    return buildSignal(eventType, payload, {
      title: `Deployment failed: ${env}`,
      summary: `Deploy to ${env} failed. Review required.`,
      signal_kind: "blocked",
      signal_priority: "high",
      human_action_needed: true,
      source_ref: status?.target_url
    });
  }

  if (eventType === "deployment_status" && payload.deployment_status?.state === "success") {
    const status = payload.deployment_status;
    const env = status?.environment ?? "unknown";
    return buildSignal(eventType, payload, {
      title: `Deployment succeeded: ${env}`,
      summary: `Deploy to ${env} completed successfully.`,
      signal_kind: "progress",
      signal_priority: "low",
      human_action_needed: false,
      source_ref: status?.target_url
    });
  }

  return null;
}
