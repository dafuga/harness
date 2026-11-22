#!/usr/bin/env bash
set -euo pipefail

[ "$#" -eq 1 ] || { echo 'Usage: build-peer.sh /absolute/path/peer.node' >&2; exit 2; }
case "$1" in /*.node) ;; *) exit 2 ;; esac
source_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
node_prefix=$(node -p 'require("path").dirname(require("path").dirname(process.execPath))')
headers=${NODE_INCLUDE_DIR:-$node_prefix/include/node}
[ -f "$headers/node_api.h" ] || { echo 'Set NODE_INCLUDE_DIR to the matching Node headers.' >&2; exit 1; }
case "$(uname -s)" in
  Darwin) set -- -bundle -undefined dynamic_lookup -o "$1" ;;
  Linux) set -- -shared -fPIC -o "$1" ;;
  *) echo 'Unix peer UID is supported on macOS and Linux.' >&2; exit 1 ;;
esac
umask 077
cc "$@" -Wall -Wextra -Werror -I "$headers" "$source_dir/peercred.c"
