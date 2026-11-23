#!/bin/bash
# Runs the reviewed synthetic Chromium fixture across two MB2 Unix identities.
set -euo pipefail
umask 077
export PATH=/usr/bin:/bin:/usr/sbin:/sbin LC_ALL=C

executor=harness-vault
executor_home=/Users/harness-vault
requester=_www
docker=/opt/homebrew/bin/docker
node=/opt/homebrew/bin/node
socket=$executor_home/.colima/$executor/docker.sock

fail() { printf '%s\n' "$*" >&2; exit 1; }

copy_fixture() {
  local name=$1 hash=$2 mode=$3 file=$work/$1
  [[ "$hash" =~ ^[0-9a-f]{64}$ ]] || fail 'Expected a frozen fixture SHA-256.'
  /bin/cp -P "$stage/$name" "$file"
  [ -f "$file" ] && [ ! -L "$file" ] || fail 'Expected a regular fixture file.'
  printf '%s  %s\n' "$hash" "$file" | shasum -a 256 -c --status || fail 'Fixture checksum mismatch.'
  chmod "$mode" "$file"
}

as_executor() {
  sudo -n -H -u "$executor" -- /usr/bin/env -i HOME="$executor_home" USER="$executor" \
    LOGNAME="$executor" DOCKER_CONFIG="$executor_home/.docker" TMPDIR=/tmp LC_ALL=C \
    PATH="$work:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin" "$@"
}

as_requester() {
  sudo -n -u "$requester" -- /usr/bin/env -i HOME=/var/empty USER="$requester" LOGNAME="$requester" \
    PATH=/usr/bin:/bin:/usr/sbin:/sbin LC_ALL=C "$@"
}

check_accounts() {
  local name listing
  [ "$(id -u "$requester")" = 70 ] || fail 'The dedicated fixture requester UID differs.'
  [ "$(id -u "$executor")" -ge 550 ] && [ "$(id -u "$executor")" -le 600 ] ||
    fail 'The Vault executor account differs.'
  for name in "$executor" "$requester"; do
    if id -Gn "$name" | tr ' ' '\n' | grep -Ex 'root|admin|wheel|sudo|docker' >/dev/null; then
      fail 'A fixture account is privileged.'
    fi
    listing=$(sudo -n -l -U "$name" 2>&1) || true
    printf '%s\n' "$listing" | grep -F "User $name is not allowed to run sudo" >/dev/null ||
      fail 'A fixture account has sudo privileges or its sudo policy could not be verified.'
  done
  ! as_requester /bin/test -x "$executor_home" || fail 'The requester can traverse the executor home.'
}

find_image() {
  local endpoint
  endpoint=$(as_executor "$docker" context inspect "$executor" --format '{{.Endpoints.docker.Host}}')
  [ "$endpoint" = "unix://$socket" ] || fail 'The Docker context differs from the dedicated socket.'
  as_executor "$docker" --context "$executor" image inspect --format '{{.Id}}' harness-vault:qualification
}

run_fixture() {
  local image=$1
  mkfifo "$work/commands" "$work/replies"
  as_requester "$node" "$work/client.cjs" <"$work/commands" >"$work/replies" &
  requester_pid=$!
  as_executor /bin/bash -c '
    set -euo pipefail
    cd "$1/source"
    export HARNESS_TEST_VAULT_DOCKER_IMAGE="$2" HARNESS_TEST_VAULT_DOCKER_CONTEXT=harness-vault
    export HARNESS_TEST_VAULT_CROSS_USER_DIR="$1/run" HARNESS_TEST_VAULT_CROSS_USER_UID=70
    exec 3>&1 4<&0 1>&2
    exec "$3" node_modules/vitest/vitest.mjs run --pool=threads --poolOptions.threads.singleThread \
      test/credential-vault-browser.e2e.test.ts -t "reviewed sms OTP"
  ' _ "$work" "$image" "$node" >"$work/commands" <"$work/replies"
  wait "$requester_pid"
  requester_pid=
}

cleanup() {
  if [ -n "$requester_pid" ]; then
    kill "$requester_pid" 2>/dev/null || true
    wait "$requester_pid" 2>/dev/null || true
  fi
  rm -rf -- "$work"
}

[ "$#" -eq 4 ] || fail 'Usage: mb2-cross-user.sh <stage> <source SHA-256> <client SHA-256> <Bun SHA-256>'
[ "$(uname -s)" = Darwin ] && [ "$(scutil --get LocalHostName)" = Daniels-MacBook-Pro ] || fail 'Run on MB2.'
[ "$(id -u)" = 0 ] || fail 'This one-shot fixture requires sudo on MB2.'
stage=$1
case "$stage" in /Users/Shared/harness-vault-jw0799) ;; *) fail 'Unexpected fixture staging directory.' ;; esac
work=$(mktemp -d /private/tmp/hv-jw0799.XXXXXXXX)
requester_pid=
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
chmod 711 "$work"
copy_fixture source.tgz "$2" 444
copy_fixture client.cjs "$3" 444
copy_fixture bun "$4" 555
check_accounts
image=$(find_image)
[[ "$image" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 'The dedicated image ID could not be verified.'
install -d -o "$executor" -g "$executor" -m 700 "$work/source"
install -d -o "$executor" -g "$executor" -m 711 "$work/run"
as_executor /bin/bash -c '
  set -euo pipefail
  cd "$1/source"
  tar --no-same-owner -xpzf "$1/source.tgz"
  bun install --frozen-lockfile
' _ "$work"
run_fixture "$image"
printf '%s\n' 'Synthetic two-UID CDP handoff and teardown passed on MB2.'
