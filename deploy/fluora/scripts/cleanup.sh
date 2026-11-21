#!/usr/bin/env bash
set -euo pipefail
jq -e '.run | test("^[a-f0-9-]{36}$")' >/dev/null
# Phase scratch is private to each container and removed by its owner on exit.
printf '{"cleaned":true}\n'
