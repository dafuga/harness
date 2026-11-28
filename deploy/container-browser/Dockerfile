FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS desktop

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
      ca-certificates fonts-liberation fonts-noto-color-emoji \
      fonts-noto-cjk novnc openbox socat tigervnc-standalone-server \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 browser \
 && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /profile --shell /usr/sbin/nologin browser \
 && mkdir /profile && chown browser:browser /profile && chmod 700 /profile

# The mode is set here because a checkout made under a strict umask is not readable by others.
COPY --chmod=0755 entrypoint.sh /opt/browser/entrypoint.sh

FROM desktop AS protected-chrome
# This ARM64 package checksum comes from Google's signed stable Packages index.
RUN test "$(dpkg --print-architecture)" = arm64 \
 && apt-get -o Acquire::Retries=3 -o Acquire::http::Dl-Limit="$DOWNLOAD_KBPS" update \
 && apt-get -o Acquire::Retries=3 -o Acquire::http::Dl-Limit="$DOWNLOAD_KBPS" \
      install --yes --no-install-recommends \
      at-spi2-core dbus gir1.2-atspi-2.0 python3-gi wget wmctrl x11-utils \
 && wget --quiet --timeout=30 --tries=3 --limit-rate="${DOWNLOAD_KBPS}k" -O /tmp/google-chrome.deb \
      https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_158.0.8127.88-1_arm64.deb \
 && printf '%s  %s\n' '6c7439981240ba7fb05c3534b4aa3ea3104ce388f300c2bbdf66884f8c554098' /tmp/google-chrome.deb | sha256sum --check \
 && apt-get -o Acquire::Retries=3 -o Acquire::http::Dl-Limit="$DOWNLOAD_KBPS" \
      install --yes --no-install-recommends /tmp/google-chrome.deb \
 && rm -f /tmp/google-chrome.deb /etc/apt/sources.list.d/google-chrome.list \
 && rm -rf /var/lib/apt/lists/*
COPY --chmod=0644 protected-chrome-policy.json /etc/opt/chrome/policies/managed/harness.json
COPY --chmod=0644 protected-chrome-health.py /opt/browser/protected-chrome-health.py
ENV HOME=/profile XDG_CONFIG_HOME=/profile/.config XDG_CACHE_HOME=/tmp/cache DISPLAY=:99 \
    DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/harness-chrome-session/bus ACCESSIBILITY_ENABLED=1
USER 10001:10001
ENTRYPOINT ["/bin/bash", "/opt/browser/entrypoint.sh", "protected-chrome"]

# The X adapter uses the default target and its existing Chromium profile.
FROM desktop AS chromium
RUN apt-get -o Acquire::Retries=3 -o Acquire::http::Dl-Limit="$DOWNLOAD_KBPS" update \
 && apt-get -o Acquire::Retries=3 -o Acquire::http::Dl-Limit="$DOWNLOAD_KBPS" \
      install --yes --no-install-recommends chromium=156.0.8078.79-1~deb12u1 \
 && rm -rf /var/lib/apt/lists/*
USER 10001:10001
ENTRYPOINT ["/bin/bash", "/opt/browser/entrypoint.sh"]
