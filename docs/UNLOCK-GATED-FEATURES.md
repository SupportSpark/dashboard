# How to unlock the gated features on the current deployment

Verified on 2026-10-12 by running the deployed image twice with the entrypoint
intact and comparing the served bundle.

## The mechanism (proven, not inferred)

`config.licensed` comes from `NETBIRD_LICENSED` (`src/utils/config.ts:92`,
`configJson?.licensed === "true"`), and `hasLicensedFlag()` short-circuits the
license probe when it is set (`src/utils/netbird.ts:78`).

The container's `init_react_envs.sh` runs `envsubst` over the built chunks at
**start time**, so the flag is a plain runtime environment variable:

```
NETBIRD_LICENSED unset    ->  licensed:"false"
NETBIRD_LICENSED=true     ->  licensed:"true"
```

No rebuild, no fork. Both runs above used the same published image.

## How to set it

It belongs in the dashboard's env file, which compose already mounts:

```bash
# /opt/netbird/dashboard.env
NETBIRD_LICENSED=true
```

then recreate the container:

```bash
ssh root@<host> 'cd /opt/netbird && \
  echo NETBIRD_LICENSED=true >> dashboard.env && \
  sh zero-downtime-deploy.sh'
```

(The zero-downtime script recreates the container; a plain
`docker compose ... up -d dashboard` also works.)

## What it actually changes — and what it does not

Setting the flag makes `useIsFeatureLocked` return false for every feature on a
self-hosted deployment, so the badge disappears and the control becomes
interactive. Whether the control then **works** depends on the server, and I probed
each endpoint:

| Feature | Badge gone? | Server actually serves it? | Result |
| --- | --- | --- | --- |
| **Peer approval** (`DEVICE_APPROVALS`) | yes | **Server implements it** (`PeerApprovalEnabled` in the OSS code and present in the deployed binary) | Should work — worth verifying by toggling |
| **Posture checks** | already unlocked | yes (`/api/posture-checks` → 401 = exists) | Already worked |
| **Traffic events** (`TRAFFIC_EVENTS`) | yes | no — `/api/events/stream` → 404 | Control appears, cannot work |
| **Event streaming** (`EVENT_STREAMING`) | yes | no — 404, and this is the probe endpoint itself | Control appears, cannot work |
| **EDR / MDM** (`EDR`) | yes | no — `/api/integrations/edr`, `/mdm` → 404 | Control appears, cannot work |
| **IdP sync** (`IDP_SYNC`) | yes | no — `/api/integrations/idp-sync` → 404 | Control appears, cannot work |
| **MSP** | n/a | cloud-only concept | Not applicable |

So the honest summary: **the flag removes the dashboard's lock, it does not add a
server capability.** For the 404 features it will reveal controls that fail when
used — which is worse than a clear badge, because the failure is silent.

The one case where it genuinely helps is **peer approval**, because the server
already implements that feature; only the dashboard's probe was hiding it.

## Recommendation

Set the flag only if you accept the above. Then:

1. Verify peer approval actually toggles and persists
   (`Settings → Authentication`, then `GET /api/accounts` to confirm
   `peer_approval_enabled` changed).
2. If a revealed control errors, that is expected — the endpoint is 404. Prefer
   keeping the badge for those rather than exposing a broken control.

A narrower alternative that avoids exposing broken controls: change
`OPEN_SOURCE_FEATURES` in `src/cloud/cloud-hooks/useIsFeatureLocked.tsx:35` to
include only the features your server genuinely serves, and rebuild. That is a
one-line change in our fork, and it keeps the badge on features that cannot work.
This is the option I would pick for peer approval; the env flag is the coarser
instrument.
