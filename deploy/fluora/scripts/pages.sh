#!/usr/bin/env bash
# Runs only in the broker's confined provider container. The broker sends the token on stdin.
set -euo pipefail
set +x
input=$(cat)
token=$(jq -er '.credential | select(test("^[A-Za-z0-9_-]{25,150}$"))' <<<"$input")
operation=$(jq -er '.operation | select(. == "inspect" or . == "deploy" or . == "rollback")' <<<"$input")
target=$(jq -er '.environment | select(. == "staging" or . == "prod")' <<<"$input")
case "$target" in
  staging)
    project=fluora-next-stage
    database=bc7d3344-dc2f-4e41-ab67-cd80dcae4581
    bucket=fluora-adventure-assets-staging ;;
  prod)
    test "$operation" = inspect
    project=fluora-next
    database=f96a89e8-2f5b-473a-bce7-0ede5328794e
    bucket=fluora-adventure-assets ;;
esac
test "$(jq -er '.target' <<<"$input")" = "$project"
account=4fb6407a1de37e7bc90c5b1254f95dfe
api="https://api.cloudflare.com/client/v4/accounts/$account"
pages="/pages/projects/$project"
# curl reads its authorization header from an anonymous pipe and does not follow redirects.
cf() {
  printf 'header = "Authorization: Bearer %s"\n' "$token" |
    curl --config - --proto '=https' --fail --silent --max-time 12 "$@" |
    jq -ec 'select(.success == true).result'
}
project_snapshot() { cf "$api$pages"; }
route_version() { jq -er '.canonical_deployment.id'; }
observe() {
  config=$(project_snapshot)
  version=$(route_version <<<"$config")
  deployment=$(cf "$api$pages/deployments/$version")
  source_sha=$(jq -er '.deployment_trigger.metadata.commit_hash | select(test("^[a-f0-9]{40}$"))' <<< "$deployment")
  marker=$(curl --proto '=https' --silent --max-time 8 "https://$project.pages.dev/_harness-release.json" |
    jq -er --arg sha "$source_sha" 'select(.source == $sha).artifact | select(test("^[a-f0-9]{64}$"))' 2>/dev/null || true)
  schema=$(cf -H 'Content-Type: application/json' --data-binary \
    '{"sql":"SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name"}' \
    "$api/d1/database/$database/query" | jq -cS '.[0].results' | sha256sum | cut -d' ' -f1)
  ledger=$(cf -H 'Content-Type: application/json' --data-binary \
    '{"sql":"SELECT name FROM d1_migrations ORDER BY id"}' "$api/d1/database/$database/query" | jq -ec '.[0].results | map(.name)')
  lookup=$(jq -er '.migrationDigests' <<<"$input")
  migrations=$(jq -cn --argjson list "$ledger" --argjson hashes "$lookup" \
    '$list | map({name:.,digest:($hashes[.] // error("Unknown applied migration"))})')
  jq -cn --argjson config "$config" --argjson dep "$deployment" --arg target "$project" \
    --arg source "$source_sha" --arg artifact "$marker" --arg schema "$schema" --argjson migrations "$migrations" \
    --argjson now "$(date +%s%3N)" '
     def binding($type): to_entries | map({key,value:($type + ":" + (.value.id // .value.name // error("Missing binding target")))}) | from_entries;
     ($config.deployment_configs.production) as$profile
     | if ($dep.environment) != "production" or ($dep.latest_stage.status) != "success"
          or ($config.production_branch) != "main" then error("Invalid canonical deployment") else . end
     | {target:$target,version:$dep.id,source:$source,artifact:($artifact | if . == "" then null else . end),observedAt:$now,
        profile:{bindings:(($profile.d1_databases // {} | binding("d1")) + ($profile.r2_buckets // {} | binding("r2"))),
         secretNames:(($profile.env_vars // {}) | to_entries | map(select(.value.type == "secret_text").key) | sort),
         migrations:$migrations,
         runtimes:{compatibility_date:$profile.compatibility_date},
         flags:((($profile.compatibility_flags // []) | map({key:.,value:"enabled"}) | from_entries)
            + {schema:$schema, migrationEvidence:"provider-ledger-and-schema"})}}'
}
case "$operation" in
  inspect) observe ;;
  deploy)
    jq -e --arg target "$project" '.plan.environment == "staging" and .plan.target == $target and .plan.action == "deploy"' <<<"$input" >/dev/null
    current=$(project_snapshot | route_version)
    test "$current" = "$(jq -er '.plan.previous.version' <<<"$input")"
    artifact=$(jq -er '.plan.release.artifact | select(test("^[a-f0-9]{64}$"))' <<<"$input")
    source_sha=$(jq -er '.plan.release.source | select(test("^[a-f0-9]{40}$"))' <<<"$input")
    test "$(sha256sum /artifact | cut -d' ' -f1)" = "$artifact"
    mkdir /tmp/upload
    tar -xf /artifact -C /tmp/upload --no-same-owner --no-same-permissions
    test "$(cat /tmp/upload/source)" = "$source_sha"
    jq -cn --arg source "$source_sha" --arg artifact "$artifact" '{source:$source,artifact:$artifact}' >/tmp/upload/site/_harness-release.json
    if [ -f /tmp/upload/site/_routes.json ]; then
      jq -ec 'select(.version == 1) | .exclude += ["/_harness-release.json"]'         /tmp/upload/site/_routes.json >/tmp/harness-routes.json
      mv /tmp/harness-routes.json /tmp/upload/site/_routes.json
    fi
    cd /tmp/upload
    # Generate the exact staging resource mapping. Only the reviewed artifact site is uploaded.
    cat >wrangler.toml <<CONFIG
name = "$project"
compatibility_date = "2026-10-01"
compatibility_flags = ["nodejs_compat_v2"]
pages_build_output_dir = "site"
[[d1_databases]]
binding = "DB"
database_id = "$database"
database_name = "fluora-stage"
[[r2_buckets]]
binding = "ADVENTURE_ASSETS"
bucket_name = "$bucket"
CONFIG
    CLOUDFLARE_API_TOKEN="$token" CLOUDFLARE_ACCOUNT_ID="$account" WRANGLER_LOG=none \
      WRANGLER_SEND_METRICS=false wrangler pages deploy site --project-name "$project" --branch main \
      --commit-hash "$source_sha" --commit-dirty=true >/dev/null 2>&1
    observed=$(observe)
    jq -cn --argjson observed "$observed" '{operation:$observed.version,observed:$observed}'
    ;;
  rollback)
    jq -e --arg target "$project" '.plan.environment == "staging" and .plan.target == $target and .plan.action == "rollback"' <<<"$input" >/dev/null
    current=$(project_snapshot | route_version)
    test "$current" = "$(jq -er '.plan.previous.version' <<<"$input")"
    restore=$(jq -er '.plan.restore.version | select(test("^[0-9a-f-]{36}$"))' <<<"$input")
    cf -X POST "$api$pages/deployments/$restore/rollback" >/dev/null
    observed=$(observe)
    jq -cn --argjson observed "$observed" '{operation:$observed.version,observed:$observed}'
    ;;
esac
