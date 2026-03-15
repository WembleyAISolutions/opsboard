#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3002"
RUN_ID="$(date +%s)-$RANDOM"
WORKFLOW_ID="wf-finance-$RUN_ID"
APPROVAL_ID_1="ap-invoice-$RUN_ID"
APPROVAL_ID_2="ap-deploy-$RUN_ID"
SIG_1="sig-approval-1-$RUN_ID"
SIG_2="sig-approval-2-$RUN_ID"
export APPROVAL_ID_1 APPROVAL_ID_2

pass() { echo "PASS - $1"; }
fail() { echo "FAIL - $1"; exit 1; }

post_signal() {
  local signal_id="$1"
  local source_ai="$2"
  local approval_id="$3"
  local workflow_id="$4"
  local title="$5"
  local summary="$6"
  curl -sS -X POST "$BASE_URL/api/signals" \
    -H "Content-Type: application/json" \
    -d "{
      \"protocol_version\":\"1.0\",
      \"signal_id\":\"$signal_id\",
      \"source_ai\":\"$source_ai\",
      \"signal_kind\":\"approval\",
      \"signal_priority\":\"high\",
      \"human_action_needed\":true,
      \"approval_id\":\"$approval_id\",
      \"workflow_id\":\"$workflow_id\",
      \"title\":\"$title\",
      \"summary\":\"$summary\",
      \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }"
}

get_json() {
  curl -sS "$1"
}

assert_json() {
  local description="$1"
  local json="$2"
  local expr="$3"
  JSON_INPUT="$json" python3 - "$expr" <<'PY'
import json
import os
import sys
expr = sys.argv[1]
data = json.loads(os.environ["JSON_INPUT"])
if not eval(expr):
    raise SystemExit(1)
PY
  if [ $? -eq 0 ]; then pass "$description"; else fail "$description"; fi
}

echo "Test 1: Emit approval signal with approval_id"
R1="$(post_signal "$SIG_1" "FINANCE_AI" "$APPROVAL_ID_1" "$WORKFLOW_ID" "Invoice approval required" "Supplier invoice 4200 AUD due Friday. Approve to schedule payment.")"
echo "$R1"
assert_json "Test 1 response ok" "$R1" 'data.get("ok") is True'

echo "Test 2: GET /api/approvals"
R2="$(get_json "$BASE_URL/api/approvals")"
echo "$R2"
assert_json "Test 2 approval appears pending" "$R2" 'any(a.get("approval_id")==os.environ.get("APPROVAL_ID_1") and a.get("status")=="pending" for a in data.get("approvals",[]))'
assert_json "Test 2 pending_count >= 1" "$R2" 'int(data.get("pending_count",0)) >= 1'

echo "Test 3: GET /api/approvals/{approval_id}"
R3="$(get_json "$BASE_URL/api/approvals/$APPROVAL_ID_1")"
echo "$R3"
assert_json "Test 3 status pending" "$R3" 'data.get("ok") is True and data.get("approval",{}).get("status")=="pending"'
assert_json "Test 3 title/source match" "$R3" 'data.get("approval",{}).get("title")=="Invoice approval required" and data.get("approval",{}).get("source_ai")=="FINANCE_AI"'

echo "Test 4: POST decide approved"
R4="$(curl -sS -X POST "$BASE_URL/api/approvals/$APPROVAL_ID_1/decide" -H "Content-Type: application/json" -d '{"status":"approved","notes":"Payment scheduled."}')"
echo "$R4"
assert_json "Test 4 approved with decided_at" "$R4" 'data.get("ok") is True and data.get("approval",{}).get("status")=="approved" and bool(data.get("approval",{}).get("decided_at"))'

echo "Test 5: GET /api/approvals/{approval_id} after approval"
R5="$(get_json "$BASE_URL/api/approvals/$APPROVAL_ID_1")"
echo "$R5"
assert_json "Test 5 notes persisted" "$R5" 'data.get("approval",{}).get("status")=="approved" and data.get("approval",{}).get("notes")=="Payment scheduled."'

echo "Test 6: idempotent decide on already approved"
R6="$(curl -sS -X POST "$BASE_URL/api/approvals/$APPROVAL_ID_1/decide" -H "Content-Type: application/json" -d '{"status":"rejected"}')"
echo "$R6"
assert_json "Test 6 remains approved" "$R6" 'data.get("ok") is True and data.get("approval",{}).get("status")=="approved"'

echo "Test 7: Emit second approval signal"
R7="$(post_signal "$SIG_2" "DEV_AI" "$APPROVAL_ID_2" "wf-release-$RUN_ID" "Approve production deployment" "v1.2.0 ready to deploy to production. All tests passing.")"
echo "$R7"
assert_json "Test 7 response ok" "$R7" 'data.get("ok") is True'

echo "Test 8: Defer second approval"
R8="$(curl -sS -X POST "$BASE_URL/api/approvals/$APPROVAL_ID_2/decide" -H "Content-Type: application/json" -d '{"status":"deferred","notes":"Deploy after business hours."}')"
echo "$R8"
assert_json "Test 8 deferred set" "$R8" 'data.get("ok") is True and data.get("approval",{}).get("status")=="deferred"'

echo "Test 9: GET /api/approvals?status=pending"
R9="$(get_json "$BASE_URL/api/approvals?status=pending")"
echo "$R9"
assert_json "Test 9 only pending results" "$R9" 'all(a.get("status")=="pending" for a in data.get("approvals",[]))'
assert_json "Test 9 no approved/deferred test approvals" "$R9" 'not any(a.get("approval_id") in [os.environ.get("APPROVAL_ID_1"), os.environ.get("APPROVAL_ID_2")] for a in data.get("approvals",[]))'

echo "Test 10: GET /api/approvals?status=deferred"
R10="$(get_json "$BASE_URL/api/approvals?status=deferred")"
echo "$R10"
assert_json "Test 10 second approval deferred with notes" "$R10" 'any(a.get("approval_id")==os.environ.get("APPROVAL_ID_2") and a.get("notes")=="Deploy after business hours." for a in data.get("approvals",[]))'

echo "Test 11: deferred -> approved"
R11="$(curl -sS -X POST "$BASE_URL/api/approvals/$APPROVAL_ID_2/decide" -H "Content-Type: application/json" -d '{"status":"approved","notes":"Approved for after-hours deploy."}')"
echo "$R11"
assert_json "Test 11 second approval now approved" "$R11" 'data.get("ok") is True and data.get("approval",{}).get("status")=="approved"'

echo "Test 12: GET nonexistent approval"
HTTP12="$(curl -sS -o /tmp/approval-404.json -w "%{http_code}" "$BASE_URL/api/approvals/nonexistent-id")"
cat /tmp/approval-404.json
echo
[ "$HTTP12" = "404" ] && pass "Test 12 404 returned" || fail "Test 12 404 returned"
assert_json "Test 12 body ok false" "$(cat /tmp/approval-404.json)" 'data.get("ok") is False'

echo "Final check: GET /api/approvals"
curl -sS "$BASE_URL/api/approvals" | python3 -m json.tool
