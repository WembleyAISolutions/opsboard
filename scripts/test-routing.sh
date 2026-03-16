#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3002"
RUN_ID="$(date +%s)-$RANDOM"

assert_eval() {
  local name="$1"
  local json="$2"
  local expr="$3"
  JSON_INPUT="$json" python3 - "$expr" <<'PY'
import json
import os
import sys
data = json.loads(os.environ["JSON_INPUT"])
if not eval(sys.argv[1]):
    raise SystemExit(1)
PY
  if [ $? -eq 0 ]; then
    echo "PASS - $name"
  else
    echo "FAIL - $name"
    exit 1
  fi
}

emit_signal() {
  local signal_id="$1"
  local source_ai="$2"
  local signal_kind="$3"
  local signal_priority="$4"
  local action_needed="$5"
  local title="$6"
  local summary="$7"
  local routing_hint="${8:-}"

  if [ -n "$routing_hint" ]; then
    curl -sS -X POST "$BASE_URL/api/signals" \
      -H "Content-Type: application/json" \
      -d "{
        \"protocol_version\":\"1.0\",
        \"signal_id\":\"$signal_id\",
        \"source_ai\":\"$source_ai\",
        \"signal_kind\":\"$signal_kind\",
        \"signal_priority\":\"$signal_priority\",
        \"human_action_needed\":$action_needed,
        \"routing_hint\":\"$routing_hint\",
        \"title\":\"$title\",
        \"summary\":\"$summary\",
        \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      }"
  else
    curl -sS -X POST "$BASE_URL/api/signals" \
      -H "Content-Type: application/json" \
      -d "{
        \"protocol_version\":\"1.0\",
        \"signal_id\":\"$signal_id\",
        \"source_ai\":\"$source_ai\",
        \"signal_kind\":\"$signal_kind\",
        \"signal_priority\":\"$signal_priority\",
        \"human_action_needed\":$action_needed,
        \"title\":\"$title\",
        \"summary\":\"$summary\",
        \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      }"
  fi
}

get_decision() {
  local signal_id="$1"
  curl -sS "$BASE_URL/api/routing?signal_id=$signal_id"
}

SIG1="routing-t1-$RUN_ID"
SIG2="routing-t2-$RUN_ID"
SIG3="routing-t3-$RUN_ID"
SIG4="routing-t4-$RUN_ID"
SIG5="routing-t5-$RUN_ID"
SIG6="routing-t6-$RUN_ID"
export SIG1 SIG2 SIG3 SIG4 SIG5 SIG6

echo "Test 1: routing_hint overrides normalize"
R1="$(emit_signal "$SIG1" "HOME_AI" "info" "low" "false" "Monthly budget summary ready" "AI-generated monthly budget overview is ready for review." "finance_review")"
echo "$R1"
D1="$(get_decision "$SIG1")"
echo "$D1"
assert_eval "T1 accepted" "$R1" 'data.get("ok") is True'
assert_eval "T1 routed to approvals with hint" "$D1" 'data.get("ok") is True and data.get("decision",{}).get("final_module")=="approvals" and "routing_hint" in str(data.get("decision",{}).get("rule_applied",""))'

echo "Test 2: source_ai rule applies"
R2="$(emit_signal "$SIG2" "FINANCE_AI" "approval" "high" "true" "Vendor payment approval" "Q1 vendor payment batch 12400. Approve to process.")"
echo "$R2"
D2="$(get_decision "$SIG2")"
echo "$D2"
assert_eval "T2 accepted" "$R2" 'data.get("ok") is True'
assert_eval "T2 finance approval rule" "$D2" 'data.get("decision",{}).get("final_module")=="approvals" and data.get("decision",{}).get("rule_applied")=="Finance approvals always go to approvals queue"'

echo "Test 3: priority escalation applies"
R3="$(emit_signal "$SIG3" "SYSTEM" "blocked" "high" "true" "Critical system alert" "System resource limit reached. Immediate action required.")"
echo "$R3"
D3="$(get_decision "$SIG3")"
echo "$D3"
assert_eval "T3 accepted" "$R3" 'data.get("ok") is True'
assert_eval "T3 escalated to approvals" "$D3" 'data.get("decision",{}).get("final_module")=="approvals" and data.get("decision",{}).get("rule_applied")=="High priority blocks escalate to approvals for immediate decision"'

echo "Test 4: fallback to normalize"
R4="$(emit_signal "$SIG4" "CLAUDE_CODE" "progress" "low" "false" "File read completed" "Read operation completed successfully.")"
echo "$R4"
D4="$(get_decision "$SIG4")"
echo "$D4"
assert_eval "T4 accepted" "$R4" 'data.get("ok") is True'
assert_eval "T4 fallback no rule applied" "$D4" 'data.get("decision",{}).get("rule_applied") is None and data.get("decision",{}).get("original_module")==data.get("decision",{}).get("final_module")'

echo "Test 5: routing_hint urgent maps to signal"
R5="$(emit_signal "$SIG5" "BUSINESS_AI" "attention" "normal" "true" "Customer escalation received" "Enterprise customer escalated support ticket. Needs response." "urgent")"
echo "$R5"
D5="$(get_decision "$SIG5")"
echo "$D5"
assert_eval "T5 accepted" "$R5" 'data.get("ok") is True'
assert_eval "T5 hint maps to signal" "$D5" 'data.get("decision",{}).get("final_module")=="signal" and "routing_hint:urgent"==data.get("decision",{}).get("rule_applied")'

echo "Test 6: Apple Dev blocked to approvals"
R6="$(emit_signal "$SIG6" "APPLE_DEV" "blocked" "high" "true" "App Store rejected" "Version 2.1.0 rejected: Guideline 4.2 design issue.")"
echo "$R6"
D6="$(get_decision "$SIG6")"
echo "$D6"
assert_eval "T6 accepted" "$R6" 'data.get("ok") is True'
assert_eval "T6 apple blocked rule" "$D6" 'data.get("decision",{}).get("final_module")=="approvals" and data.get("decision",{}).get("rule_applied")=="App Store rejections require explicit response"'

echo "Test 7: GET /api/routing stats"
R7="$(curl -sS "$BASE_URL/api/routing")"
echo "$R7"
assert_eval "T7 stats thresholds" "$R7" 'data.get("ok") is True and data.get("stats",{}).get("total_routed",0)>=6 and data.get("stats",{}).get("hint_used",0)>=2 and data.get("stats",{}).get("rule_used",0)>=2 and data.get("stats",{}).get("escalation_used",0)>=1 and len(data.get("recent_decisions",[]))>=6'

echo "Final: /api/routing"
curl -sS "$BASE_URL/api/routing" | python3 -m json.tool
echo "Final: /api/signals/status"
curl -sS "$BASE_URL/api/signals/status" | python3 -m json.tool
