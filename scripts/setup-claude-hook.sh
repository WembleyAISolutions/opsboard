#!/bin/bash

# OpsBoard - Claude Code Hook Setup
# Installs the hook script and wires it to ~/.claude/settings.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/opsboard-claude-hook.js"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
HOOK_COMMAND="node $HOOK_SCRIPT"

echo "OpsBoard Claude Code Hook Setup"
echo "================================"
echo "Hook script: $HOOK_SCRIPT"
echo "Claude settings: $CLAUDE_SETTINGS"
echo ""

# Make hook script executable
chmod +x "$HOOK_SCRIPT"
echo "✓ Hook script permissions set"

# Create ~/.claude directory if it doesn't exist
mkdir -p "$HOME/.claude"

# Check if settings.json exists
if [ ! -f "$CLAUDE_SETTINGS" ]; then
  echo "{}" > "$CLAUDE_SETTINGS"
  echo "✓ Created $CLAUDE_SETTINGS"
fi

# Check if node is available
if ! command -v node &> /dev/null; then
  echo "✗ Error: node is not installed or not in PATH"
  exit 1
fi
echo "✓ Node.js available: $(node --version)"

# Check if OpsBoard is running
if curl -s "http://localhost:3002/api/signals/status" > /dev/null 2>&1; then
  echo "✓ OpsBoard is running at localhost:3002"
else
  echo "⚠ OpsBoard not detected at localhost:3002"
  echo "  Start OpsBoard with: npm run dev"
  echo "  The hook will work once OpsBoard is running"
fi

echo ""
echo "Manual step required:"
echo "─────────────────────"
echo "Add the following hooks to: $CLAUDE_SETTINGS"
echo ""
echo "Hook command to use:"
echo "  $HOOK_COMMAND"
echo ""
echo "Reference template: $SCRIPT_DIR/claude-settings-template.json"
echo ""
echo "Or run this to print the exact JSON to add:"
echo "  cat $SCRIPT_DIR/claude-settings-template.json | sed 's|/ABSOLUTE/PATH/TO/opsboard|$SCRIPT_DIR/..|g'"
echo ""

# Print the ready-to-use settings JSON
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FINAL_COMMAND="node $REPO_ROOT/scripts/opsboard-claude-hook.js"

echo "Ready-to-copy hooks config:"
echo "─────────────────────────────"
cat << EOF
{
  "hooks": {
    "PreToolUse": [{"matcher":"","hooks":[{"type":"command","command":"$FINAL_COMMAND"}]}],
    "PostToolUse": [{"matcher":"","hooks":[{"type":"command","command":"$FINAL_COMMAND"}]}],
    "Stop": [{"matcher":"","hooks":[{"type":"command","command":"$FINAL_COMMAND"}]}],
    "SubagentStop": [{"matcher":"","hooks":[{"type":"command","command":"$FINAL_COMMAND"}]}]
  }
}
EOF

echo ""
echo "Setup complete."
echo "After updating ~/.claude/settings.json, start a Claude Code"
echo "session and OpsBoard will receive signals automatically."
