#!/usr/bin/env bash
# On the browser's Mac: installs the viewer (kept running) and the daily collector. Needs
# ~/.config/harness-x-digest/config.json. No Slack token belongs on this Mac.
#   deploy/x-digest/install.sh <viewer-host> [<viewer-host>...]
set -euo pipefail
source "$(dirname "$0")/install-common.sh"
time=${X_DIGEST_TIME:-08:00}
port=${X_DIGEST_PORT:-6080}
[ $# -ge 1 ] || { echo "usage: install.sh <viewer-host> [<viewer-host>...]" >&2; exit 1; }
case "$port" in *[!0-9]*) echo "refused: bad viewer port" >&2; exit 1 ;; esac
hosts=
for host in "$@"; do
	case "$host" in *[!A-Za-z0-9.:-]*) echo "refused: bad viewer host" >&2; exit 1 ;; esac
	hosts="$hosts<string>--host</string><string>$host</string>"
done
schedule=$(daily_at "$time")

install_app
install_agent com.harness.x-digest.viewer \
	"<string>$bun</string><string>$base/app/src/cli/index.ts</string><string>container-browser</string><string>viewer</string><string>--profile</string><string>x</string><string>--port</string><string>$port</string>$hosts" \
	'<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer>'
install_agent com.harness.x-digest.daily \
	"<string>$base/run-daily.sh</string><string>collect</string>" "$schedule"
echo "installed $(cat "$base/app/INSTALLED_SHA"); collects daily at $time, viewer on port $port"
