#!/usr/bin/env bash
# @harness-uid u_dq4n62kuop
# Copy a locally staged Tracker release to another computer, publish it there, and
# re-verify every computer after the soak.
#
#   tracker-release-copy.sh copy <local-release-dir> <ssh-host>
#   tracker-release-copy.sh soak <release-id> <ssh-host>...
#
# A failed or timed-out copy can leave an rsync receiver running on the other
# computer. It keeps a handle on its directory, even after a rename, and can later
# write a partial file over the real one (tkx6js). So:
#   - every attempt copies into a fresh directory, without --partial;
#   - leftover receivers are killed and confirmed gone after a failed attempt and
#     before publishing;
#   - the live release is a local copy in a directory rsync never wrote to;
#   - soak checks SHA256SUMS again on every computer.
set -euo pipefail

releases=.local/state/tracker/harness-releases
ssh_command='ssh -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=12'

# Shell functions which run on this computer and, through remote(), on the others.
library=$(
	cat <<'LIBRARY'
set -eu
umask 077
# Pids of rsync receivers writing to any staging or live directory of the release.
receivers() {
	listing=$(ps -axo pid=,command=) || return 1
	printf '%s\n' "$listing" | awk -v id="$1" '
		$(2) ~ /(^|\/)(open)?rsync$/ && $(3) == "--server" &&
		$(NF) ~ ("(^|/)harness-releases/([.][^/]*-" id "[.][^/]*|" id ")/?$") { print $(1) }'
}
# SIGKILL, so that a receiver cannot run its own cleanup and keep a partial file.
stop_receivers() {
	for _ in 1 2 3 4 5 6 7 8 9 10; do
		pids=$(receivers "$1") || return 1
		[ -n "$pids" ] || return 0
		echo "$pids" | xargs kill -KILL 2>/dev/null || true
		sleep 0.2
	done
	echo "rsync receivers for $1 are still running: $(echo $pids)" >&2
	return 1
}
# The directory holds exactly the release whose SHA256SUMS has the given hash.
check_release() (
	cd "$1" || exit 1
	[ "$(shasum -a 256 SHA256SUMS | cut -d' ' -f1)" = "$2" ] || { echo "SHA256SUMS differs in $1" >&2; exit 1; }
	for name in harness tracker-shim.sh; do
		grep -q "[ *]$name\$" SHA256SUMS || { echo "SHA256SUMS does not list $name" >&2; exit 1; }
	done
	shasum -a 256 -c SHA256SUMS >&2 && codesign --verify --strict harness
)
LIBRARY
)

# Run the script on stdin, after the library, on a host with the remaining arguments.
remote() {
	local host=$1
	shift
	{
		printf '%s\n' "$library"
		cat
	} | $ssh_command "$host" /bin/sh -s -- "$@"
}

sweep() {
	remote "$1" "$2" <<<'stop_receivers "$1"'
}

fail() {
	echo "$*" >&2
	exit 1
}

check_names() {
	[[ $1 =~ ^[0-9a-f]{7,40}$ ]] || fail "Not a release id: $1"
	shift
	for host in "$@"; do
		[[ $host =~ ^[A-Za-z0-9_][A-Za-z0-9_.@-]*$ ]] || fail "Not an ssh host: $host"
	done
}

sums_hash() {
	shasum -a 256 "$1/SHA256SUMS" | cut -d' ' -f1
}

# "host" and release id while a receiver for them may still be running.
in_flight=()
stop_interrupted_copy() {
	((${#in_flight[@]})) || return 0
	sweep "${in_flight[@]}" ||
		echo "WARNING: could not stop the receiver on ${in_flight[0]}. Do not publish ${in_flight[1]} by hand; run copy again." >&2
}
trap stop_interrupted_copy EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

# One attempt: no receiver left over, a directory nothing has written to, no --partial.
copy_attempt() {
	local source=$1 host=$2 id=$3 staging
	sweep "$host" "$id" || return 1
	staging=$(remote "$host" "$releases" "$id" <<<'mktemp -d "$1/.copy-$2.XXXXXX"') || return 1
	in_flight=("$host" "$id")
	rsync --bwlimit="${HARNESS_RELEASE_BWLIMIT:-2000}" --timeout="${HARNESS_RELEASE_TIMEOUT:-120}" \
		--checksum -a -z -e "$ssh_command" "$source/" "$host:$staging/" || return 1
	staged=$staging
}

publish() {
	remote "$1" "$releases" "$2" "$3" "$4" <<'HOST'
root=$1 id=$2 staging=$3 sums=$4
stop_receivers "$id"
[ ! -e "$root/$id" ] || { echo "$root/$id already exists" >&2; exit 1; }
final=$(mktemp -d "$root/.publish-$id.XXXXXX")
trap 'rm -rf "$final"' EXIT
# A local copy: rsync never had a handle on the directory which goes live.
for name in SHA256SUMS $(awk '{ sub(/^[*]/, "", $2); print $2 }' "$staging/SHA256SUMS"); do
	case $name in */*) echo "Unexpected path in SHA256SUMS: $name" >&2; exit 1 ;; esac
	cp -p "$staging/$name" "$final/$name"
done
check_release "$final" "$sums"
bash -n "$final/tracker-shim.sh"
HARNESS_EXECUTABLE="$HOME/$final/harness" "$final/tracker-shim.sh" help >/dev/null
stop_receivers "$id"
[ ! -e "$root/$id" ] || { echo "$root/$id already exists" >&2; exit 1; }
mv "$final" "$root/$id"
trap - EXIT
rm -rf "$root/.copy-$id."*
HOST
}

copy_release() {
	local source=${1%/} host=$2 id sums attempt attempts=${HARNESS_RELEASE_ATTEMPTS:-4}
	id=$(basename "$source")
	check_names "$id" "$host"
	sums=$(sums_hash "$source")
	(eval "$library" && check_release "$source" "$sums") || fail "The local release $source does not verify"
	remote "$host" "$releases" "$id" <<<'mkdir -p "$1"; [ ! -e "$1/$2" ] || { echo "$1/$2 already exists" >&2; exit 1; }' ||
		fail "Cannot start a copy to $host"
	staged=
	for ((attempt = 1; attempt <= attempts; attempt++)); do
		copy_attempt "$source" "$host" "$id" && break
		echo "Copy attempt $attempt to $host failed" >&2
		if sweep "$host" "$id"; then
			in_flight=()
		else
			echo "Could not confirm that no receiver is left on $host" >&2
		fi
		((attempt == attempts)) || sleep "${HARNESS_RELEASE_RETRY_SECONDS:-45}"
	done
	[[ -n "$staged" ]] || fail "Nothing was published on $host"
	publish "$host" "$id" "$staged" "$sums" || fail "Nothing was published on $host"
	in_flight=()
	echo "Published $id on $host. After activation run: $0 soak $id $host"
}

soak_release() {
	local id=$1 host sums failed=0 seconds=${HARNESS_RELEASE_SOAK_SECONDS:-900}
	shift
	check_names "$id" "$@"
	echo "Soaking for $seconds seconds before verifying $id"
	sleep "$seconds"
	local verify='pids=$(receivers "$2"); [ -z "$pids" ] || { echo "rsync receivers still running: $(echo $pids)" >&2; exit 1; }; check_release "$1/$2" "$3"'
	sums=$(sums_hash "$HOME/$releases/$id") || sums=missing
	if (eval "$library" && set -- "$HOME/$releases" "$id" "$sums" && eval "$verify"); then
		echo "OK this computer"
	else
		echo "FAILED this computer"
		failed=1
	fi
	for host in "$@"; do
		if remote "$host" "$releases" "$id" "$sums" <<<"$verify"; then
			echo "OK $host"
		else
			echo "FAILED $host"
			failed=1
		fi
	done
	return "$failed"
}

case "${1:-}" in
copy)
	[[ $# == 3 ]] || fail "Usage: $0 copy <local-release-dir> <ssh-host>"
	copy_release "$2" "$3"
	;;
soak)
	[[ $# -ge 3 ]] || fail "Usage: $0 soak <release-id> <ssh-host>..."
	shift
	soak_release "$@"
	;;
*)
	fail "Usage: $0 copy <local-release-dir> <ssh-host> | soak <release-id> <ssh-host>..."
	;;
esac
