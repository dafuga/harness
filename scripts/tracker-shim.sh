#!/usr/bin/env bash
set -euo pipefail

executable=${HARNESS_EXECUTABLE:-}
if [[ -z "$executable" && -n "${HOME:-}" && -x "$HOME/.local/libexec/harness/harness" ]]; then
	executable="$HOME/.local/libexec/harness/harness"
fi
exec "${executable:-harness}" tracker "$@"
