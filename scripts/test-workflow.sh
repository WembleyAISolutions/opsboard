#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3002"
RUN_SUFFIX="$(date +%s)-$RANDOM"
WF_TAX="wf-test-tax-2026-$RUN_SUFFIX"
WF_RELEASE="wf-test-release-001-$RUN_SUFFIX"

emit_signal() {
  local signal_id="$1"
  local source_ai="$2"
  local kind="$3"
  local priority="$4"
  local action_needed="$5"
  local title="$6"
  local summary="$7"
  local workflow_id="$8"

  curl -sS -X POST "$BASE_URL/api/signals" \
    -H "Content-Type: application/json" \
    -d "{
      \"protocol_version\":\"1.0\",
      \"signal_id\":\"$signal_id\",
      \"source_ai\":\"$source_ai\",
      \"signal_kind\":\"$kind\",
      \"signal_priority\":\"$priority\",
      \"human_action_needed\":$action_needed,
      \"title\":\"$title\",
      \"summary\":\"$summary\",
      \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"workflow_id\":\"$workflow_id\"
    }"
}

echo "Test 1: Emit signal 1 (attention)"
emit_signal "wf-tax-1-$RUN_SUFFIX" "TAX_AI" "attention" "normal" "true" \
  "Document collection reminder" "Gather income statements and receipts for FY2026." "$WF_TAX"
echo

echo "Test 2: Emit signal 2 (approval)"
emit_signal "wf-tax-2-$RUN_SUFFIX" "TAX_AI" "approval" "high" "true" \
  "Approve tax agent engagement" "Tax AI recommends engaging external agent. Fee: 1800." "$WF_TAX"
echo

echo "Test 3: Emit signal 3 (blocked)"
emit_signal "wf-tax-3-$RUN_SUFFIX" "TAX_AI" "blocked" "high" "true" \
  "Missing BAS statement" "Q3 BAS statement not found. Cannot proceed without it." "$WF_TAX"
echo

echo "Test 4: GET /api/workflows"
curl -sS "$BASE_URL/api/workflows"
echo

echo "Test 5: GET /api/workflows/{wf-tax}"
curl -sS "$BASE_URL/api/workflows/$WF_TAX"
echo

echo "Test 6: Emit second workflow with 2 signals"
emit_signal "wf-release-1-$RUN_SUFFIX" "DEV_AI" "approval" "high" "true" \
  "Release candidate ready" "v1.2.0 build passed all checks." "$WF_RELEASE"
echo
emit_signal "wf-release-2-$RUN_SUFFIX" "DEV_AI" "progress" "normal" "false" \
  "Tests passing" "All 247 tests green." "$WF_RELEASE"
echo

echo "Test 7: GET /api/workflows?status=blocked"
curl -sS "$BASE_URL/api/workflows?status=blocked"
echo

echo "Test 8: GET /api/workflows?status=pending"
curl -sS "$BASE_URL/api/workflows?status=pending"
echo

echo "Test 9: GET /api/workflows/nonexistent-id"
curl -sS -i "$BASE_URL/api/workflows/nonexistent-id"
echo

echo "Final check: GET /api/workflows"
curl -sS "$BASE_URL/api/workflows" | python3 -m json.tool
echo
echo "Final check: GET /api/signals/status"
curl -sS "$BASE_URL/api/signals/status" | python3 -m json.tool
echo
