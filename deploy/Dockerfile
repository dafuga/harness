# The two supported Node image manifests come from the same reviewed upstream release.
ARG NODE_IMAGE=node@sha256:5f07e73c8822c93b47ee85fa5e228d7f7b45d3107f8c749f97da46e472efbf91
FROM ${NODE_IMAGE}
ARG TARGETARCH
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends ca-certificates curl git jq python3 \
 && rm -rf /var/lib/apt/lists/*
RUN npm install --global --no-audit --no-fund --allow-scripts=bun,esbuild,workerd bun@1.4.5 wrangler@4.156.0
RUN set -eu; \
    case "$TARGETARCH" in \
      arm64) arch=arm; checksum=e58fb86fff3dfd7101e1ff138f06bd4e338c7bf12a7508a7871985e7ea886275 ;; \
      amd64) arch=x86_64; checksum=1f7233537c26bba94a3ea3f9085a60396745eaf44b21b8454fc6fdd15bb6fcde ;; \
      *) exit 2 ;; \
    esac; \
    curl --proto '=https' -fsSL --retry 2 "https://storage.googleapis.com/cloud-sdk-release/google-cloud-cli-594.0.0-linux-$arch.tar.gz" -o /tmp/gcloud.tgz; \
    echo "$checksum  /tmp/gcloud.tgz" | sha256sum -c -; \
    tar -xzf /tmp/gcloud.tgz -C /opt; \
    rm /tmp/gcloud.tgz
ENV PATH="/opt/google-cloud-sdk/bin:${PATH}"
ENV CLOUDSDK_CORE_DISABLE_PROMPTS=1 CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK=1
RUN bun --version && wrangler --version && gcloud version
USER 65532:65532
