#!/usr/bin/env bash
set -euo pipefail
source_sha=$(jq -er '.source | select(test("^[a-f0-9]{40}$"))')
export BUN_INSTALL_CACHE_DIR=/tmp/bun-cache
export WRANGLER_SEND_METRICS=false
mkdir -p /tmp/fluora /tmp/release/site /tmp/release/config
tar -xf /source -C /tmp/fluora --exclude='./.wrangler' --exclude='.wrangler'
cd /tmp/fluora
engine=$(sed -n -E 's|.*git\+ssh://git@github.com/dafuga/conversation-engine\.git#([a-f0-9]{40}).*|\1|p' bun.lock | sort -u)
[[ "$engine" =~ ^[a-f0-9]{40}$ ]]
test "$(git --git-dir=/deps/conversation-engine.git rev-parse HEAD)" = "$engine"
git config --global protocol.file.allow always
for remote in https://github.com/dafuga/conversation-engine.git ssh://git@github.com/dafuga/conversation-engine.git; do
  git config --global --add url.file:///deps/conversation-engine.git.insteadOf "$remote"
done
bun install --frozen-lockfile >&2
bun run test:unit --maxWorkers 2 >&2
bun run build:web >&2
test -e .svelte-kit/cloudflare/_worker.js
cp -a .svelte-kit/cloudflare/. /tmp/release/site/
cp wrangler.toml /tmp/release/config/staging.toml
cp wrangler.prod.toml /tmp/release/config/prod.toml
cp -a migrations /tmp/release/migrations
printf '%s\n' "$source_sha" >/tmp/release/source
migration_manifest=$(for file in migrations/*.sql; do
  jq -cn --arg name "${file##*/}" --arg digest "$(sha256sum "$file" | cut -d' ' -f1)" '{name:$name,digest:$digest}'
done | jq -cs .)
tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -cf /out/artifact.tar -C /tmp/release .
jq -n --arg node "$(node --version)" --arg bun "$(bun --version)" \
  --arg wrangler "$(wrangler --version | tail -1)" \
  --arg gcloud "$(gcloud version --format=json | jq -er '.["Google Cloud SDK"]')" \
  --argjson migrations "$migration_manifest" '{node:$node,bun:$bun,wrangler:$wrangler,gcloud:$gcloud,migrations:$migrations}'
