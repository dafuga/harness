#!/bin/bash
# Recover the dedicated synthetic executor created by the journaled MB2 setup.
set -euo pipefail
umask 077
export PATH=/usr/bin:/bin:/usr/sbin:/sbin LC_ALL=C

account=harness-vault
executor_home=/Users/harness-vault
journal=/var/db/org.harness.vault-executor
colima=/opt/homebrew/bin/colima
docker=/opt/homebrew/bin/docker
socket=$executor_home/.colima/$account/docker.sock

fail() { printf '%s\n' "$*" >&2; exit 1; }

verify_host() {
  [ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] &&
    [ "$(scutil --get LocalHostName)" = Daniels-MacBook-Pro ] ||
    fail 'Run this on MB2 (Daniels-MacBook-Pro).'
}

verify_receipt() {
  [ ! -L "$journal" ] && [ "$(stat -f '%u:%g:%Lp' "$journal")" = 0:0:711 ] ||
    fail 'The MB2 executor setup journal is missing or has changed.'
  [ ! -L "$journal/status" ] && [ "$(stat -f '%u:%g:%Lp' "$journal/status")" = 0:0:644 ] &&
    [ "$(cat "$journal/status")" = synthetic-checked ] ||
    fail 'The journal does not report a completed synthetic qualification.'
}

verify_identity() {
  local user_uuid group_uuid
  [ ! -L "$journal/identity" ] && [ "$(stat -f '%u:%g:%Lp' "$journal/identity")" = 0:0:600 ] ||
    fail 'The journal identity file is missing or has changed.'
  { IFS= read -r uid; IFS= read -r user_uuid; IFS= read -r group_uuid; } < "$journal/identity"
  case "$uid" in 5[5-9][0-9]|600) ;; *) fail 'The journal does not identify a dedicated UID.' ;; esac
  [ "$(id -u "$account"):$(id -g "$account")" = "$uid:$uid" ] || fail 'Executor UID or GID changed.'
  dscl . -read "/Users/$account" GeneratedUID | grep -Fx "GeneratedUID: $user_uuid" >/dev/null
  dscl . -read "/Groups/$account" GeneratedUID | grep -Fx "GeneratedUID: $group_uuid" >/dev/null
  dscl . -read "/Users/$account" UserShell | grep -Fx 'UserShell: /usr/bin/false' >/dev/null
  [ ! -L "$executor_home" ] && [ "$(stat -f '%u:%g:%Lp' "$executor_home")" = "$uid:$uid:700" ] ||
    fail 'The executor home is missing or has changed.'
}

as_executor() {
  sudo -n -H -u "$account" -- /usr/bin/env -i HOME="$executor_home" USER="$account" LOGNAME="$account" \
    DOCKER_CONFIG="$executor_home/.docker" TMPDIR=/tmp LC_ALL=C \
    PATH=/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin "$@"
}

verify_context() {
  local endpoint
  endpoint=$(as_executor "$docker" context inspect "$account" --format '{{.Endpoints.docker.Host}}')
  [ "$endpoint" = "unix://$socket" ] || fail 'The Docker context points to an unexpected socket.'
}

status() {
  if pgrep -u "$account" -x colima >/dev/null || pgrep -u "$account" -x limactl >/dev/null; then
    printf '%s\n' 'The dedicated executor has a Colima or Lima process. Verify its private Docker socket as root.'
  else
    printf '%s\n' 'No Colima or Lima process is running under the dedicated executor.'
    return 2
  fi
}

start() {
  verify_context
  as_executor "$colima" start "$account" --runtime docker --vm-type vz \
    --cpus 2 --memory 4 --disk 12 --mount none --mount-inotify=false \
    --ssh-config=false --activate=false --template=false
  as_executor /bin/test -S "$socket" || fail 'The executor Docker socket did not appear.'
  [ "$(as_executor stat -f '%u' "$socket")" = "$uid" ] || fail 'The Docker socket is owned by another user.'
  as_executor "$docker" --context "$account" version --format '{{.Server.Version}}' >/dev/null
  printf '%s\n' 'The dedicated executor can reach its Docker engine.'
}

[ "$#" -eq 1 ] || fail 'Usage: mb2-executor-engine.sh status|start|stop'
verify_host
verify_receipt
case "$1" in
  status) status ;;
  start|stop)
    [ "$(id -u)" = 0 ] || fail 'Start and stop require sudo on MB2.'
    cd /
    verify_identity
    if [ "$1" = start ]; then start; else as_executor "$colima" stop "$account"; fi
    ;;
  *) fail 'Usage: mb2-executor-engine.sh status|start|stop' ;;
esac
