FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc

# Pin the signed APT indices as well as the browser package. Update both together.
RUN rm -f /etc/apt/sources.list.d/debian.sources \
 && printf '%s\n' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20261120T000000Z/ bookworm main' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20261120T000000Z/ bookworm-security main' \
      > /etc/apt/sources.list \
 && apt-get -o Acquire::Retries=2 update \
 && apt-get install --yes --no-install-recommends \
      ca-certificates chromium=156.0.8078.79-1~deb12u1 fonts-liberation nftables python3 xvfb \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 vault-browser && groupadd --gid 10002 vault-proxy \
 && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /work --shell /usr/sbin/nologin vault-browser \
 && useradd --uid 10002 --gid 10002 --no-create-home --shell /usr/sbin/nologin vault-proxy \
 && mkdir /work

WORKDIR /opt/vault
COPY entrypoint.sh browser.py pipe_client.py proxy.py /opt/vault/
USER 10001:10001
ENTRYPOINT ["/bin/bash", "/opt/vault/entrypoint.sh"]
