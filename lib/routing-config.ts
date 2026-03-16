import type { TargetModule } from "@/types/signal-producer";

export type RoutingHintMap = Record<string, TargetModule>;

export type SourceAIRule = {
  source_ai: string;
  signal_kind?: string;
  signal_priority?: string;
  target_module: TargetModule;
  reason: string;
};

export type PriorityEscalationRule = {
  signal_priority: "high";
  signal_kind: string;
  target_module: TargetModule;
  reason: string;
};

export type RoutingConfig = {
  routing_hint_map: RoutingHintMap;
  source_ai_rules: SourceAIRule[];
  priority_escalation: PriorityEscalationRule[];
};

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  routing_hint_map: {
    finance_review: "approvals",
    dev_review: "approvals",
    legal_review: "approvals",
    tax_review: "approvals",
    inbox: "inbox",
    signal: "signal",
    approvals: "approvals",
    voice: "voice",
    urgent: "signal",
    info: "inbox"
  },
  source_ai_rules: [
    {
      source_ai: "FINANCE_AI",
      signal_kind: "approval",
      target_module: "approvals",
      reason: "Finance approvals always go to approvals queue"
    },
    {
      source_ai: "FINANCE_AI",
      signal_kind: "blocked",
      target_module: "approvals",
      reason: "Finance blocks require explicit decision"
    },
    {
      source_ai: "TAX_AI",
      signal_kind: "approval",
      target_module: "approvals",
      reason: "Tax approvals always require explicit decision"
    },
    {
      source_ai: "DEV_AI",
      signal_kind: "approval",
      target_module: "approvals",
      reason: "Dev approvals (deploys, PRs) go to approvals queue"
    },
    {
      source_ai: "CLAUDE_CODE",
      signal_kind: "approval",
      target_module: "approvals",
      reason: "Claude Code tool approvals go to approvals queue"
    },
    {
      source_ai: "APPLE_DEV",
      signal_kind: "blocked",
      target_module: "approvals",
      reason: "App Store rejections require explicit response"
    },
    {
      source_ai: "HOME_AI",
      signal_kind: "input",
      target_module: "inbox",
      reason: "Home AI inputs go to inbox for first look"
    },
    {
      source_ai: "BUSINESS_AI",
      signal_kind: "input",
      target_module: "inbox",
      reason: "Business AI inputs go to inbox for first look"
    }
  ],
  priority_escalation: [
    {
      signal_priority: "high",
      signal_kind: "blocked",
      target_module: "approvals",
      reason: "High priority blocks escalate to approvals for immediate decision"
    },
    {
      signal_priority: "high",
      signal_kind: "attention",
      target_module: "signal",
      reason: "High priority attention stays in signal for visibility"
    }
  ]
};
