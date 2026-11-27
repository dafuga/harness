#!/usr/bin/env bash
# One daily X digest step: `collect` on the browser's Mac or `send` on the token's Mac.
# Extra arguments go to `harness x-digest`.
set -euo pipefail
umask 077
base=${X_DIGEST_BASE:-$HOME/.local/share/harness-x-digest}
conf=${X_DIGEST_CONF:-$HOME/.config/harness-x-digest}
data=${X_DIGEST_DATA:-$HOME/.harness/x-digest}
tracker=${X_DIGEST_TRACKER:-$HOME/.local/bin/tracker}
bun=${X_DIGEST_BUN:-$HOME/.bun/bin/bun}
action=${1:-}
case "$action" in
	collect) config=$conf/config.json ;;
	send) config=$conf/sender.json ;;
	*) echo "usage: run-daily.sh collect|send [options]" >&2; exit 1 ;;
esac
shift
mkdir -p "$data"

status=0
output=$("$bun" "$base/app/src/cli/index.ts" x-digest "$action" --config "$config" "$@" 2>&1) || status=$?
printf '%s %s exit=%s\n%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$action" "$status" "$output" | tee -a "$data/daily.log"
[ "$status" -eq 0 ] && exit 0
case " $* " in *" --dry-run "*) exit "$status" ;; esac

# A reported status already asked Daniel where one is needed. A crash did not, nor did a digest
# that never arrived, and either would otherwise look like a quiet day.
case "$output" in
	*'{"status":"waiting"'*) problem="no digest arrived from the collecting Mac today" ;;
	*'{"status":'*) exit "$status" ;;
	*) problem="the daily $action step crashed" ;;
esac
item=$(sed -n 's/.*"item": *"\([a-z0-9]*\)".*/\1/p' "$config")
"$tracker" flag "$item" "X digest: $problem. Details are in ~/.harness/x-digest/daily.log on the Mac that ran it." \
	--option "Start a fix session=A session reads the logs and repairs the digest" \
	--option "Pause the X digest=The daily runs are turned off" \
	--recommend 1 >> "$data/daily.log" 2>&1
exit "$status"
