#!/bin/sh
#
# Hourly image refresh for a self-hosted NetBird stack (Debian + Docker Compose).
#
# What it does, once per run:
#   1. asks upstream for the newest STABLE netbird-server release tag and points
#      the server service at it if that is newer than what docker-compose.yml has
#      (the tag is pinned on purpose, so a digest comparison alone would never
#      notice a new release);
#   2. pulls every image the stack uses, with a hard time limit;
#   3. restarts ONLY the services whose running container is not already the
#      pulled image — a quiet hour therefore changes nothing at all;
#   4. for the dashboard it goes through /opt/netbird/zero-downtime-deploy.sh,
#      which swaps behind a cover container and verifies the result;
#   5. for the server it snapshots the data volume first and rolls the image tag
#      back if the management API does not come back.
#
# Install (see docs/I18N-SYNC.md §7.1):
#   install -m 755 vps-auto-update.sh /usr/local/bin/netbird-auto-update.sh
#   systemctl daemon-reload && systemctl enable --now netbird-auto-update.timer
#
# Exit codes: 0 nothing to do or everything applied, 0 also when a check could
# not run (network), 1 when an update was attempted and failed and was reverted.

set -eu

STACK_DIR=${STACK_DIR:-/opt/netbird}
BASE_COMPOSE="$STACK_DIR/docker-compose.yml"
OVERLAY_COMPOSE="$STACK_DIR/docker-compose.i18n.yml"
ZERO_DOWNTIME="$STACK_DIR/zero-downtime-deploy.sh"
BACKUP_DIR="$STACK_DIR/backups"
LOCK=/var/lock/netbird-auto-update.lock
PULL_TIMEOUT=${PULL_TIMEOUT:-5400}   # seconds; the GHCR link can be slow (90 min)
HEALTH_WAIT=${HEALTH_WAIT:-90}       # seconds to wait for the management API
KEEP_DB_BACKUPS=${KEEP_DB_BACKUPS:-3}

SERVER_SERVICE=netbird-server
DASHBOARD_SERVICE=dashboard
SERVER_IMAGE_PREFIX='netbirdio/netbird-server'

log() { printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
warn() { log "WARN: $*"; }
fail() { log "ERROR: $*"; exit 1; }

# One run at a time. A slow pull must not stack up behind the next hour's timer.
exec 9>"$LOCK" || fail "cannot open $LOCK"
if ! flock -n 9; then
  log "another run is in progress, skipping this hour"
  exit 0
fi

cd "$STACK_DIR" || fail "no $STACK_DIR"

[ -f "$BASE_COMPOSE" ] || fail "missing $BASE_COMPOSE"
COMPOSE_FILES="-f $BASE_COMPOSE"
[ -f "$OVERLAY_COMPOSE" ] && COMPOSE_FILES="$COMPOSE_FILES -f $OVERLAY_COMPOSE"
compose() { docker compose $COMPOSE_FILES "$@"; }

# ---------------------------------------------------------------- helpers ----

# service name -> image reference, straight from compose (no YAML parsing here).
image_of() {
  compose config --format json 2>/dev/null | python3 -c '
import json,sys
name = sys.argv[1]
try:
    svc = json.load(sys.stdin)["services"][name]
except Exception:
    sys.exit(0)
img = svc.get("image")
if img:
    print(img)
' "$1"
}

# Newest stable netbird-server tag, e.g. 0.81.3. Empty when offline / rate-limited.
latest_server_tag() {
  curl -fsS --max-time 25 \
    -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/netbirdio/netbird/releases/latest" 2>/dev/null |
    python3 -c '
import json,re,sys
try:
    rel = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if rel.get("prerelease") or rel.get("draft"):
    sys.exit(0)
tag = rel.get("tag_name", "")
m = re.fullmatch(r"v?(\d+\.\d+\.\d+)", tag)
print(m.group(1) if m else "")
' || true
}

# Is $1 newer than $2 (both plain x.y.z)? 0 = yes.
version_gt() {
  [ -n "$1" ] && [ -n "$2" ] || return 1
  [ "$1" != "$2" ] || return 1
  newest=$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)
  [ "$newest" = "$1" ]
}

container_of() { compose ps -q "$1" 2>/dev/null | head -1; }

# Running container's image id vs the pulled tag's image id.
needs_restart() {
  svc=$1
  img=$2
  cid=$(container_of "$svc")
  [ -n "$cid" ] || return 1
  running=$(docker inspect -f '{{.Image}}' "$cid" 2>/dev/null || echo unknown)
  tagged=$(docker image inspect -f '{{.Id}}' "$img" 2>/dev/null || echo missing)
  [ "$running" != "$tagged" ]
}

api_code() {
  # -w already prints 000 on a connection failure; keep exactly one value so a
  # failed probe can never be mistaken for a healthy one by string concat.
  got=$(curl -sS -k -o /dev/null -m 5 -w '%{http_code}' "https://$HOST_IP/api/users" 2>/dev/null) || got=000
  printf '%s' "${got:-000}"
}

snapshot_data() {
  mkdir -p "$BACKUP_DIR"
  name="$BACKUP_DIR/netbird-data-$1-$(date +%Y%m%d-%H%M%S).tar.gz"
  if docker run --rm -v netbird_netbird_data:/data -v "$BACKUP_DIR:/backup" alpine \
       sh -c "tar czf /backup/$(basename "$name") -C /data ." >/dev/null 2>&1; then
    log "data snapshot: $name ($(du -h "$name" | cut -f1))"
  else
    warn "could not snapshot the data volume; continuing"
    return 1
  fi
  # keep the newest $KEEP_DB_BACKUPS snapshots, drop the rest
  ls -1t "$BACKUP_DIR"/netbird-data-*.tar.gz 2>/dev/null |
    tail -n +$((KEEP_DB_BACKUPS + 1)) |
    while read -r old; do rm -f "$old"; log "pruned old snapshot: $old"; done
}

# ------------------------------------------------------------ the server ----

update_server() {
  compose_files_tag=$1          # tag currently written in docker-compose.yml
  target_tag=$2                 # newest stable tag from upstream

  prev_image=$(image_of "$SERVER_SERVICE")
  [ -n "$prev_image" ] || { warn "cannot resolve the server image"; return 0; }

  if [ "$compose_files_tag" != "$target_tag" ]; then
    log "server: $compose_files_tag -> $target_tag (writing docker-compose.yml)"
    sed -i "s|image: ${SERVER_IMAGE_PREFIX}:.*|image: ${SERVER_IMAGE_PREFIX}:${target_tag}|" "$BASE_COMPOSE"
    grep -q "image: ${SERVER_IMAGE_PREFIX}:${target_tag}" "$BASE_COMPOSE" ||
      { warn "could not rewrite the tag in $BASE_COMPOSE"; return 1; }
  fi

  new_image=$(image_of "$SERVER_SERVICE")
  needs_restart "$SERVER_SERVICE" "$new_image" || { log "server: already running $new_image"; return 0; }

  snapshot_data "pre-$target_tag" || true

  log "server: recreating with $new_image"
  if ! compose up -d --no-deps "$SERVER_SERVICE" >>"$STACK_DIR/auto-update.log" 2>&1; then
    warn "compose up failed for $SERVER_SERVICE"
    revert_server "$compose_files_tag" "$prev_image"
    return 1
  fi

  # Initialise before the loop: with HEALTH_WAIT=0 the loop body never runs and
  # an unset $code under `set -u` would abort before the revert could happen.
  code=000
  waited=0
  while [ "$waited" -lt "$HEALTH_WAIT" ]; do
    sleep 5
    waited=$((waited + 5))
    code=$(api_code)
    if [ "$code" = "401" ] || [ "$code" = "200" ]; then
      log "server: healthy after ${waited}s (api $code) on $target_tag"
      return 0
    fi
  done

  warn "server did not answer the management API within ${HEALTH_WAIT}s (last $code)"
  revert_server "$compose_files_tag" "$prev_image"
  return 1
}

revert_server() {
  old_tag=$1
  old_image=$2
  warn "reverting the server image to $old_image"
  sed -i "s|image: ${SERVER_IMAGE_PREFIX}:.*|image: ${SERVER_IMAGE_PREFIX}:${old_tag}|" "$BASE_COMPOSE"
  compose up -d --no-deps "$SERVER_SERVICE" >>"$STACK_DIR/auto-update.log" 2>&1 || warn "revert recreate failed"
  sleep 10
  code=$(api_code)
  if [ "$code" = "401" ] || [ "$code" = "200" ]; then
    warn "reverted and answering again (api $code)"
  else
    warn "still not answering after revert (api $code) - check 'docker logs $SERVER_SERVICE'"
  fi
}

# --------------------------------------------------------- the dashboard ----

update_dashboard() {
  img=$(image_of "$DASHBOARD_SERVICE")
  [ -n "$img" ] || { warn "cannot resolve the image for service '$DASHBOARD_SERVICE'"; return 0; }
  needs_restart "$DASHBOARD_SERVICE" "$img" || { log "dashboard: already running $img"; return 0; }

  if [ -x "$ZERO_DOWNTIME" ]; then
    log "dashboard: new image for $img - zero-downtime swap"
    if DEPLOY_URL="${DEPLOY_URL:-}" sh "$ZERO_DOWNTIME" >>"$STACK_DIR/auto-update.log" 2>&1; then
      log "dashboard: swap verified OK"
      return 0
    fi
    warn "dashboard: zero-downtime swap failed; see $STACK_DIR/auto-update.log"
    return 1
  fi

  log "dashboard: recreating with $img (no zero-downtime script present)"
  compose up -d --no-deps "$DASHBOARD_SERVICE" >>"$STACK_DIR/auto-update.log" 2>&1 || {
    warn "dashboard: recreate failed"; return 1; }
}

# ------------------------------------------------------- other services -----

update_plain() {
  svc=$1
  img=$(image_of "$svc")
  [ -n "$img" ] || { warn "cannot resolve the image for service '$svc'"; return 0; }
  needs_restart "$svc" "$img" || { log "$svc: already running $img"; return 0; }
  log "$svc: recreating with $img"
  compose up -d --no-deps "$svc" >>"$STACK_DIR/auto-update.log" 2>&1 ||
    { warn "$svc: recreate failed"; return 1; }
}

# ---------------------------------------------------------------- main ------

HOST_IP=${HOST_IP:-}
if [ -z "$HOST_IP" ]; then
  HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
[ -n "${HOST_IP:-}" ] || HOST_IP=127.0.0.1

server_tags() {
  cur=$(grep -oE "image: ${SERVER_IMAGE_PREFIX}:[^ ]+" "$BASE_COMPOSE" | head -1 | sed "s|.*:||")
  printf '%s\n' "${cur:-unknown}"
}

changed=0
failed=0

# 1. resolve the newest stable server release (cheap; skip the whole run offline)
CURRENT_SERVER_TAG=$(server_tags)
LATEST_SERVER_TAG=$(latest_server_tag)
if [ -z "$LATEST_SERVER_TAG" ]; then
  warn "could not resolve the newest netbird-server release (offline or rate-limited); will still refresh pulled images"
else
  log "server tag: local $CURRENT_SERVER_TAG, upstream stable $LATEST_SERVER_TAG"
fi

# 2. pull everything once, bounded in time
log "pulling images (limit ${PULL_TIMEOUT}s)"
if ! timeout "$PULL_TIMEOUT" docker compose $COMPOSE_FILES pull -q >>"$STACK_DIR/auto-update.log" 2>&1; then
  warn "pull did not finish within ${PULL_TIMEOUT}s or failed; nothing will be restarted this hour"
  exit 0
fi

# 3. server: tag bump first, then restart only if the running image differs
if [ -n "$LATEST_SERVER_TAG" ] && version_gt "$LATEST_SERVER_TAG" "$CURRENT_SERVER_TAG"; then
  update_server "$CURRENT_SERVER_TAG" "$LATEST_SERVER_TAG" || failed=1
  changed=1
elif needs_restart "$SERVER_SERVICE" "$(image_of "$SERVER_SERVICE")"; then
  # same tag, but the tag was re-pushed (digest moved)
  update_server "$CURRENT_SERVER_TAG" "$CURRENT_SERVER_TAG" || failed=1
  changed=1
else
  log "server: up to date ($(image_of "$SERVER_SERVICE"))"
fi

# 4. dashboard (our zh image) and the proxy sidecars
#    NOTE: these are COMPOSE SERVICE names (traefik, acme), not container names
#    (netbird-traefik, netbird-acme) - the container name is only the runtime
#    label and compose does not accept it here.
update_dashboard || failed=1
update_plain traefik || failed=1
update_plain acme || failed=1

# 5. dashboard/traefik changes are covered by the logs above; summarise
if [ "$failed" -ne 0 ]; then
  fail "one or more services failed to update - see $STACK_DIR/auto-update.log"
fi
log "done"
