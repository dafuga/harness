#!/usr/bin/env bash
set -euo pipefail

# NET_ADMIN is needed only here. Long-running programs get an empty bounding set.
[ "$(id -u)" = 0 ] || { echo 'Vault egress bootstrap requires its confined setup user.' >&2; exit 1; }
[ -n "$VAULT_NFT_RULES" ] && [ -n "$VAULT_PROXY_HOSTS" ]
printf '%s\n' "$VAULT_NFT_RULES" | /usr/sbin/nft -f -
unset VAULT_NFT_RULES
mkdir -m 1777 /tmp/.X11-unix

/usr/bin/setpriv --reuid=10002 --regid=10002 --clear-groups --bounding-set=-all \
  --inh-caps=-all --ambient-caps=-all --no-new-privs /usr/bin/python3 /opt/vault/proxy.py &
export HOME=/work XDG_CONFIG_HOME=/work XDG_CACHE_HOME=/work DISPLAY=:99
unset VAULT_PROXY_HOSTS
exec /usr/bin/setpriv --reuid=10001 --regid=10001 --clear-groups --bounding-set=-all \
  --inh-caps=-all --ambient-caps=-all --no-new-privs /usr/bin/python3 /opt/vault/browser.py
