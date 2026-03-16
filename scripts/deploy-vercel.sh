#!/bin/bash
set -e

echo "OpsBoard v0.8 — Vercel Deployment"
echo "=================================="

# Check Vercel CLI
if ! command -v vercel &> /dev/null; then
  echo ""
  echo "Vercel CLI not installed."
  echo "Install with: npm install -g vercel"
  echo "Then run this script again."
  exit 1
fi

echo "✓ Vercel CLI available: $(vercel --version)"

# Deploy
echo ""
echo "Deploying to Vercel..."
echo "If prompted for project setup, accept all defaults."
echo ""

vercel --prod

echo ""
echo "=================================="
echo "Deployment complete."
echo ""
echo "Next steps:"
echo "1. Copy your Vercel URL (e.g. https://opsboard-xxx.vercel.app)"
echo "2. Test signal ingestion:"
echo "   curl -s -X POST https://YOUR-URL.vercel.app/api/signals \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"protocol_version\":\"1.0\",\"signal_id\":\"test-vercel-001\","
echo "          \"source_ai\":\"HOME_AI\",\"signal_kind\":\"attention\","
echo "          \"signal_priority\":\"normal\",\"human_action_needed\":true,"
echo "          \"title\":\"Vercel test signal\","
echo "          \"summary\":\"OpsBoard is reachable from the internet.\","
echo "          \"timestamp\":\"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\"}'  "
echo ""
echo "3. Read: scripts/setup-chatgpt-action.md"
