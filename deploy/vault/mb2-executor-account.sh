#!/usr/bin/env bash
# Review this file and the associated runbook before running it with sudo on MB2.
set -euo pipefail
umask 077
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH LC_ALL=C

account=harness-vault
home=/Users/harness-vault
state=/var/db/org.harness.vault-executor
users=/Users/$account
groups=/Groups/$account
socket=$home/run/docker.sock
docker=/Applications/Docker.app/Contents/Resources/bin/docker
context=harness-vault

fail() { printf '%s\n' "$*" >&2; exit 1; }

verify_host() {
  [ "$(uname -s)" = Darwin ] || fail 'This script requires macOS.'
  [ "$(scutil --get LocalHostName)" = Daniels-MacBook-Pro ] || fail 'This script is pinned to MB2 (Daniels-MacBook-Pro).'
}

record_absent() {
  ! dscl . -read "$1" >/dev/null 2>&1 || fail "Directory Services record already exists: $1"
}

path_absent() {
  [ ! -e "$1" ] && [ ! -L "$1" ] || fail "Path already exists: $1"
}

available_id() {
  used=$({ dscl . -list /Users UniqueID && dscl . -list /Groups PrimaryGroupID; }) || fail 'Could not enumerate local account IDs.'
  for number in $(jot 51 550 600); do
    if ! printf '%s\n' "$used" | awk -v n="$number" '$NF == n { found=1 } END { exit !found }'; then
      printf '%s\n' "$number"
      return
    fi
  done
  fail 'No free local UID/GID in the reserved search range 550–600.'
}

as_executor() {
  sudo -n -u "$account" -- /usr/bin/env -i HOME="$home" PATH="$PATH" "$@"
}

provision() {
  [ -x "$docker" ] || fail 'The Docker Desktop CLI is missing from Applications.'
  path_absent "$home"
  path_absent "$state"
  record_absent "$users"
  record_absent "$groups"
  uid=$(available_id)
  mkdir -m 700 "$state"
  printf '%s\n' "$uid" > "$state/uid"
  trap 'printf "%s\n" "Provisioning stopped. Review the root-owned journal at $state before retrying." >&2' HUP INT TERM EXIT
  dscl . -create "$groups"
  dscl . -create "$groups" RealName 'Harness Vault Executor'
  dscl . -create "$groups" PrimaryGroupID "$uid"
  dscl . -create "$users"
  dscl . -create "$users" UniqueID "$uid"
  dscl . -create "$users" PrimaryGroupID "$uid"
  dscl . -create "$users" RealName 'Harness Vault Executor'
  dscl . -create "$users" UserShell /usr/bin/false
  dscl . -create "$users" NFSHomeDirectory "$home"
  dscl . -create "$users" IsHidden 1
  dscl . -create "$users" Password '*'
  install -d -m 700 -o "$uid" -g "$uid" "$home" "$home/.docker" "$home/run"
  as_executor "$docker" --config "$home/.docker" context create "$context" --docker "host=unix://$socket"
  verify_account "$uid"
  as_executor "$docker" --config "$home/.docker" context inspect "$context" \
    --format '{{.Endpoints.docker.Host}}' | grep -Fx "unix://$socket" >/dev/null
  touch "$state/provisioned"
  trap - HUP INT TERM EXIT
  printf '%s\n' 'Created harness-vault and its private Docker context metadata.' \
    'The isolated Docker engine still needs to provide the account-owned socket before use.'
}

verify_account() {
  saved_uid=$1
  [ "$(id -u "$account")" = "$saved_uid" ] || fail 'Executor UID does not match the journal.'
  [ "$(id -g "$account")" = "$saved_uid" ] || fail 'Executor GID does not match the journal.'
  dscl . -read "$users" UserShell | grep -Fx 'UserShell: /usr/bin/false' >/dev/null
  dscl . -read "$users" NFSHomeDirectory | grep -Fx "NFSHomeDirectory: $home" >/dev/null
  dsmemberutil checkmembership -U "$account" -G admin | grep -F 'is not a member' >/dev/null
  ! sudo -n -l -U "$account" >/dev/null 2>&1 || fail 'The executor is eligible for sudo.'
  [ -d "$home" ] && [ ! -L "$home" ] || fail 'Executor home changed.'
  [ "$(stat -f '%u:%g:%Lp' "$home")" = "$saved_uid:$saved_uid:700" ] || fail 'Executor home permissions changed.'
}

undo() {
  [ -f "$state/provisioned" ] && [ ! -L "$state" ] || fail 'No completed provisioning journal found.'
  uid=$(cat "$state/uid")
  case "$uid" in 5[5-9][0-9]|600) ;; *) fail 'Invalid UID in the provisioning journal.' ;; esac
  verify_account "$uid"
  path_absent "$socket"
  ! pgrep -u "$uid" >/dev/null || fail 'Stop the isolated executor and its Docker engine before undo.'
  path_absent "$state/retained-home"
  mv "$home" "$state/retained-home"
  dscl . -delete "$users"
  dscl . -delete "$groups"
  record_absent "$users"
  record_absent "$groups"
  mv "$state/provisioned" "$state/undone"
  printf '%s\n' "Removed the executor account and group. Its home is retained in $state/retained-home for inspection."
}

[ "$#" -eq 1 ] || fail 'Usage: mb2-executor-account.sh plan|provision|undo'
verify_host
case "$1" in
  plan) printf '%s\n' "Create $account with a dedicated local UID/GID, shell /usr/bin/false, private home $home and context $context pointing to $socket." \
          "Undo removes both Directory Services records and relocates the private home under $state." ;;
  provision) [ "$(id -u)" = 0 ] || fail 'Provision requires sudo on MB2.'; provision ;;
  undo) [ "$(id -u)" = 0 ] || fail 'Undo requires sudo on MB2.'; undo ;;
  *) fail 'Usage: mb2-executor-account.sh plan|provision|undo' ;;
esac
