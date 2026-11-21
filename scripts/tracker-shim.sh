#!/usr/bin/env bash
set -euo pipefail
exec "${HARNESS_EXECUTABLE:-harness}" tracker "$@"
