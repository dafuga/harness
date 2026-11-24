#!/bin/bash
# Reproduce the denied rename with the macOS sandbox, without administrator access.
set -euo pipefail
source "$1"
source "$2"
workspace="$(cd "$3" && pwd -P)"
legacy_home="$workspace/Users/$account"
home_parent="$workspace/managed"
state="$workspace/journal"
executor_id="$(id -u)"
executor_group="$(id -g)"
user_key=7CA69F12-9BC1-4632-BED4-C0FA72EA31A8

# Keep the real filesystem operations and emulate the root attributes required by the journal.
metadata() {
  local mode
  mode=$(/usr/bin/stat -f '%Lp' "$1") || return
  if [[ "$1" == "$home" ]]; then
    printf '%s:%s:%s' "$executor_id" "$executor_id" "$mode"
  else
    printf '0:0:%s' "$mode"
  fi
}
chown() { /usr/bin/chgrp "$executor_group" "$2"; }

mkdir -p -m 700 "$legacy_home" "$state"
chmod 700 "$legacy_home"
printf 'legacy\n' > "$legacy_home/proof"
select_home
[[ "$account_home" == "$legacy_home" ]]
mv() {
  /usr/bin/sandbox-exec -p "$deny_homes" /bin/mv "$@"
}
deny_homes="(version 1) (allow default) (deny file-write* (subpath \"$workspace/Users\"))"
if (archive_home) 2>"$workspace/legacy-error"; then
  printf '%s\n' 'Moving the legacy home unexpectedly succeeded.' >&2
  exit 1
fi
grep -Fq 'Operation not permitted' "$workspace/legacy-error"
grep -Fxq legacy "$legacy_home/proof"
rm -r "$legacy_home"

select_home
[[ "$account_home" == /var/empty && "$home" == "$home_parent/$account" ]]
ensure_home
printf 'managed\n' > "$home/proof"
archive_home
archive_home
[[ ! -e "$home" && ! -L "$home" ]]
grep -Fxq managed "$state/archive/$user_key/proof"
printf '%s\n' 'PASS: legacy home retained; managed data archived.'
