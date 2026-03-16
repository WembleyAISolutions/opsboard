# OpsBoard v0.8 — Vercel Deployment

## Overview

OpsBoard v0.8 deploys to Vercel to enable remote signal ingestion.

Use case: AI systems (ChatGPT, mobile Shortcuts) that cannot reach
localhost can POST signals to the Vercel URL.

## Deploy

  npm install -g vercel   # install once
  bash scripts/deploy-vercel.sh

## Architecture in v0.8

  Local OpsBoard (localhost:3002)
    - Full persistent UI
    - All engines (Signal · Workflow · Approval · Routing)
    - Claude Code hook → automatic signals
    - Primary operator interface

  Vercel OpsBoard (https://opsboard-xxx.vercel.app)
    - Same codebase, serverless deployment
    - Ephemeral in-memory state (resets on cold start)
    - Public endpoint for ChatGPT and remote AI sources
    - Webhook receiver for external services

## Endpoints available on Vercel

  POST /api/signals              receive signals from ChatGPT, mobile
  POST /api/webhooks/zapier      receive Zapier automation signals
  POST /api/webhooks/github      receive GitHub webhook events
  POST /api/webhooks/apple       receive Apple Dev signals
  GET  /api/signals/status       health check

## State Model (v0.8)

  In-memory only. No persistence.
  Signals received by Vercel are visible in the Vercel instance UI.
  Signals received by localhost are visible in the local UI.
  These instances do not share state.

  This is intentional for v0.8. Persistence is v1.0 scope.

## ChatGPT Custom GPT Action

See: scripts/setup-chatgpt-action.md

## Future

v1.0 will add a persistence layer (likely Vercel KV or Upstash Redis)
so that signals sent to the Vercel URL are also visible in the local UI.
