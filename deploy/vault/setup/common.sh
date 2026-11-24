#!/bin/bash
# Part of the Harness Vault installer. The CLI and both Mac apps run trusted bundled text.
set -euo pipefail
umask 077
export PATH=/usr/bin:/bin:/usr/sbin:/sbin LC_ALL=C
cd /

account=harness-vault
progress_file=setup-progress
operation=
phase=
detail=

exists() { [[ -e "$1" || -L "$1" ]]; }
root_dir() { [[ -d "$1" && ! -L "$1" ]] && [[ "$(metadata "$1")" == "0:0:$2" ]]; }
root_file() { [[ -f "$1" && ! -L "$1" ]] && [[ "$(metadata "$1")" == "0:0:$2" ]]; }

die() {
  detail=$1
  exit 1
}

atomic_receipt() {
  local name=$1 mode=$2 value=$3 temp
  temp=$(mktemp "$state/.receipt.XXXXXXXX")
  printf '%s\n' "$value" > "$temp"
  chmod "$mode" "$temp"
  mv -f "$temp" "$state/$name"
}

failed() {
  local code=$?
  if [[ "$code" == 0 || -z "$phase" ]]; then return; fi
  trap - ERR
  printf 'Vault %s failed at %s. %s\n' "$operation" "$phase" \
    "${detail:-Retry the command to resume from the journal.}" >&2
  atomic_receipt "$progress_file" 644 "failed:$operation:$phase" || :
}

step() {
  phase=$1
  shift
  atomic_receipt "$progress_file" 644 "working:$operation:$phase"
  printf 'Vault %s: %s\n' "$operation" "$phase"
  "$@"
}

select_home() { :; }
prepare_home_parent() { :; }

unowned_installation() {
  select_home
  ! record_exists user && ! record_exists group && ! exists "$home" ||
    die 'A Vault account, group or home exists without a matching ownership journal.'
}

read_identity() {
  local extra
  root_file "$state/identity" 600 || die 'The Vault ownership journal is invalid.'
  {
    IFS= read -r executor_id && IFS= read -r user_key && IFS= read -r group_key &&
      ! IFS= read -r extra
  } < "$state/identity" || die 'The Vault ownership journal is incomplete.'
  [[ "$executor_id" =~ ^[1-9][0-9]{2,4}$ ]] &&
    [[ "$user_key" =~ ^[[:xdigit:]-]{36}$ && "$group_key" =~ ^[[:xdigit:]-]{36}$ ]] ||
    die 'The Vault ownership journal has invalid identity fields.'
  verify_record user "$user_key"
  verify_record group "$group_key"
  select_home
}

ensure_identity() {
  if ! exists "$state/identity"; then
    unowned_installation
    executor_id=$(available_id)
    user_key=$(new_key)
    group_key=$(new_key)
    atomic_receipt identity 600 "$(printf '%s\n%s\n%s' "$executor_id" "$user_key" "$group_key")"
  fi
  read_identity
}

verify_home() {
  [[ -d "$home" && ! -L "$home" ]] &&
    [[ "$(metadata "$home")" == "$executor_id:$executor_id:700" ]] ||
    die 'The executor home does not match the journal.'
}

ensure_home() {
  if ! exists "$home"; then
    prepare_home_parent
    local stage="$state/.home"
    if exists "$stage"; then
      [[ -d "$stage" && ! -L "$stage" ]] || die 'The staged executor home is invalid.'
    else
      mkdir -m 700 "$stage"
    fi
    chown "$executor_id:$executor_id" "$stage"
    mv "$stage" "$home"
  fi
  verify_home
}

archive_home() {
  if exists "$state/.home"; then
    [[ -d "$state/.home" && ! -L "$state/.home" ]] || die 'The staged executor home is invalid.'
    rmdir "$state/.home"
  fi
  if ! exists "$home"; then return; fi
  verify_home
  local archive="$state/archive"
  if ! exists "$archive"; then mkdir -m 700 "$archive"; fi
  root_dir "$archive" 700 || die 'The Vault archive is invalid.'
  local retained="$archive/$user_key"
  ! exists "$retained" || die 'The archive already contains this executor home.'
  [[ "$(device_id "$archive")" == "$(device_id "$home")" ]] ||
    die 'Vault data and its archive must be on the same filesystem.'
  mv "$home" "$retained" ||
    die 'The private data could not be moved to the archive. The original home was retained.'
}

sudo_denied() {
  local denied="^User $account is not allowed to run sudo on [^[:space:]]+\.[[:space:]]*$"
  [[ "$1" =~ $denied ]]
}

verify_quiet() {
  local rc=0
  pgrep -u "$executor_id" >/dev/null 2>&1 || rc=$?
  [[ "$rc" == 1 ]] || die 'The executor still has running processes. Stop its jobs and retry.'
}

remove_executor() {
  operation=remove
  if ! exists "$state/identity"; then
    step identity unowned_installation
  else
    step identity read_identity
    step engine stop_engine
    step processes verify_quiet
    step archive archive_home
    step account delete_record user
    step group delete_record group
    rm "$state/identity"
  fi
  atomic_receipt "$progress_file" 644 absent
  printf 'Vault removed. Any executor data is retained in %s/archive.\n' "$state"
}

setup_executor() {
  local prior
  prior=$(read_progress)
  if [[ "$prior" == *:remove:* ]]; then remove_executor; fi
  operation=setup
  step dependencies check_dependencies
  step identity ensure_identity
  step group ensure_group
  step account ensure_user
  step permissions verify_account
  step home ensure_home
  step engine start_engine
  step verification verify_engine
  atomic_receipt "$progress_file" 644 ready
  printf 'The isolated Vault executor is set up on this computer.\n'
}

read_progress() {
  if ! exists "$state"; then
    printf '%s\n' absent
  elif ! root_dir "$state" 711; then
    printf '%s\n' 'failed:setup:identity'
  elif root_file "$state/$progress_file" 644; then
    cat "$state/$progress_file"
  elif root_file "$state/status" 644 && [[ "$(cat "$state/status")" == undone ]]; then
    printf '%s\n' absent
  else
    printf '%s\n' 'failed:setup:identity'
  fi
}

vault_main() {
  local action=${1:-}
  case "$action" in
    status) read_progress; return ;;
    setup|remove) ;;
    *) die 'Use harness vault setup, remove, or status.' ;;
  esac
  if [[ "$EUID" != 0 ]]; then
    exec /usr/bin/sudo -- /usr/bin/env -i /bin/bash -c "$BASH_EXECUTION_STRING" vault "$action"
  fi
  if ! exists "$state"; then
    mkdir -m 711 "$state" 2>/dev/null || :
  fi
  if ! root_dir "$state" 711; then
    printf 'Vault %s failed at identity. The journal directory has unexpected ownership or permissions.\n' "$action" >&2
    return 1
  fi
  if [[ "${2:-}" != locked ]]; then
    lock_transaction "$action"
    return
  fi
  trap failed EXIT
  trap 'exit 130' INT
  trap 'exit 143' HUP TERM
  "${action}_executor"
}
