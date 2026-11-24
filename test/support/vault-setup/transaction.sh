#!/bin/bash
# Calls the actual journal state machine with filesystem-backed, unprivileged OS operations.
source "$1"
state="$2/journal"
home="$2/executor-home"
fault=$4
set -euo pipefail
mkdir -p "$state"

metadata() {
  if [[ "$1" == "$home" ]]; then
    printf '551:551:700'
  elif [[ -d "$1" ]]; then
    printf '0:0:711'
  else
    local mode
    mode=$(stat -f '%Lp' "$1" 2>/dev/null) || mode=$(stat -c '%a' "$1")
    printf '0:0:%s' "$mode"
  fi
}
root_dir() { [[ -d "$1" && ! -L "$1" ]]; }
device_id() { printf fixture; }
new_key() { printf '7CA69F12-9BC1-4632-BED4-C0FA72EA31A8'; }
chown() { :; }
pgrep() { return 1; }
available_id() { printf '551'; }

record_exists() { [[ -f "$state/$1" ]]; }
verify_record() {
  if record_exists "$1" && [[ "$(cat "$state/$1")" != "$2" ]]; then
    die "The existing Vault $1 does not match the ownership journal."
  fi
}

interrupt_at() {
  if [[ "$fault" == "$1" ]]; then kill -KILL "$$"; fi
}

ensure_group() { printf '%s' "$group_key" > "$state/group"; interrupt_at group; }
ensure_user() { printf '%s' "$user_key" > "$state/user"; interrupt_at account; }
verify_account() { record_exists user && record_exists group; }
check_dependencies() { :; }
start_engine() {
  if [[ "$fault" == engine-error ]]; then die 'The synthetic engine failed.'; fi
  touch "$state/engine"
  interrupt_at engine
}
verify_engine() { [[ -f "$state/engine" ]]; }
stop_engine() { rm -f "$state/engine"; interrupt_at stop; }
delete_record() { rm -f "$state/$1"; interrupt_at "delete-$1"; }

trap failed EXIT
"$3"_executor
