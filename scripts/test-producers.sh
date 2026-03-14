#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3002"
RUN_ID="$(date +%s)-$RANDOM"

post_json() {
  local url="$1"
  local body="$2"
  shift 2
  curl -sS "$url" \
    -X POST \
    -H "Content-Type: application/json" \
    "$@" \
    -d "$body"
}

echo "OpsBoard v0.5 producer tests"
echo "Base URL: $BASE_URL"
echo "Run ID: $RUN_ID"
echo

echo "Layer 1 - direct /api/signals adapter-style payload tests"

echo "Test 1: GitHub PR opened -> DEV_AI approval normal"
post_json "$BASE_URL/api/signals" "{
  \"protocol_version\": \"1.0\",
  \"signal_id\": \"test-gh-pr-$RUN_ID\",
  \"source_ai\": \"DEV_AI\",
  \"source_ai_instance\": \"org/repo\",
  \"producer_name\": \"github-adapter\",
  \"title\": \"PR ready for review: Improve login retry\",
  \"summary\": \"#128 opened by octocat.\",
  \"signal_kind\": \"approval\",
  \"signal_priority\": \"normal\",
  \"human_action_needed\": true,
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
echo
sleep 0.5

echo "Test 2: GitHub CI check failed -> DEV_AI blocked high"
post_json "$BASE_URL/api/signals" "{
  \"protocol_version\": \"1.0\",
  \"signal_id\": \"test-gh-ci-$RUN_ID\",
  \"source_ai\": \"DEV_AI\",
  \"source_ai_instance\": \"org/repo\",
  \"producer_name\": \"github-adapter\",
  \"title\": \"CI check failed: unit-tests\",
  \"summary\": \"Check failed on a1b2c3d. Review required.\",
  \"signal_kind\": \"blocked\",
  \"signal_priority\": \"high\",
  \"human_action_needed\": true,
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
echo
sleep 0.5

echo "Test 3: GitHub deployment pending -> DEV_AI approval high"
post_json "$BASE_URL/api/signals" "{
  \"protocol_version\": \"1.0\",
  \"signal_id\": \"test-gh-deploy-$RUN_ID\",
  \"source_ai\": \"DEV_AI\",
  \"source_ai_instance\": \"org/repo\",
  \"producer_name\": \"github-adapter\",
  \"title\": \"Deployment pending approval: production\",
  \"summary\": \"Deploy to production is pending. Approve to proceed.\",
  \"signal_kind\": \"approval\",
  \"signal_priority\": \"high\",
  \"human_action_needed\": true,
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
echo
sleep 0.5

echo "Test 4: Zapier finance -> FINANCE_AI approval high"
post_json "$BASE_URL/api/signals" "{
  \"protocol_version\": \"1.0\",
  \"signal_id\": \"test-zap-finance-$RUN_ID\",
  \"source_ai\": \"FINANCE_AI\",
  \"producer_name\": \"zapier-adapter\",
  \"title\": \"Invoice approval required\",
  \"summary\": \"Supplier invoice \$4,200 AUD due Friday.\",
  \"signal_kind\": \"approval\",
  \"signal_priority\": \"high\",
  \"human_action_needed\": true,
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
echo
sleep 0.5

echo "Test 5: Zapier business -> BUSINESS_AI attention normal"
post_json "$BASE_URL/api/signals" "{
  \"protocol_version\": \"1.0\",
  \"signal_id\": \"test-zap-business-$RUN_ID\",
  \"source_ai\": \"BUSINESS_AI\",
  \"producer_name\": \"zapier-adapter\",
  \"title\": \"Customer inquiry flagged as urgent\",
  \"summary\": \"High-priority support request received. Review within 24h.\",
  \"signal_kind\": \"attention\",
  \"signal_priority\": \"normal\",
  \"human_action_needed\": true,
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
echo
sleep 0.5

echo "Test 6: Apple Dev Xcode build failed -> APPLE_DEV blocked high"
post_json "$BASE_URL/api/signals" "{
  \"protocol_version\": \"1.0\",
  \"signal_id\": \"test-apple-xcode-$RUN_ID\",
  \"source_ai\": \"APPLE_DEV\",
  \"source_ai_instance\": \"xcode\",
  \"producer_name\": \"apple-dev-adapter\",
  \"title\": \"Xcode build failed\",
  \"summary\": \"Build failed. Review required.\",
  \"signal_kind\": \"blocked\",
  \"signal_priority\": \"high\",
  \"human_action_needed\": true,
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
echo
sleep 0.5

echo "Layer 2 - webhook route integration tests"

echo "Test 7: /api/webhooks/github pull_request.opened raw payload"
post_json "$BASE_URL/api/webhooks/github" "{
  \"action\": \"opened\",
  \"repository\": { \"full_name\": \"org/repo\", \"default_branch\": \"main\" },
  \"pull_request\": {
    \"title\": \"Add producer integration tests\",
    \"number\": 77,
    \"user\": { \"login\": \"octocat\" },
    \"html_url\": \"https://github.com/org/repo/pull/77\"
  }
}" -H "X-GitHub-Event: pull_request"
echo
sleep 0.5

echo "Test 8: /api/webhooks/zapier simplified payload"
post_json "$BASE_URL/api/webhooks/zapier" "{
  \"source\": \"FINANCE_AI\",
  \"kind\": \"approval\",
  \"title\": \"Monthly payout approval required\",
  \"summary\": \"Approve scheduled payout for payroll batch.\"
}"
echo
sleep 0.5

echo "Test 9: /api/webhooks/apple appstore.review_rejected payload"
post_json "$BASE_URL/api/webhooks/apple" "{
  \"type\": \"appstore.review_rejected\",
  \"payload\": {
    \"rejection_reason\": \"guideline 4.2\"
  }
}"
echo
sleep 0.5

echo "Final status check:"
curl -sS "$BASE_URL/api/signals/status"
echo
