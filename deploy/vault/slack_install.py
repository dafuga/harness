"""Exchange a Vault-approved BuildFlexity OAuth callback and store the bot token."""

import base64
import os
import pwd
import re
from pathlib import Path
from urllib.parse import urlencode, urlsplit

import slack_binding as binding
import slack_bot_token as bot
from private_provider_http import ProviderError, executor_main, request_json

ORIGIN = 'https://slack.com'
FIELDS = {'app_id', 'workspace_id', 'client_id', 'client_secret', 'code', 'redirect_uri'}
ALLOWED_SCOPES = {'chat:write', 'incoming-webhook'}


def validate_packet(packet):
    if packet['app_id'] != binding.BINDING['appId'] or packet['workspace_id'] != binding.BINDING['workspaceId']:
        raise ProviderError('wrong-slack-installation')
    patterns = {'client_id': r'[0-9]{1,30}\.[0-9]{1,30}',
                'client_secret': r'[a-zA-Z0-9_-]{16,256}', 'code': r'[a-zA-Z0-9._-]{8,1024}'}
    if any(not isinstance(packet[field], str) or not re.fullmatch(pattern, packet[field])
           for field, pattern in patterns.items()):
        raise ProviderError('invalid-slack-approval-packet')
    redirect = packet['redirect_uri']
    if redirect is None:
        return
    if not isinstance(redirect, str) or len(redirect) > 500 or re.search(r'\s', redirect):
        raise ProviderError('invalid-slack-redirect')
    target = urlsplit(redirect)
    if target.scheme != 'https' or not target.hostname or target.username or target.fragment or target.query:
        raise ProviderError('invalid-slack-redirect')


def exchange(origin, packet):
    credentials = f"{packet['client_id']}:{packet['client_secret']}".encode('ascii')
    parameters = {'code': packet['code']}
    if packet['redirect_uri'] is not None:
        parameters['redirect_uri'] = packet['redirect_uri']
    headers = {'Authorization': 'Basic ' + base64.b64encode(credentials).decode('ascii'),
               'Content-Type': 'application/x-www-form-urlencoded'}
    data = urlencode(parameters).encode()
    result, _ = request_json(origin, '/api/oauth.v2.access', 'POST', data=data, headers=headers)
    return result


def verify_installation(origin, packet):
    result = exchange(origin, packet)
    if not binding.USER_ID.fullmatch(str(result.get('bot_user_id'))):
        raise ProviderError('slack-oauth-bot-identity-unverified')
    try:
        claims = bot.claims_from(result, None, None)
        token, _, _, scopes = claims
        if 'chat:write' not in scopes or scopes - ALLOWED_SCOPES or result.get('is_enterprise_install') is True:
            raise ProviderError('slack-oauth-grant-outside-approved-scope')
        if result.get('refresh_token') or result.get('expires_in'):
            raise ProviderError('slack-rotating-token-needs-vault-refresh-binding')
        identity = bot.verify(origin + '/api/', claims, allowed_scopes=ALLOWED_SCOPES)
    except bot.Failure as error:
        raise ProviderError(error.code) from None
    receipt = bot.receipt_for(identity, None)
    return token.encode('ascii'), receipt


def install_into_binding(packet, root, origin):
    validate_packet(packet)
    directory = Path(binding.binding_directory(root))
    with binding.binding_write_lock(directory):
        if any(os.path.lexists(directory / name) for name in ('bot.token', 'bot.receipt.json')):
            raise ProviderError('slack-binding-exists-check-before-retrying')
        token, receipt = verify_installation(origin, packet)
        binding.store_in_locked_binding(directory, receipt, token)
    return receipt


def issue(packet, root, origin=ORIGIN):
    try:
        return install_into_binding(packet, root, origin)
    except binding.BindingError:
        raise ProviderError('slack-binding-rejected-check-provider-state') from None


if __name__ == '__main__':
    home = Path(pwd.getpwuid(os.getuid()).pw_dir)
    root = home / '.local' / 'state' / 'harness' / 'vault'
    raise SystemExit(executor_main(lambda packet: issue(packet, root), FIELDS))
