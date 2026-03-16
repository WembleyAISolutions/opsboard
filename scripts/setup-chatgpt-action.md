# Setting Up ChatGPT Custom GPT Action for OpsBoard

## Prerequisites
- OpsBoard deployed to Vercel (run: bash scripts/deploy-vercel.sh)
- A Custom GPT configured as Home AI (or any OpsBoard AI persona)
- Your Vercel URL (e.g. https://opsboard-xxx.vercel.app)

## Step 1: Test your Vercel deployment

curl -s -X POST https://YOUR-VERCEL-URL.vercel.app/api/signals \
  -H 'Content-Type: application/json' \
  -d '{
    "protocol_version": "1.0",
    "signal_id": "test-chatgpt-action-001",
    "source_ai": "HOME_AI",
    "signal_kind": "attention",
    "signal_priority": "normal",
    "human_action_needed": true,
    "title": "ChatGPT Action test signal",
    "summary": "Testing OpsBoard connection from ChatGPT Custom GPT Action.",
    "timestamp": "2026-03-16T10:00:00.000Z"
  }'

Expected response: {"ok":true,"signal_id":"test-chatgpt-action-001"}

## Step 2: Configure the Custom GPT Action

1. Open ChatGPT → Your Custom GPTs → Home AI
2. Click Edit → Configure
3. Scroll to Actions → Create new action
4. Import the schema:
   - Copy the contents of scripts/chatgpt-action-schema.json
   - Remove the "_setup_instructions" key
   - Replace YOUR_VERCEL_URL with your actual Vercel URL
   - Paste into the schema editor
5. Authentication: None (OpsBoard v0.8 is open)
6. Click Save

## Step 3: Add the signal prompt to Home AI

In the Home AI system prompt, add this instruction block:

---
When you identify items that need the operator's attention, approval, or awareness,
emit a signal to OpsBoard using the emitSignal action.

Use these guidelines:
- signal_kind "attention" — something needs review (schedule conflict, reminder)
- signal_kind "approval" — explicit yes/no decision needed (purchase, commitment)
- signal_kind "input" — new item for first look (new email, new task)
- signal_kind "info" — background update, no action needed
- signal_kind "blocked" — cannot proceed without action

source_ai rules:
- Home and family matters → HOME_AI
- Financial items → FINANCE_AI

Always set signal_id as: home-{current_unix_timestamp}-{random4chars}
Always set timestamp as current ISO 8601 datetime.

Only emit signals for genuine items needing attention.
Do not emit signals for routine acknowledgements or conversational responses.
---

## Step 4: Test end-to-end

In your Home AI conversation, say:
  "Remind me that school pickup is at 3pm Friday and I need to confirm with the school."

Home AI should emit a signal. Within 5 seconds it should appear in OpsBoard
(if you have OpsBoard running locally at localhost:3002).

## Note on Vercel + local OpsBoard

Signals sent to your Vercel URL are received by Vercel's in-memory engine.
Signals sent to localhost:3002 are received by your local engine.
These are separate instances — signals do not sync between them in v0.8.

For the full experience: run OpsBoard locally (npm run dev -- --port 3002)
and configure Home AI to POST to localhost:3002/api/signals when you are
at your desk. Use the Vercel URL when you are mobile or away from your Mac.

Future: v1.0 will add a persistence layer so both endpoints share state.

## Vercel deployment URL

After running bash scripts/deploy-vercel.sh, your URL will be something like:
  https://opsboard.vercel.app
  https://opsboard-wembleyadmin.vercel.app
  https://opsboard-git-main-wembleyadmin.vercel.app

The production URL is shown in your Vercel dashboard.
