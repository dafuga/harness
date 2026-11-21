#!/usr/bin/env bash
set -euo pipefail
input=$(cat)
route=$(jq -er '.route | select(test("^https://fluora-next(-stage)?\\.pages\\.dev$"))' <<<"$input")
version=$(jq -er '.observed.version | select(test("^[0-9a-f-]{36}$"))' <<<"$input")
source_sha=$(jq -er '.observed.source | select(test("^[0-9a-f]{40}$"))' <<<"$input")
artifact=$(jq -r '.observed.artifact // empty' <<<"$input")
request() { curl --proto '=https' -sS --max-time 10 --retry 1 "$@"; }
if [ -n "$artifact" ]; then
  request --fail "$route/_harness-release.json" | jq -e --arg source "$source_sha" \
    --arg artifact "$artifact" '.source == $source and .artifact == $artifact' >/dev/null
else
  alias="https://${version:0:8}.${route#https://}"
  request --fail "$alias/signin" > /tmp/alias
  request --fail "$route/signin" > /tmp/canonical
  test -s /tmp/canonical
  cmp -s /tmp/canonical /tmp/alias
fi
expect() { test "$(request -o /dev/null -w '%{http_code}' "$route$2")" = "$1"; }
expect 200 /
expect 200 /signin
expect 200 /api/auth/config
expect 401 /api/admin/adventures
expect 401 '/api/admin/vocabulary?language=pt'
expect 200 /fonts/inter/v20/inter-latin-wght-normal.woff2
expect 200 /adventure-assets/sets/pt-pt/rita-happy.webp
jq -n --arg version "$version" --arg source "$source_sha" --arg artifact "$artifact" \
  '{version:$version,source:$source,artifact:(if $artifact == "" then null else $artifact end),
    checks:["canonical-release","home","signin","auth-config","admin-denied","font","adventure-art"]}'
