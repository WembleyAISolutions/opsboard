# Signal Producer Protocol

WembleyAISolutions  
OpsBoard Interface Specification

Version: v1.0  
Status: Active

---

## Protocol Status

Signal Producer Protocol v1.0 is active as of OpsBoard v0.4.

All four blocking items from v0.9 have been resolved:

[x] Fix 1: Transport reference implementation  
    - emitSignal() local function + POST /api/signals webhook
[x] Fix 2: Noise guardrails for info / progress  
    - implemented in signal-producer-validator.ts
[x] Fix 3: Complete normalization matrix  
    - exhaustive switch in signal-producer-adapter.ts
[x] Fix 4: signal_id deduplication and rejection  
    - seenIds Set in signal-producer-validator.ts

The protocol is now stable.  
Additive changes follow minor versioning (1.1, 1.2...).  
Breaking changes require a new major version (2.0).

---

For the full protocol specification, see `docs/signal-producer-protocol.md`.

WeiAI.Solutions
