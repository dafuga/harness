"""Reviewed producer for the BuildFlexity Alerts Slack bot token (secret_pipe recipe `slack-bot-token`).

It reads one private packet, checks the installation against the pinned binding with
`auth.test` and writes `{"token": ...}` to stdout for `secret_pipe.transfer`. A metadata-only
receipt goes to `--receipt` (mode 0600). Stdout carries nothing else, and no error text holds
the credential or a Slack response body.

Packet forms, both read from a private 0600 file (or `-` for stdin outside secret_pipe):
  OAuth result  {"ok": true, "access_token": "xoxb-...", "token_type": "bot", "scope": "...",
                 "bot_user_id": "U...", "app_id": "A...", "team": {"id": "T..."}}
  Bare token    {"token": "xoxb-..."}  (needs --expect-bot-id and --expect-bot-user-id)
"""

import json
import os
import sys
import urllib.parse

import slack_binding as pins
from private_provider_http import ProviderError, request_json

API = 'https://slack.com/api/'


class Failure(Exception):
    """Carries a fixed receipt code."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def slack_call(base, method, token, params=None):
    """POST a Slack Web API method and return (body, granted scopes). Redirects are refused."""
    parts = urllib.parse.urlsplit(base)
    origin = urllib.parse.urlunsplit((parts.scheme, parts.netloc, '', '', ''))
    body = urllib.parse.urlencode(params or {}).encode()
    headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/x-www-form-urlencoded',
    }
    try:
        payload, response_headers = request_json(origin, parts.path + method, 'POST', data=body, headers=headers)
    except ProviderError:
        raise Failure('slack-unreachable') from None
    header = response_headers.get('x-oauth-scopes') or ''
    return payload, {scope.strip() for scope in header.split(',') if scope.strip()}


def read_packet(path):
    try:
        raw = sys.stdin.buffer.read(8192) if path == '-' else pins.read_private(path, 8192)
        packet = json.loads(raw)
    except (OSError, ValueError):
        raise Failure('packet-unreadable') from None
    if not isinstance(packet, dict):
        raise Failure('packet-unreadable')
    return packet


def claims_from(packet, expect_bot, expect_user):
    """Return (token, expected bot ID, expected bot-user ID, scopes) from either packet form."""
    token = packet.get('access_token', packet.get('token'))
    if not isinstance(token, str) or not pins.TOKEN.fullmatch(token):
        raise Failure('not-a-bot-token')
    if 'access_token' not in packet:
        if not (expect_bot and expect_user):
            raise Failure('app-identity-unproven')
        return token, expect_bot, expect_user, set()
    team = packet.get('team')
    if not (
        packet.get('ok') is True and packet.get('token_type') == 'bot'
        and packet.get('app_id') == pins.BINDING['appId']
        and isinstance(team, dict) and team.get('id') == pins.BINDING['workspaceId']
    ):
        raise Failure('oauth-result-mismatch')
    scopes = {scope for scope in str(packet.get('scope', '')).split(',') if scope}
    return token, expect_bot, packet.get('bot_user_id') or expect_user, scopes


def verify(base, claims, *, allowed_scopes=None):
    """Check auth.test and the private channel for (token, bot ID, bot-user ID, scopes)."""
    token, expect_bot, expect_user, scopes = claims
    identity, header = slack_call(base, 'auth.test', token)
    scopes = scopes | header
    if allowed_scopes is not None and scopes - allowed_scopes:
        raise Failure('slack-oauth-grant-outside-approved-scope')
    if identity.get('ok') is not True or identity.get('team_id') != pins.BINDING['workspaceId']:
        raise Failure('identity-mismatch')
    bot_id, user_id = identity.get('bot_id'), identity.get('user_id')
    if not (pins.BOT_ID.match(str(bot_id)) and pins.USER_ID.match(str(user_id))):
        raise Failure('not-a-bot-identity')
    if (expect_bot and bot_id != expect_bot) or (expect_user and user_id != expect_user):
        raise Failure('identity-mismatch')
    if 'chat:write' not in scopes:
        raise Failure('chat-write-missing')
    return {'botId': bot_id, 'botUserId': user_id, 'membership': membership(base, token, scopes)}


def membership(base, token, scopes):
    if 'groups:read' not in scopes:
        return 'unverified-no-groups-read'
    info, _ = slack_call(base, 'conversations.info', token, {'channel': pins.BINDING['channelId']})
    channel = info.get('channel')
    if info.get('ok') is not True or not isinstance(channel, dict) or channel.get('is_member') is not True:
        raise Failure('not-a-channel-member')
    return 'member'


def receipt_for(fields, code):
    receipt = {
        'binding': pins.binding_id(), 'result': 'FAIL' if code else 'PASS',
        'appId': pins.BINDING['appId'], 'workspaceId': pins.BINDING['workspaceId'],
        'channelId': pins.BINDING['channelId'], 'chatWrite': not code, **fields,
    }
    if code:
        receipt['code'] = code
    return receipt


def produce(args, base=API, out=None):
    """Return the exit status. Write the credential packet to `out` only after every check passes."""
    out = out or sys.stdout.buffer
    fields, code, token = {}, None, ''
    try:
        packet = read_packet(args['packet'])
        if args['packet'] != '-':
            os.unlink(args['packet'])
        claims = claims_from(packet, args.get('bot'), args.get('user'))
        token = claims[0]
        packet.clear()
        fields = verify(base, claims)
    except Failure as failure:
        code = failure.code
    pins.write_private(args['receipt'], json.dumps(receipt_for(fields, code), sort_keys=True).encode())
    if code:
        return 1
    out.write(b'{"token":"' + token.encode() + b'"}')
    out.flush()
    return 0


def main(argv):
    names = {'--packet': 'packet', '--receipt': 'receipt', '--expect-bot-id': 'bot', '--expect-bot-user-id': 'user'}
    if len(argv) % 2 or any(flag not in names for flag in argv[::2]):
        return 2
    args = {names[flag]: value for flag, value in zip(argv[::2], argv[1::2])}
    if 'packet' not in args or 'receipt' not in args:
        return 2
    try:
        return produce(args)
    except OSError:
        return 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
