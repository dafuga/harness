#!/usr/bin/env bash
# A full, headed Chromium on a virtual display. Nothing here listens beyond the container's own
# loopback: the host reaches the screen (5900) and DevTools (9222) only through `docker exec`.
# The browser is stock: no user agent, webdriver or fingerprint changes.
set -euo pipefail

export HOME=/profile XDG_CONFIG_HOME=/profile/.config XDG_CACHE_HOME=/tmp/cache DISPLAY=:99
size=${BROWSER_SCREEN:-600x1100}
[[ "$size" =~ ^[0-9]{3,4}x[0-9]{3,4}$ ]] || { echo 'BROWSER_SCREEN must be WIDTHxHEIGHT.' >&2; exit 1; }

# A recreated container has a new hostname, so a lock left in the saved profile is stale.
rm -f /profile/chromium/Singleton{Lock,Cookie,Socket}

# Authentication happens at the host gate; VNC itself is reachable only from inside this container.
Xvnc :99 -geometry "$size" -depth 24 -localhost -rfbport 5900 -SecurityTypes None \
  -AlwaysShared -nolisten tcp >/dev/null 2>&1 &
display=$!
for _ in $(seq 1 100); do
  [ -S /tmp/.X11-unix/X99 ] && break
  sleep 0.1
done
[ -S /tmp/.X11-unix/X99 ] || { echo 'The virtual display did not start.' >&2; exit 1; }
openbox >/dev/null 2>&1 &

chromium --user-data-dir=/profile/chromium --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 --no-first-run --no-default-browser-check \
  --password-store=basic --disable-gpu --disable-sync --hide-crash-restore-bubble \
  --window-position=0,0 --window-size="${size/x/,}" --start-maximized about:blank >/dev/null 2>&1 &
browser=$!

stop() { kill -TERM "$browser" 2>/dev/null; wait "$browser" 2>/dev/null; kill "$display" 2>/dev/null; exit 0; }
trap stop TERM INT
# Either one exiting ends the container, and Docker's restart policy brings both back.
wait -n "$browser" "$display"
exit 1
