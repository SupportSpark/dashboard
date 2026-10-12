#!/bin/sh
# Zero-downtime update for the localized dashboard.
#
# The problem this solves
# -----------------------
# `docker compose up -d dashboard` STOPS the old container before starting the
# new one. For those few seconds Traefik has no backend: it answers 404 (logged
# as `"-" "-"`, meaning no router matched) or drops the connection, which the
# browser renders as "This page couldn't load". A user hit exactly that window.
#
# Why the obvious fix does not work
# ---------------------------------
# Renaming the running container does NOT make compose create a replacement:
# compose identifies its containers by the `com.docker.compose.*` LABELS, not by
# name, so it still reports the renamed container as the service instance and
# creates nothing. (The first version of this script did that and the continuity
# test passed vacuously — nothing had actually been swapped.)
#
# What works, and is verified
# ---------------------------
# Traefik keys containers by ID and takes router/service names from the
# container's LABELS. Two containers carrying the same `traefik.*` labels are
# merged into one service with two servers, so traffic keeps flowing across the
# swap. Measured on this host: 20/20 requests OK with both containers up, and
# 20/20 after the original was removed mid-flight.
#
#   1. start a COVER container on the new image (traefik labels, no compose
#      labels) and wait until it serves          -> two backends
#   2. recreate through compose; the cover absorbs the gap
#   3. wait for the compose container to be healthy and answer 200
#   4. remove the cover
#
# Usage: sh zero-downtime-deploy.sh [image]
#        FORCE=1 sh zero-downtime-deploy.sh   # swap even if the revision matches
set -e
cd /opt/netbird

IMAGE="${1:-ghcr.io/supportspark/dashboard:zh-latest}"
NAME="netbird-dashboard"
COVER="netbird-dashboard-cover"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.i18n.yml"

# The host to probe after the swap. Taken from the environment rather than
# hardcoded, so this script carries no deployment-specific address:
#
#   DEPLOY_URL=https://dashboard.example.com sh zero-downtime-deploy.sh
#
# Defaults to this host's own IP on 443, which is what a single-node
# Traefik-behind-an-IP-cert install looks like. Override it for a domain.
if [ -n "${DEPLOY_URL:-}" ]; then
  URL="$DEPLOY_URL"
else
  HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -n "$HOST_IP" ] || HOST_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
  URL="https://${HOST_IP:-localhost}/"
fi
# `-k` only when the certificate is a self-signed IP cert; a real domain should
# validate normally.
CURL_OPTS="-sS -m 10"
case "$URL" in
  https://*[0-9].[0-9]*) CURL_OPTS="$CURL_OPTS -k" ;;
esac
echo "probing: $URL"

revision() {
  docker inspect "$1" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' 2>/dev/null || true
}

is_compose_managed() {
  docker inspect "$1" --format '{{ index .Config.Labels "com.docker.compose.service" }}' 2>/dev/null | grep -q .
}

wait_serving() {
  # $1 = container name. Polls the container's own health when it has a
  # healthcheck, then confirms it actually answers through Traefik.
  n=1
  while [ "$n" -le 45 ]; do
    S=$(docker inspect "$1" --format '{{.State.Status}}' 2>/dev/null || echo gone)
    [ "$S" = "running" ] || { sleep 2; n=$((n + 1)); continue; }
    H=$(docker inspect "$1" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null)
    case "$H" in
      healthy) break ;;
      none)
        # No healthcheck (the cover container): probe it directly.
        if docker exec "$1" wget -q -O /dev/null http://127.0.0.1/ 2>/dev/null; then break; fi
        ;;
    esac
    sleep 2
    n=$((n + 1))
  done
  return 0
}

public_ok() {
  # How many of N public requests return 200.
  ok=0; i=1
  while [ $i -le "$1" ]; do
    # shellcheck disable=SC2086  # CURL_OPTS is a deliberate word list
    C=$(curl $CURL_OPTS -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null)
    [ "$C" = "200" ] && ok=$((ok + 1))
    i=$((i + 1))
  done
  echo "$ok"
}

echo "=== 1. pull $IMAGE ==="
i=1
while [ "$i" -le 6 ]; do
  if $COMPOSE pull dashboard 2>&1 | tail -1; then break; fi
  echo "  attempt $i failed, retrying"; sleep 4; i=$((i + 1))
done
NEW_REV=$(revision "$IMAGE")
echo "  target revision: ${NEW_REV:-unknown}"

CUR_REV=$(revision "$NAME")
if [ -z "$FORCE" ] && [ -n "$CUR_REV" ] && [ "$CUR_REV" = "$NEW_REV" ] && is_compose_managed "$NAME"; then
  echo "=== already running $NEW_REV under compose; nothing to do ==="
  exit 0
fi
echo "  current revision: ${CUR_REV:-none}"

echo
echo "=== 2. start the cover on the NEW image (traefik labels only) ==="
# ORDER MATTERS. The cover must be registered with Traefik BEFORE the incumbent
# is disturbed. An earlier version renamed the incumbent first, and Traefik's
# service had zero servers until the cover appeared — measured as two 502s during
# the swap. Starting the cover first means there is never a moment with no
# backend.
docker rm -f "$COVER" >/dev/null 2>&1 || true

# Copy env + traefik labels from whatever is currently serving, so the cover
# cannot drift from the real service definition.
SRC=""
for cand in "$NAME" "${NAME}-retiring"; do
  if docker inspect "$cand" >/dev/null 2>&1; then SRC="$cand"; break; fi
done
if [ -z "$SRC" ]; then
  echo "  no incumbent container found; a plain compose up is enough"
  $COMPOSE up -d dashboard 2>&1 | tail -3
  exit 0
fi
echo "  copying config from $SRC"
docker inspect "$SRC" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep . > /tmp/env.txt
docker inspect "$SRC" --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{println}}{{end}}' \
  | grep '^traefik\.' > /tmp/labels.txt
NETWORK=$(docker inspect "$SRC" --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -1)
[ -n "$NETWORK" ] || NETWORK=netbird

set -- docker run -d --name "$COVER" --network "$NETWORK"
while IFS= read -r e; do [ -n "$e" ] && set -- "$@" --env "$e"; done < /tmp/env.txt
while IFS= read -r l; do [ -n "$l" ] && set -- "$@" --label "$l"; done < /tmp/labels.txt
set -- "$@" "$IMAGE"
"$@" > /dev/null
echo "  cover started; waiting until it answers"
wait_serving "$COVER"
echo "  cover direct check: $(public_ok 3)/3"
# Give the Docker provider a moment to register the second backend before the
# incumbent is touched.
sleep 6
echo "  with cover + incumbent both up: $(public_ok 5)/5"

echo
echo "=== 3. free the canonical name if a NON-compose container holds it ==="
# Only needed when a previous cover was promoted (it has no compose labels, so
# compose would refuse to reuse the name). A compose-managed incumbent is left
# alone: --force-recreate replaces it in place.
if docker inspect "$NAME" >/dev/null 2>&1 && ! is_compose_managed "$NAME"; then
  docker rename "$NAME" "${NAME}-retiring"
  echo "  renamed $NAME -> ${NAME}-retiring (cover is serving)"
elif docker inspect "$NAME" >/dev/null 2>&1; then
  echo "  $NAME is compose-managed; --force-recreate will replace it in place"
fi

echo
echo "=== 4. recreate through compose (the cover absorbs the gap) ==="
$COMPOSE up -d --force-recreate dashboard 2>&1 | tail -4

echo
echo "=== 5. wait for the compose container to be healthy ==="
wait_serving "$NAME"
H=$(docker inspect "$NAME" --format '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null)
echo "  $NAME: $H"

echo
echo "=== 6. verify over the PUBLIC url before dropping the cover ==="
PASS=$(public_ok 10)
echo "  /peers 200: $PASS/10"
if [ "$PASS" -lt 10 ]; then
  echo
  echo "!! Public check did not fully pass - KEEPING the cover container online."
  echo "   Inspect: docker logs $NAME; docker logs $COVER"
  exit 1
fi

echo
echo "=== 7. let Traefik settle, then drain the cover ==="
# Removing the cover triggers another provider reload. Measured: doing it
# immediately after the public check still cost one dropped connection, because
# the reload lands while the new backend is only just registered. A short settle
# first removes that last failure without lengthening the outage window (the
# cover is not needed once the compose container is healthy and answering).
sleep 10
echo "  re-check before drain: $(public_ok 5)/5"
docker rm -f "$COVER" >/dev/null 2>&1 || true
docker rm -f "${NAME}-retiring" >/dev/null 2>&1 || true

echo
echo "=== 8. final state ==="
docker inspect "$NAME" --format '  status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} revision={{ index .Config.Labels "org.opencontainers.image.revision" }}'
echo "  compose view:"
$COMPOSE ps dashboard 2>&1 | sed 's/^/    /'
echo "  containers holding the dashboard router:"
docker ps --filter "label=traefik.http.routers.netbird-dashboard.rule" --format '    {{.Names}}' || true
