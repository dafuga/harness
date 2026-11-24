#!/bin/bash
# Run from a locally signed-in macOS operator session. The one system prompt covers the fixture.
set -euo pipefail
export PATH=/usr/bin:/bin:/usr/sbin:/sbin
[[ "$(uname -s)" == Darwin && "$EUID" != 0 ]]
source_dir="$(cd "$(dirname "$0")/../../../deploy/vault/setup" && pwd -P)"
suffix="$(uuidgen | cut -d- -f1 | tr '[:upper:]' '[:lower:]')"
fixture="vault-test-$suffix"
journal="/var/db/org.harness.vault-executor-$fixture"
previous=${1:-}
[[ $# -le 1 && ( -z "$previous" || "$previous" =~ ^vault-test-[0-9a-f]{8}$ ) ]]
payload_for() {
  sed "s/^account=harness-vault$/account=$1/" "$source_dir/common.sh"
  sed "s#^state=/var/db/org.harness.vault-executor\$#state=/var/db/org.harness.vault-executor-$1#" "$source_dir/macos.sh"
  printf '\nvault_main "$@"\n'
}
payload="$(payload_for "$fixture")"
previous_payload=
if [[ -n "$previous" ]]; then previous_payload="$(payload_for "$previous")"; fi
printf 'Fixture: %s\n' "$fixture"
driver="$(cat <<'DRIVER'
set -euo pipefail
export PATH=/usr/bin:/bin:/usr/sbin:/sbin LC_ALL=C
[[ "$EUID" == 0 ]]
payload=$1 account=$2 journal=$3
previous=$4 previous_payload=$5
[[ "$account" =~ ^vault-test-[0-9a-f]{8}$ && "$journal" == "/var/db/org.harness.vault-executor-$account" ]]
if [[ -n "$previous" ]]; then
  [[ "$previous" =~ ^vault-test-[0-9a-f]{8}$ && "$previous" != "$account" ]]
  previous_journal="/var/db/org.harness.vault-executor-$previous"
  /usr/bin/env -i /bin/bash -c "$previous_payload" vault remove
  [[ ! -e "/Users/$previous" && ! -L "/Users/$previous" ]]
  if id "$previous" >/dev/null 2>&1 || dscl . -read "/Groups/$previous" >/dev/null 2>&1; then
    printf '%s\n' 'The previous disposable user or group is still present.' >&2
    exit 1
  fi
  rm -rf "$previous_journal"
  printf 'PASS: removed previous disposable fixture %s.\n' "$previous"
fi
[[ ! -e "$journal" && ! -L "$journal" && ! -e "/Users/$account" && ! -L "/Users/$account" ]]
if id "$account" >/dev/null 2>&1 || dscl . -read "/Groups/$account" >/dev/null 2>&1; then
  printf '%s\n' 'The disposable identity already exists.' >&2
  exit 1
fi
vault() { /usr/bin/env -i /bin/bash -c "$payload" vault "$1"; }
cleanup() {
  local rc=$?
  trap - EXIT
  if [[ -d "$journal" ]]; then
    if ! vault remove; then printf 'Disposable fixture cleanup failed at %s.\n' "$journal" >&2; exit 1; fi
    if [[ "$(vault status)" != absent ]] || id "$account" >/dev/null 2>&1; then
      printf '%s\n' 'Disposable identity removal could not be verified.' >&2
      exit 1
    fi
    rm -rf "$journal"
  fi
  exit "$rc"
}
trap cleanup EXIT
[[ "$(vault status)" == absent ]]
vault setup
owner=$(id -u "$account")
[[ "$(vault status)" == ready ]]
vault setup
[[ "$(id -u "$account")" == "$owner" ]]
/usr/bin/sudo -n -u "$account" -- /bin/bash -c 'printf "synthetic\n" > "$1/fixture-proof"' fixture "/Users/$account"
vault remove
vault remove
[[ "$(vault status)" == absent && ! -e "/Users/$account" ]]
if id "$account" >/dev/null 2>&1 || dscl . -read "/Groups/$account" >/dev/null 2>&1; then
  printf '%s\n' 'The disposable user or group is still present.' >&2
  exit 1
fi
grep -Fxq synthetic "$journal"/archive/*/fixture-proof
printf '%s\n' 'PASS: disposable macOS setup, repair, removal and archive.'
DRIVER
)"

/usr/bin/osascript - "$driver" "$payload" "$fixture" "$journal" "$previous" "$previous_payload" <<'APPLESCRIPT'
on run argv
	set shellCommand to "/usr/bin/env -i /bin/bash -c " & quoted form of item 1 of argv & " vault-fixture"
	repeat with i from 2 to count argv
		set shellCommand to shellCommand & " " & quoted form of item i of argv
	end repeat
	do shell script shellCommand with prompt "Run and remove the disposable Vault setup fixture." with administrator privileges
end run
APPLESCRIPT
