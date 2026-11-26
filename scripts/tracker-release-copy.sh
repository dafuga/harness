#!/usr/bin/env bash
# @harness-uid u_dq4n62kuop
# Copy a locally staged Tracker release to another computer and publish it there.
# Usage: tracker-release-copy.sh copy <local-release-dir> <ssh-host>
set -euo pipefail

releases=.local/state/tracker/harness-releases
ssh_command='ssh -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=12'

remote() {
	local host=$1
	shift
	$ssh_command "$host" /bin/sh -s -- "$@"
}

copy_release() {
	local source=$1 host=$2 id staging copied=false
	id=$(basename "$source")
	staging=$(
		remote "$host" "$releases" "$id" <<'HOST'
set -eu
umask 077
mkdir -p "$1"
test ! -e "$1/$2"
mktemp -d "$1/.copy-$2.XXXXXX"
HOST
	)
	for attempt in $(seq 1 "${HARNESS_RELEASE_ATTEMPTS:-4}"); do
		if rsync --bwlimit="${HARNESS_RELEASE_BWLIMIT:-2000}" --timeout="${HARNESS_RELEASE_TIMEOUT:-120}" \
			--partial --checksum -a -z -e "$ssh_command" "$source/" "$host:$staging/"; then
			copied=true
			break
		fi
		echo "Copy attempt $attempt to $host failed" >&2
		sleep "${HARNESS_RELEASE_RETRY_SECONDS:-45}"
	done
	$copied
	remote "$host" "$releases" "$id" "$staging" <<'HOST'
set -eu
test ! -e "$1/$2"
(
	cd "$3"
	shasum -a 256 -c SHA256SUMS
	codesign --verify --strict harness
	bash -n tracker-shim.sh
)
HARNESS_EXECUTABLE="$HOME/$3/harness" "$3/tracker-shim.sh" help >/dev/null
mv "$3" "$1/$2"
HOST
	echo "Published $id on $host"
}

case "${1:-}" in
copy) copy_release "${2:?local release dir}" "${3:?ssh host}" ;;
*)
	echo "Usage: $0 copy <local-release-dir> <ssh-host>" >&2
	exit 2
	;;
esac
