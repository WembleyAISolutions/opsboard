# Enabling ChatGPT Direct Signal Emission

When you are ready for ChatGPT to POST signals automatically,
expose OpsBoard to the internet using a tunnel.

## Option A — Cloudflare Tunnel (free, no account needed)

```bash
# Install once
brew install cloudflared

# Run tunnel (do this when OpsBoard is running)
cloudflared tunnel --url http://localhost:3002
```

Copy the generated URL (e.g. https://abc123.trycloudflare.com)

## Option B — ngrok (free tier)

```bash
# Install once
brew install ngrok

# Run tunnel
ngrok http 3002
```

Copy the Forwarding URL (e.g. https://abc123.ngrok-free.app)

## Wiring to Custom GPT

1. Open your Home AI Custom GPT in ChatGPT
2. Go to Configure → Actions → Create new action
3. Paste the contents of scripts/chatgpt-action-schema.json
4. Replace REPLACE_WITH_YOUR_OPSBOARD_URL with your tunnel URL
5. Save

ChatGPT will now POST signals directly to OpsBoard
whenever Home AI identifies items needing your attention.

## Important

The tunnel URL changes each session (free tier).
Update the Custom GPT Action URL each time you start a new tunnel.

For a permanent URL: deploy OpsBoard to Vercel (free tier).
Your custom domain or vercel.app URL never changes.
