# Community vs. commercial: what actually works without a license

Bottom line: the official comparison table is **not** an accurate description of
what the open source build can do. Several features it lists as commercial-only
have complete implementations in the open source repository, and some are already
exposed in our dashboard.

All of the below was verified against source (`netbirdio/netbird` @ `8c70f9e`,
2026-10-12) and, where noted, against the deployed `netbird-server:0.80.0` binary
and the live API docs — not taken from the docs' feature table.

## Available in the community build (verified implementations)

| Capability | Evidence |
| --- | --- |
| **Peer approval** | `types/settings.go:165` defines `PeerApprovalEnabled` with real semantics; `account.go:368` implements the full path (disabling it retroactively approves every pending peer via `ApproveAccountPeers`, bumping the peer update); `store/sql_store_account.go` persists it; activity codes cover it. Documented as `peer_approval_enabled` in the official API reference (4 hits), and the struct name is present in the deployed binary. |
| **User approval** | `UserApprovalRequired` + `POST /users/{userId}/approve`, `/reject`, `/invite` routes; `permissions/manager.go:60-65` blocks pending users. |
| **Posture checks** | 87 Go files; full CRUD at `/api/posture-checks`. |
| **Audit events** | `GET /api/events/audit` + `activity/store` (7 files, SQL-backed). |
| **PostgreSQL store** | `management/internals/shared/db` (5 files) supports the pgsql engine — the prerequisite the docs attach to HA. |
| **Temporary access** | `/peers/{peerId}/temporary-access`. |
| **Networks / routes / policies / groups / users / setup keys / DNS** | Full CRUD route set (see the route inventory below). |

Already reachable in our dashboard: **Settings → Authentication** has the peer
approval toggle. `AuthenticationTab.tsx:84` reads
`account?.settings?.extra?.peer_approval_enabled` and writes it back at :173. So
this one needs no work at all — you can switch it on today.

## Not in the open source repository (0 implementations — not merely gated)

| Capability | Evidence |
| --- | --- |
| **SCIM provisioning** | **0** Go files contain `scim`. |
| **EDR / MDM integrations** (CrowdStrike, SentinelOne, Intune, FleetDM, Huntress) | **0** Go files. |
| **Traffic-flow event storage** | **0** server-side stores; only client-side netflow reporting (`client/internal/netflow`). |
| **High availability / clustering** | No coordinator (2 incidental mentions). |

These cannot be obtained by patching the open source code, because the code is not
there. They ship in `ghcr.io/netbirdio/netbird-server-cloud` and
`ghcr.io/netbirdio/dashboard-cloud`, which were checked from the deployment host
and are **not publicly pullable**. The license key gates registry access, not a
code path — which is why there is no flag to flip.

## The route inventory the community server serves

```
/accounts  /accounts/{accountId}            /api/accounts  /api/accounts/{accountId}
/api/dns/nameservers  /api/dns/nameservers/{nsgroupId}  /api/dns/settings
/api/events/  /events  /events/audit
/api/groups  /api/groups/{groupId}
/api/identity-providers  /api/identity-providers/{idpId}
/api/locations/countries  /api/locations/countries/{country}/cities
/api/peers/{peerId}  /api/peers/{peerId}/accessible-peers
/api/policies  /api/posture-checks  /api/routes  /api/setup-keys
/api/users/{userId}  /api/users/{userId}/tokens
/instance  /instance/version
/networks  /networks/{networkId}  /networks/{networkId}/resources
/networks/{networkId}/routers  /networks/resources  /networks/routers
/peers/{peerId}/jobs  /peers/{peerId}/temporary-access
/users/{userId}/approve  /users/{userId}/reject  /users/{userId}/invite
/users/{userId}/password  /users/current  /users/invites  /users/invites/{inviteId}
```

## Licensing (for reference)

Root `LICENSE`: BSD-3-Clause for everything **except** `management/`, `signal/`,
`relay/`, `combined/`, which are **AGPLv3** (each directory carries its own LICENSE
file, confirmed by reading them). Forking and self-hosting for internal use is
permitted; AGPL's network-service clause obliges you to offer the modified source
to users of that service, which internal-only use does not trigger.

## What this means practically

1. **Try before assuming.** At least peer approval, user approval, posture checks
   and audit events should work on your existing server. Check the dashboard for
   each before planning any fork.
2. **SCIM and EDR/MDM genuinely need the commercial images.** If those are the
   goal, the realistic routes are the official 30-day proof of concept, or
   implementing the integration yourself against the open API.
3. **A server fork is not required for translation work.** The dashboard carries
   the localization; the server's own auth pages are embedded in its binary (see
   the earlier probe: no template directory to mount).
