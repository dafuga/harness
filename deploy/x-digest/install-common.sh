#!/usr/bin/env bash
# Shared by the two installers; source it, do not run it.
set -euo pipefail
umask 077

source_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
base=$HOME/.local/share/harness-x-digest
conf=$HOME/.config/harness-x-digest
agents=$HOME/Library/LaunchAgents
data=$HOME/.harness/x-digest
bun=$HOME/.bun/bin/bun
agent_path=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

# Copies the committed HEAD, so what runs is always a known revision.
install_app() {
	mkdir -p "$base" "$conf" "$data" "$agents"
	rm -rf "$base/app.new"
	mkdir "$base/app.new"
	git -C "$source_root" archive HEAD | tar -x -C "$base/app.new"
	(cd "$base/app.new" && "$bun" install --frozen-lockfile --production --ignore-scripts >/dev/null)
	git -C "$source_root" rev-parse HEAD > "$base/app.new/INSTALLED_SHA"
	rm -rf "$base/app.old"
	[ ! -d "$base/app" ] || mv "$base/app" "$base/app.old"
	mv "$base/app.new" "$base/app"
	cp "$base/app/deploy/x-digest/run-daily.sh" "$base/"
	chmod 700 "$base/run-daily.sh"
}

# install_agent <label> <program-arguments-xml> <schedule-xml>
install_agent() {
	cat > "$agents/$1.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$1</string>
<key>ProgramArguments</key><array>$2</array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>$agent_path</string></dict>
$3
<key>StandardOutPath</key><string>$data/$1.log</string>
<key>StandardErrorPath</key><string>$data/$1.log</string>
</dict></plist>
PLIST
	plutil -lint "$agents/$1.plist" >/dev/null
	launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
	launchctl bootstrap "gui/$(id -u)" "$agents/$1.plist"
}

# daily_at <HH:MM> prints the LaunchAgent schedule, in this Mac's local time.
daily_at() {
	case "$1" in [0-2][0-9]:[0-5][0-9]) ;; *) echo "refused: the time is HH:MM" >&2; return 1 ;; esac
	local hour=${1%:*} minute=${1#*:}
	echo "<key>StartCalendarInterval</key><dict><key>Hour</key><integer>$((10#$hour))</integer><key>Minute</key><integer>$((10#$minute))</integer></dict>"
}
