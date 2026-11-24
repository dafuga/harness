#!/bin/bash
set -euo pipefail

state=/var/db/org.harness.vault-executor
home=/Users/$account
colima=/opt/homebrew/bin/colima
docker=/opt/homebrew/bin/docker
if [[ "$(uname -m)" == x86_64 ]]; then
  colima=/usr/local/bin/colima
  docker=/usr/local/bin/docker
fi
socket=$home/.colima/$account/docker.sock

metadata() {
  local listing
  listing=$(/bin/ls -led "$1") || return 1
  if grep -Eq '^[[:space:]]+[0-9]+:' <<< "$listing"; then return 1; fi
  /usr/bin/stat -f '%u:%g:%Lp' "$1"
}
device_id() { /usr/bin/stat -f '%d' "$1"; }
new_key() { /usr/bin/uuidgen; }

lock_transaction() {
  local rc=0
  /usr/bin/lockf -k -t 0 "$state/.lock" /bin/bash -c "$BASH_EXECUTION_STRING" vault "$1" locked || rc=$?
  if [[ "$rc" == 75 ]]; then printf 'Another Vault operation is already running.\n' >&2; fi
  return "$rc"
}

check_dependencies() {
  [[ -x "$colima" && -x "$docker" ]] ||
    die 'Install Colima, Lima and the Docker CLI before setting up Vault.'
}

directory() {
  if [[ "$1" == user ]]; then printf '/Users'; else printf '/Groups'; fi
}

record_exists() {
  local records
  records=$(/usr/bin/dscl . -list "$(directory "$1")") ||
    die 'Could not enumerate local Directory Services records.'
  grep -Fxq "$account" <<< "$records"
}

attribute_matches() {
  local attribute=$1 value=$2
  grep -Fx -e "$attribute: $value" -e "dsAttrTypeNative:$attribute: $value"
}

verify_record() {
  if ! record_exists "$1"; then return; fi
  /usr/bin/dscl . -read "$(directory "$1")/$account" GeneratedUID |
    attribute_matches GeneratedUID "$2" >/dev/null ||
    die "The existing Vault $1 does not match the ownership journal."
}

available_id() {
  local used value
  used=$({ /usr/bin/dscl . -list /Users UniqueID && /usr/bin/dscl . -list /Groups PrimaryGroupID; }) ||
    die 'Could not enumerate local account IDs.'
  for ((value=550; value<=600; value++)); do
    if ! awk -v n="$value" '$NF == n { found=1 } END { exit !found }' <<< "$used"; then
      printf '%s\n' "$value"
      return
    fi
  done
  die 'No free local UID and GID in the Vault account range.'
}

ensure_group() {
  local record="/Groups/$account"
  /usr/bin/dscl . -create "$record" GeneratedUID "$group_key"
  /usr/bin/dscl . -create "$record" PrimaryGroupID "$executor_id"
  /usr/bin/dscl . -create "$record" RealName 'Harness Vault Executor'
}

ensure_user() {
  local record="/Users/$account"
  /usr/bin/dscl . -create "$record" GeneratedUID "$user_key"
  /usr/bin/dscl . -create "$record" UniqueID "$executor_id"
  /usr/bin/dscl . -create "$record" PrimaryGroupID "$executor_id"
  /usr/bin/dscl . -create "$record" RealName 'Harness Vault Executor'
  /usr/bin/dscl . -create "$record" UserShell /usr/bin/false
  /usr/bin/dscl . -create "$record" NFSHomeDirectory "$home"
  /usr/bin/dscl . -create "$record" IsHidden 1
  # The account is only used with a root-initiated identity switch.
  /usr/bin/dscl . -create "$record" Password '*'
}

verify_account() {
  local record="/Users/$account" policy memberships rc=0
  [[ "$(/usr/bin/id -u "$account"):$("/usr/bin/id" -g "$account")" == "$executor_id:$executor_id" ]] ||
    die 'The executor UID and GID must be private.'
  /usr/bin/dsmemberutil checkmembership -U "$account" -G admin |
    grep -Fq 'is not a member' || die 'The executor is an administrator or membership could not be checked.'
  memberships=$(/usr/bin/id -Gn "$account")
  if tr ' ' '\n' <<< "$memberships" | grep -Ex 'wheel|admin|sudo|docker|root' >/dev/null; then
    die 'The executor has a privileged group membership.'
  fi
  policy=$(/usr/bin/sudo -n -l -U "$account" 2>&1) || rc=$?
  [[ "$rc" == 0 || "$rc" == 1 ]] && sudo_denied "$policy" ||
    die 'Sudo did not explicitly deny all access to the executor.'
  /usr/bin/dscl . -read "$record" IsHidden | attribute_matches IsHidden 1 >/dev/null ||
    die 'Directory Services does not report the executor as hidden.'
  /usr/bin/dscl . -read "$record" UserShell | attribute_matches UserShell /usr/bin/false >/dev/null ||
    die 'The executor login shell is not disabled.'
}

as_executor() {
  local tools="${colima%/*}"
  /usr/bin/sudo -n -H -u "$account" -- /usr/bin/env -i \
    HOME="$home" USER="$account" LOGNAME="$account" DOCKER_CONFIG="$home/.docker" \
    TMPDIR=/tmp LC_ALL=C PATH="/usr/bin:/bin:/usr/sbin:/sbin:$tools" "$@"
}

start_engine() {
  as_executor "$colima" start "$account" --runtime docker --vm-type vz --mount none \
    --mount-inotify=false --ssh-config=false --activate=false --template=false \
    --cpus 2 --memory 4 --disk 12 </dev/null >/dev/null 2>&1 ||
    die 'Colima could not start the private Vault VM. Check macOS virtualization and the Colima installation.'
  if as_executor "$docker" context inspect "$account" >/dev/null 2>&1; then
    as_executor "$docker" context update "$account" --docker "host=unix://$socket" >/dev/null 2>&1
  else
    as_executor "$docker" context create "$account" --docker "host=unix://$socket" >/dev/null 2>&1
  fi
}

verify_engine() {
  as_executor /bin/test ! -L "$socket" && as_executor /bin/test -S "$socket" &&
    [[ "$(as_executor /usr/bin/stat -f '%u' "$socket")" == "$executor_id" ]] ||
    die 'The private Docker socket is missing or has another owner.'
  as_executor "$docker" --host "unix://$socket" version --format '{{.Server.Version}}' >/dev/null 2>&1 ||
    die 'The private Docker engine did not answer.'
}

stop_engine() {
  if ! record_exists user || ! exists "$home"; then return; fi
  verify_home
  if ! as_executor /bin/test -d "$home/.colima/$account"; then return; fi
  [[ -x "$colima" ]] || die 'Colima is needed to stop the private engine before removal.'
  as_executor "$colima" stop "$account" </dev/null >/dev/null 2>&1 ||
    die 'Colima could not stop the private Vault VM.'
}

delete_record() {
  if record_exists "$1"; then
    /usr/bin/dscl . -delete "$(directory "$1")/$account"
  fi
}
