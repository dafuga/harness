#!/bin/sh
set -eu

source_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
source_skill="$source_dir/secret-safe-computer-use/SKILL.md"
codex_config=${CODEX_HOME:-"$HOME/.codex"}
claude_config=${CLAUDE_CONFIG_DIR:-"$HOME/.claude"}
umask 077

for config in "$codex_config" "$claude_config"; do
    destination="$config/skills/secret-safe-computer-use"
    mkdir -p "$destination"
    temporary=$(mktemp "$destination/.skill.XXXXXXXX")
    trap 'rm -f "$temporary"' EXIT
    trap 'exit 1' HUP INT TERM
    cat "$source_skill" > "$temporary"
    mv -f "$temporary" "$destination/SKILL.md"
    trap - EXIT HUP INT TERM
done
