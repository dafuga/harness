#!/bin/bash
set -euo pipefail

state=/var/lib/harness-vault-installer
home=/var/lib/harness-vault
docker=/usr/bin/docker

metadata() { /usr/bin/stat -c '%u:%g:%a' "$1"; }
device_id() { /usr/bin/stat -c '%d' "$1"; }
new_key() { cat /proc/sys/kernel/random/uuid; }

lock_transaction() {
  local rc=0
  /usr/bin/flock -n -E 75 "$state/.lock" /bin/bash -c "$BASH_EXECUTION_STRING" vault "$1" locked || rc=$?
  if [[ "$rc" == 75 ]]; then printf 'Another Vault operation is already running.\n' >&2; fi
  return "$rc"
}

check_dependencies() {
  [[ -d /run/systemd/system && -x "$docker" && -x /usr/bin/dockerd-rootless-setuptool.sh &&
    -x /usr/bin/newuidmap && -x /usr/bin/newgidmap ]] ||
    die 'This installation requires systemd, Docker with rootless extras, and uidmap.'
}

record_database() {
  if [[ "$1" == user ]]; then printf passwd; else printf group; fi
}

record_exists() {
  local value rc=0
  value=$(getent "$(record_database "$1")" "$account") || rc=$?
  case "$rc" in
    0) [[ -n "$value" ]] ;;
    2) return 1 ;;
    *) die 'Could not read the local user and group database.' ;;
  esac
}

verify_record() {
  if ! record_exists "$1"; then return; fi
  local type expected="$account:x:$executor_id:"
  type=$(record_database "$1")
  if [[ "$1" == user ]]; then
    expected+="$executor_id:Harness Vault $2:$home:/usr/sbin/nologin"
  fi
  [[ "$(getent "$type" "$account")" == "$expected" ]] &&
    grep -Fxq "$expected" "/etc/$type" ||
    die "The existing Vault $1 does not match the ownership journal."
}

available_id() {
  local used value
  used=$({ getent passwd && getent group; } | cut -d: -f3)
  for ((value=900; value<=999; value++)); do
    if ! grep -Fxq "$value" <<< "$used"; then
      printf '%s\n' "$value"
      return
    fi
  done
  die 'No free local UID and GID in the Vault account range.'
}

ensure_group() {
  if ! record_exists group; then groupadd -g "$executor_id" "$account"; fi
}

ensure_user() {
  if ! record_exists user; then
    useradd -M -l -u "$executor_id" -g "$executor_id" -d "$home" -s /usr/sbin/nologin \
      -p '!' -c "Harness Vault $user_key" -K "UID_MIN=900" "$account"
  fi
}

verify_account() {
  local policy rc=0
  verify_record user "$user_key"
  [[ "$(id -G "$account")" == "$executor_id" ]] ||
    die 'The executor has additional group memberships.'
  [[ "$(passwd -S "$account" | awk '{print $2}')" == L ]] ||
    die 'The executor password is not locked.'
  policy=$(/usr/bin/sudo -n -l -U "$account" 2>&1) || rc=$?
  [[ "$rc" == 0 || "$rc" == 1 ]] &&
    sudo_denied "$policy" ||
    die 'Sudo did not explicitly deny all access to the executor.'
}

as_executor() {
  local runtime="/run/user/$executor_id"
  /usr/sbin/runuser -u "$account" -- /usr/bin/env -i HOME="$home" USER="$account" LOGNAME="$account" \
    XDG_RUNTIME_DIR="$runtime" DBUS_SESSION_BUS_ADDRESS="unix:path=$runtime/bus" PATH="$PATH" LC_ALL=C "$@"
}

start_engine() {
  loginctl enable-linger "$account"
  systemctl start "user@$executor_id.service"
  if ! as_executor /usr/bin/systemctl --user cat docker.service >/dev/null 2>&1; then
    as_executor /usr/bin/dockerd-rootless-setuptool.sh install --force </dev/null >/dev/null 2>&1 ||
      die 'Rootless Docker could not install its user service. Check subordinate IDs and user namespaces.'
  fi
  as_executor /usr/bin/systemctl --user reset-failed docker.service >/dev/null 2>&1 || :
  as_executor /usr/bin/systemctl --user enable --now docker.service >/dev/null 2>&1 ||
    die 'The rootless Docker user service could not be started.'
}

verify_engine() {
  local socket="/run/user/$executor_id/docker.sock"
  as_executor /bin/test ! -L "$socket" && as_executor /bin/test -S "$socket" &&
    [[ "$(metadata "$socket" | cut -d: -f1)" == "$executor_id" ]] ||
    die 'The private Docker socket is missing or has another owner.'
  as_executor "$docker" --host "unix://$socket" info --format '{{.SecurityOptions}}' 2>/dev/null |
    grep -Fq 'name=rootless' || die 'The private Docker engine did not confirm rootless mode.'
}

stop_engine() {
  if ! record_exists user; then return; fi
  loginctl disable-linger "$account"
  systemctl stop "user@$executor_id.service"
}

delete_record() {
  if ! record_exists "$1"; then return; fi
  if [[ "$1" == user ]]; then userdel "$account"; else groupdel "$account"; fi
}
