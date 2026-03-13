#!/bin/bash

# Quick test: send a sample hook event to verify the pipeline works

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/opsboard-claude-hook.js"

echo "Testing OpsBoard hook pipeline..."
echo ""

# Simulate a PreToolUse event
echo "1. Simulating PreToolUse (Bash)..."
echo '{
  "event": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "npm run typecheck"},
  "cwd": "/Users/wembleyadmin/opsboard",
  "session_id": "test-session-001"
}' | node "$HOOK_SCRIPT"
echo "   Done."

sleep 1

# Simulate a Stop event
echo "2. Simulating Stop (success)..."
echo '{
  "event": "Stop",
  "exit_code": 0,
  "cwd": "/Users/wembleyadmin/opsboard",
  "session_id": "test-session-001"
}' | node "$HOOK_SCRIPT"
echo "   Done."

echo ""
echo "Check OpsBoard at http://localhost:3002"
echo "Look for new signals in Approvals and Signal modules."
