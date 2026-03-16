import type { SignalProducerPayload, TargetModule } from "@/types/signal-producer";
import { DEFAULT_ROUTING_CONFIG } from "@/lib/routing-config";
import type { RoutingConfig } from "@/lib/routing-config";

export type RoutingDecision = {
  signal_id: string;
  original_module: TargetModule;
  final_module: TargetModule;
  rule_applied: string | null;
  routing_hint: string | null;
  timestamp: string;
};

export type RoutingStats = {
  total_routed: number;
  overrides: number;
  fallbacks: number;
  hint_used: number;
  rule_used: number;
  escalation_used: number;
};

export type RoutingEngine = {
  route: (signal: SignalProducerPayload, normalizedModule: TargetModule) => TargetModule;
  getDecision: (signal_id: string) => RoutingDecision | null;
  getRecentDecisions: (limit?: number) => RoutingDecision[];
  getStats: () => RoutingStats;
};

type RouteInput = SignalProducerPayload & {
  routing_hint?: string;
};

export function createRoutingEngine(config: RoutingConfig = DEFAULT_ROUTING_CONFIG): RoutingEngine {
  const decisions: RoutingDecision[] = [];
  const decisionMap = new Map<string, RoutingDecision>();
  const stats: RoutingStats = {
    total_routed: 0,
    overrides: 0,
    fallbacks: 0,
    hint_used: 0,
    rule_used: 0,
    escalation_used: 0
  };

  function storeDecision(decision: RoutingDecision): void {
    decisions.push(decision);
    decisionMap.set(decision.signal_id, decision);
    if (decisions.length > 500) {
      const dropped = decisions.shift();
      if (dropped) {
        decisionMap.delete(dropped.signal_id);
      }
    }
  }

  return {
    route(signal, normalizedModule) {
      const input = signal as RouteInput;
      const routingHint = typeof input.routing_hint === "string" ? input.routing_hint : null;
      const now = new Date().toISOString();
      let finalModule: TargetModule = normalizedModule;
      let ruleApplied: string | null = null;

      if (routingHint && config.routing_hint_map[routingHint]) {
        finalModule = config.routing_hint_map[routingHint];
        ruleApplied = `routing_hint:${routingHint}`;
        stats.hint_used += 1;
      } else {
        const sourceRule = config.source_ai_rules.find((rule) => {
          if (rule.source_ai !== input.source_ai) {
            return false;
          }
          if (rule.signal_kind && rule.signal_kind !== input.signal_kind) {
            return false;
          }
          if (rule.signal_priority && rule.signal_priority !== input.signal_priority) {
            return false;
          }
          return true;
        });

        if (sourceRule) {
          finalModule = sourceRule.target_module;
          ruleApplied = sourceRule.reason;
          stats.rule_used += 1;
        } else {
          const escalationRule = config.priority_escalation.find(
            (rule) => rule.signal_priority === input.signal_priority && rule.signal_kind === input.signal_kind
          );
          if (escalationRule) {
            finalModule = escalationRule.target_module;
            ruleApplied = escalationRule.reason;
            stats.escalation_used += 1;
          } else {
            stats.fallbacks += 1;
          }
        }
      }

      stats.total_routed += 1;
      if (finalModule !== normalizedModule) {
        stats.overrides += 1;
      }

      storeDecision({
        signal_id: input.signal_id,
        original_module: normalizedModule,
        final_module: finalModule,
        rule_applied: ruleApplied,
        routing_hint: routingHint,
        timestamp: now
      });

      return finalModule;
    },

    getDecision(signal_id) {
      return decisionMap.get(signal_id) ?? null;
    },

    getRecentDecisions(limit = 20) {
      return decisions.slice(Math.max(0, decisions.length - limit)).reverse();
    },

    getStats() {
      return { ...stats };
    }
  };
}

export function getRoutingEngine(): RoutingEngine {
  const globalState = globalThis as typeof globalThis & { _routingEngine?: RoutingEngine };
  if (!globalState._routingEngine) {
    globalState._routingEngine = createRoutingEngine();
  }
  return globalState._routingEngine;
}
