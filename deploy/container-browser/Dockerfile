FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

# Pin the signed APT indices as well as the browser packages. Update both together.
# DOWNLOAD_KBPS caps the package download so a build never fills a home connection.
ARG DOWNLOAD_KBPS=10000
RUN rm -f /etc/apt/sources.list.d/debian.sources \
 && printf '%s\n' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20261120T000000Z/ bookworm main' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20261120T000000Z/ bookworm-security main' \
      > /etc/apt/sources.list \
 && apt-get -o Acquire::Retries=3 -o Acquire::http::Dl-Limit="$DOWNLOAD_KBPS" update \
 && apt-get -o Acquire::Retries=3 -o Acquire::http::Dl-Limit="$DOWNLOAD_KBPS" \
      install --yes --no-install-recommends \
      ca-certificates chromium=156.0.8078.79-1~deb12u1 fonts-liberation fonts-noto-color-emoji \
      fonts-noto-cjk novnc openbox socat tigervnc-standalone-server \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 browser \
 && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /profile --shell /usr/sbin/nologin browser \
 && mkdir /profile && chown browser:browser /profile && chmod 700 /profile

# The mode is set here because a checkout made under a strict umask is not readable by others.
COPY --chmod=0755 entrypoint.sh /opt/browser/entrypoint.sh
RUN install -d -m 0755 /etc/chromium/policies /etc/chromium/policies/managed
COPY --chmod=0644 managed-browser-policy.json /etc/chromium/policies/managed/harness.json
USER 10001:10001
ENTRYPOINT ["/bin/bash", "/opt/browser/entrypoint.sh"]
