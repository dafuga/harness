#!/usr/bin/env bash
# A stock browser on a virtual display. VNC listens on container loopback.
# Only the legacy Chromium target starts DevTools.
set -euo pipefail

export HOME=/profile XDG_CONFIG_HOME=/profile/.config XDG_CACHE_HOME=/tmp/cache DISPLAY=:99
size=${BROWSER_SCREEN:-600x1100}
[[ "$size" =~ ^[0-9]{3,4}x[0-9]{3,4}$ ]] || { echo 'BROWSER_SCREEN must be WIDTHxHEIGHT.' >&2; exit 1; }

case "$#" in
  0|1) ;;
  *) echo 'Expected one browser mode.' >&2; exit 1 ;;
esac
bus=
case "${1-chromium}" in
  chromium)
    profile=/profile/chromium
    launch=(chromium --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222
      --password-store=basic)
    ;;
  protected-chrome)
    profile=/profile/google-chrome
    launch=(setsid /usr/bin/google-chrome-stable --force-renderer-accessibility)
    install -d -m 700 "$profile"
    exec 9>"$profile/.harness-profile.lock"
    flock -n 9 || { echo 'The protected Chrome profile is already in use.' >&2; exit 1; }
    install -d -m 700 /tmp/harness-chrome-session
    rm -f /tmp/harness-chrome-session/bus
    dbus-daemon --session --address="$DBUS_SESSION_BUS_ADDRESS" --nofork >/dev/null 2>&1 &
    bus=$!
    for _ in $(seq 1 40); do
      [ -S /tmp/harness-chrome-session/bus ] && break
      sleep 0.05
    done
    [ -S /tmp/harness-chrome-session/bus ] || { echo 'The Chrome session bus did not start.' >&2; exit 1; }
    ;;
  *) echo 'Unrecognized browser mode.' >&2; exit 1 ;;
esac

# A recreated container has a new hostname, so a lock left in the saved profile is stale.
rm -f "$profile"/Singleton{Lock,Cookie,Socket}

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

"${launch[@]}" --user-data-dir="$profile" --no-first-run --no-default-browser-check \
  --disable-gpu --disable-sync --hide-crash-restore-bubble \
  --window-position=0,0 --window-size="${size/x/,}" --start-maximized about:blank >/dev/null 2>&1 &
browser=$!

close_protected_chrome() {
  local window
  for window in $(xprop -root _NET_CLIENT_LIST | grep -oE '0x[0-9a-f]+'); do
    if xprop -id "$window" _NET_WM_PID 2>/dev/null | grep -qE "= ${browser}$"; then
      wmctrl -ic "$window" >/dev/null 2>&1 || true
    fi
  done
  # The network service can still be writing the profile after the browser parent exits.
  for _ in $(seq 1 100); do
    kill -0 -- "-$browser" 2>/dev/null || return 0
    sleep 0.1
  done
}

stop() {
  if [[ -n "$bus" ]]; then
    close_protected_chrome
    kill -TERM -- "-$browser" 2>/dev/null || true
  fi
  kill -TERM "$browser" 2>/dev/null || true
  wait "$browser" 2>/dev/null || true
  kill "$display" 2>/dev/null || true
  if [[ -n "$bus" ]]; then kill "$bus" 2>/dev/null || true; fi
  exit 0
}
trap stop TERM INT
# Either one exiting ends the container, and Docker's restart policy brings both back.
wait -n "$browser" "$display" ${bus:+"$bus"}
exit 1
