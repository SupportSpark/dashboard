# Which features are gated, and where the gate actually lives

Verified in the live UI at the deployment on 2026-10-12 (logged in as the
operator), together with the code path in this dashboard and probes against the
running management server.

## The gate is in the DASHBOARD, not the server

This is the important finding. `Settings → Authentication` shows the peer approval
card greyed out with a **需要 Enterprise 许可证** badge, which looks like a server
refusal. It is not.

The decision is made client-side, in three steps:

1. `AuthenticationTab.tsx:253` wraps the control in
   `<LockedFeatureBadge feature={"DEVICE_APPROVALS"}>`.
2. `LockedFeatureBadge.tsx:32` asks `useIsFeatureLocked(feature)`.
3. `useIsFeatureLocked.tsx:54-57`:
   ```ts
   if (!isNetBirdCloud()) {
     if (OPEN_SOURCE_FEATURES.includes(feature)) return false;
     return !isLicensed;
   }
   ```
   So on a **self-hosted** deployment a feature is locked purely because
   `isLicensed` is false — nothing was asked of the server.

`useIsLicensed.tsx` decides that flag by probing `/integrations/event-streaming`
and treating **404 as "not licensed"** (401/403/405 would mean the endpoint exists,
i.e. a licensed build). Measured against the running server:

```
/integrations/event-streaming      -> 404
/api/integrations/event-streaming  -> 404
/api/integrations/edr              -> 404
/api/integrations/mdm              -> 404
/api/integrations/scim             -> 404
/api/events/stream                 -> 404
/api/integrations/idp-sync         -> 404
/api/integrations/sso              -> 404
--- control (these exist and answer 401 unauthenticated) ---
/api/peers                         -> 401
/api/policies                      -> 401
/api/posture-checks                -> 401
/api/definitely-not-a-real-endpoint-> 404
```

## What each gate actually reflects

| Feature (PlanFeatures) | Locked on self-hosted? | Does the community server serve it? | Notes |
| --- | --- | --- | --- |
| `POSTURE_CHECKS` | **No** — explicitly whitelisted | **Yes** — `/api/posture-checks` returns 401 (exists) | `OPEN_SOURCE_FEATURES` in `useIsFeatureLocked.tsx:35` |
| `DEVICE_APPROVALS` (peer approval) | Yes — badge shown | **Server supports it** (`PeerApprovalEnabled` is in the OSS code and in the deployed binary); the endpoint just isn't the one probed | The lock does **not** come from the server refusing anything |
| `TRAFFIC_EVENTS` | Yes | No — no server-side flow store; `/api/events/stream` is 404 | Genuinely commercial |
| `EVENT_STREAMING` | Yes | No — 404, and it is the probe endpoint itself | Genuinely commercial |
| `EDR` | Yes | No — 404 | Genuinely commercial |
| `IDP_SYNC` | Yes | No — 404 | Genuinely commercial |
| `MSP` | Yes | Cloud-only concept | Not applicable self-hosted |

## The supported way to declare a licensed deployment

`useIsLicensed` reads two things before probing:

* `hasLicensedFlag()` → `config.licensed || isNetBirdCloud()` (`utils/netbird.ts:78`)
* `config.licensed` comes from `configJson?.licensed === "true"` (`utils/config.ts:92`)

So `NETBIRD_LICENSED=true` is a **first-class deployment flag**, documented in the
code as the way a licensed deployment declares itself
(`netbird.ts:76`: "license via NETBIRD_LICENSED"). It short-circuits the probe and
is cached in `localStorage` under `netbird-licensed:`.

## Conclusion for the request

Of the features the docs list as commercial:

* **Posture checks** — already unlocked, no license, no change needed.
* **Peer approval** — the *server already implements it*; only the dashboard's
  license probe hides it. This is therefore a dashboard-configuration question,
  not a matter of obtaining enterprise code.
* **Traffic events, event streaming, EDR/MDM integrations, SCIM** — genuinely
  absent from the open source server (probed: all 404) and shipped only in the
  private `-cloud` images, which are not publicly pullable.

Worth stating plainly: setting `NETBIRD_LICENSED=true` makes the dashboard *hide
the badge*; it does not add a server capability that is missing. For the features
whose endpoints are 404 it would only reveal controls that cannot work. It is a
legitimate deployment flag for a genuinely licensed install, not a way to create
features.
