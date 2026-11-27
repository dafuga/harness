#!/usr/bin/env bash
# On the Mac that can read the Slack token: installs the daily sender. Needs
# ~/.config/harness-x-digest/sender.json, gcloud, and SSH to the browser's Mac.
#   deploy/x-digest/install-sender.sh
set -euo pipefail
source "$(dirname "$0")/install-common.sh"
time=${X_DIGEST_TIME:-08:05}
gcloud=$(command -v gcloud) || { echo "refused: gcloud is not on PATH" >&2; exit 1; }
agent_path=$(dirname "$gcloud"):$agent_path
schedule=$(daily_at "$time")

install_app
install_agent com.harness.x-digest.sender "<string>$base/run-daily.sh</string><string>send</string>" "$schedule"
echo "installed $(cat "$base/app/INSTALLED_SHA"); sends daily at $time"
