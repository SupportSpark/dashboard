# Server-side findings: where the "commercial license" actually lives

Investigated on 2026-10-12 while evaluating a request to "open up all the enterprise
commercial-license features so it can run without a license, for internal use".

Everything below is evidence, not inference. It changes the shape of the request:
there may be nothing to "unlock".

## 1. The OSS repository has no license enforcement at all

Searched the complete tree of `netbirdio/netbird` (~3400 files, full checkout):

| Probe | Result |
| --- | --- |
| `NB_LICENSE_KEY` | 2 files — both are **shell scripts** under `infrastructure_files/` |
| `validateLicense` / `licenseValidated` / `license invalidated` in Go | **0 files** |
| `LicenseManager` / `isLicensed` / `licensedFeature` | **0 files** |
| `FeatureFlag` / `isEnterprise` / `Edition` | **0 files** |
| build tags separating editions | none (only `integration`/`benchmark`/`ignore` test tags) |

The two shell scripts (`getting-started-enterprise.sh`, `migrate-to-enterprise.sh`)
do not enforce anything themselves. They write `NB_LICENSE_KEY` into `.env` and
then *wait and grep the server logs* for `"license validated"` or
`"license invalidated"` — strings that **do not exist anywhere in this repository**.
So the validation happens inside a binary this repo does not build.

## 2. The commercial build is a DIFFERENT IMAGE SET

From `getting-started-enterprise.sh` (the enterprise compose):

| Role | Community | Enterprise |
| --- | --- | --- |
| server | `netbirdio/netbird-server` | `ghcr.io/netbirdio/netbird-server-cloud` |
| dashboard | `netbirdio/dashboard` | `ghcr.io/netbirdio/dashboard-cloud` |
| enrich/receive | — | `flow-enricher-cloud`, `flow-receiver-cloud` |
| also | traefik, nginx | NATS, PostgreSQL 17, reverse-proxy, CrowdSec |

Checked from the deployment host:

```
ghcr.io/netbirdio/netbird-server-cloud   -> PRIVATE or absent
ghcr.io/netbirdio/dashboard-cloud        -> PRIVATE or absent
ghcr.io/netbirdio/flow-enricher-cloud    -> PRIVATE or absent
```

These images are **not publicly pullable**. The license key gates access to the
image registry, not a code path — which is why there is no flag to flip.

## 3. Licensing

`LICENSE` (root) says the BSD-3-Clause applies to everything **except**
`management/`, `signal/`, `relay/`, `combined/`, which are **AGPLv3**. Confirmed by
reading each directory's own LICENSE file.

The commercial components are in the `-cloud` images, which are not in this repo,
so their terms are whatever the EULA in `getting-started-enterprise.sh` states —
it prints the "NetBird On-Premise End User License Agreement" and requires
acceptance before installing.

## 4. What this means for the request

"Forcibly enabling enterprise features without a license" does not describe
something available in the open source code. The features the docs list as
commercial (HA, SCIM, EDR/MDM integrations, traffic-flow logging, peer approval,
audit streaming) are either:

  * **shipped only in the private `-cloud` images** (so there is no local code to
    patch — you would need the image), or
  * **already present in the OSS build with no gate**, in which case nothing needs
    unlocking.

Probes in the OSS repo, for reference:

| Feature | Go files in OSS |
| --- | --- |
| posture checks | 87 |
| traffic events | 50 |
| peer approval | 39 |
| audit events | 13 |
| SCIM | 0 |
| PostgreSQL store (the HA prerequisite) | present (`management/internals/shared/db`) |

So several of these may well work in the community build already. That is worth
**testing** rather than assuming the docs' table is exhaustive.

## 5. Current deployment (for reference)

```
netbird-dashboard  ghcr.io/supportspark/dashboard:zh-latest   (our fork)
netbird-server     netbirdio/netbird-server:0.80.0            (community)
netbird-acme       nginx:1.27-alpine
netbird-traefik    traefik:v3.6
```
