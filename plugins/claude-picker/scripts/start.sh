#!/bin/bash
set -euo pipefail
plugin_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
bun_path="${HARNESS_PICKER_BUN:-$HOME/.bun/bin/bun}"
if [ ! -x "$bun_path" ]; then bun_path=$(command -v bun || true); fi
if [ -z "$bun_path" ] || [ ! -x "$bun_path" ]; then
 echo "Claude picker requires Bun >= 1.2. Install Bun, then reopen the session." >&2
 exit 1
fi
if [ ! -f "$plugin_root/dist/server.js" ] || [ ! -f "$plugin_root/dist/panel.html" ]; then
 echo "Claude picker build missing. In the Harness checkout run bun install and bun run build:picker, then refresh the local plugin." >&2
 exit 1
fi
exec "$bun_path" "$plugin_root/dist/server.js"
