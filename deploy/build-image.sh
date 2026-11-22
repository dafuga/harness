#!/usr/bin/env bash
set -euo pipefail
case "${1:-$(docker info --format '{{.Architecture}}')}" in
  aarch64|arm64)
    platform=arm64; digest=5f07e73c8822c93b47ee85fa5e228d7f7b45d3107f8c749f97da46e472efbf91 ;;
  x86_64|amd64)
    platform=amd64; digest=c0a93797ee78814ae6d32fcca2561fdbbe423149c3f5389aad32d86e9fd85bd4 ;;
  *) exit 2 ;;
esac
path="$(cd "$(dirname "$0")" && pwd)"
DOCKER_BUILDKIT=0 docker build --platform "linux/$platform" --label org.harness.image=deploy \
  --build-arg "TARGETARCH=$platform" --build-arg "NODE_IMAGE=node@sha256:$digest" \
  -t "harness-deploy:node24-wrangler4156-gcloud594-$platform" -f "$path/Dockerfile" "$path"
docker image inspect "harness-deploy:node24-wrangler4156-gcloud594-$platform" --format '{{.Id}}'
