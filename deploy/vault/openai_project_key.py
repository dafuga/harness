"""Issue the restricted Fluora Demo key from a trusted OpenAI Admin API pipe."""

import fcntl
import json
import os
import pwd
import re
import stat
import tempfile
import time
from pathlib import Path

from private_provider_http import ProviderError, executor_main, request_json

ORIGIN = 'https://api.openai.com'
PROJECT_NAME = 'Fluora Demo'
KEY_NAME = 'Fluora Demo Realtime'
KEY_OBJECT = 'organization.project.service_account.api_key'
SCOPE = 'api.model.request'
LIFETIME = 24 * 60 * 60
LIMIT = {'threshold_amount': 500, 'currency': 'USD', 'interval': 'month'}
FIELDS = {'project_id', 'service_account_id', 'admin_key'}


def openai_request(origin, admin_key):
    headers = {'Authorization': 'Bearer ' + admin_key, 'Content-Type': 'application/json'}
    prefix = '/v1/organization/projects/'

    def call(path, method='GET', payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        result, _ = request_json(origin, prefix + path, method, headers=headers, data=data)
        return result
    return call


def identifier(value, prefix):
    return isinstance(value, str) and re.fullmatch(prefix + r'[A-Za-z0-9_-]{1,100}', value)


def validate_target(call, project_id, account_id):
    project = call(project_id)
    if any(project.get(key) != value for key, value in {
        'id': project_id, 'name': PROJECT_NAME, 'status': 'active', 'object': 'organization.project'
    }.items()):
        raise ProviderError('wrong-openai-project')
    account = call(f'{project_id}/service_accounts/{account_id}')
    if account.get('id') != account_id or account.get('object') != 'organization.project.service_account':
        raise ProviderError('wrong-openai-service-account')
    keys = call(f'{project_id}/api_keys?limit=100')
    rows = keys.get('data')
    if keys.get('has_more') is not False or not isinstance(rows, list):
        raise ProviderError('cannot-check-existing-openai-keys')
    if any(not isinstance(row, dict) or row.get('name') == KEY_NAME for row in rows):
        raise ProviderError('verify-existing-openai-key-before-retrying')


def enforce_limit(call, project_id):
    path = f'{project_id}/spend_limit'
    call(path, 'POST', LIMIT)
    active = call(path)
    if (active.get('object') != 'project.spend_limit' or
            active.get('enforcement') != {'status': 'enforcing'} or
            any(active.get(key) != value for key, value in LIMIT.items())):
        raise ProviderError('openai-hard-limit-not-verified')


def publish_env(destination, secret):
    if not re.fullmatch(r'sk-[A-Za-z0-9_-]{8,1024}', secret):
        raise ProviderError('invalid-openai-key-value')
    fd, staging = tempfile.mkstemp(prefix='.fluora-demo-', dir=destination.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(b'OPENAI_API_KEY=' + secret.encode('ascii') + b'\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.link(staging, destination, follow_symlinks=False)
    finally:
        os.unlink(staging)


def revoke_failed_key(call, project_id, key_id):
    try:
        deleted = call(f'{project_id}/api_keys/{key_id}', 'DELETE')
    except ProviderError:
        deleted = {}
    if deleted.get('id') == key_id and deleted.get('deleted') is True:
        raise ProviderError('openai-delivery-failed-key-revoked')
    raise ProviderError('openai-delivery-failed-check-provider-state') from None


def mint(call, project_id, account_id, destination):
    path = f'{project_id}/service_accounts/{account_id}/api_keys'
    issued_at = int(time.time())
    created = call(path, 'POST', {'name': KEY_NAME, 'scopes': [SCOPE], 'expires_in_seconds': LIFETIME})
    key_id = created.get('id')
    if not identifier(key_id, 'key_') or created.get('object') != KEY_OBJECT or created.get('name') != KEY_NAME:
        raise ProviderError('openai-key-response-uncertain-check-provider-state')
    expiry = created.get('expires_at')
    try:
        if type(expiry) is not int or not issued_at < expiry <= issued_at + LIFETIME + 60:
            raise ProviderError('openai-key-expiry-unverified')
        publish_env(destination, created.get('value'))
    except (OSError, ProviderError, TypeError):
        revoke_failed_key(call, project_id, key_id)
    return {'projectId': project_id, 'serviceAccountId': account_id, 'keyId': key_id,
            'scope': SCOPE, 'expiresAt': expiry, 'monthlyHardLimitCents': LIMIT['threshold_amount']}


def issue(packet, destination, origin=ORIGIN):
    project_id, account_id, admin_key = (packet[name] for name in ('project_id', 'service_account_id', 'admin_key'))
    if not (identifier(project_id, 'proj_') and identifier(account_id, 'svc_acct_') and
            isinstance(admin_key, str) and re.fullmatch(r'sk-admin-[A-Za-z0-9_-]{8,1024}', admin_key)):
        raise ProviderError('invalid-openai-approval-packet')
    handle = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        directory = os.fstat(handle)
        if directory.st_uid != os.getuid() or directory.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
            raise ProviderError('unsafe-openai-destination')
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if os.path.lexists(destination):
            raise ProviderError('openai-destination-exists')
        call = openai_request(origin, admin_key)
        validate_target(call, project_id, account_id)
        enforce_limit(call, project_id)
        return mint(call, project_id, account_id, destination)
    finally:
        os.close(handle)


if __name__ == '__main__':
    home = Path(pwd.getpwuid(os.getuid()).pw_dir)
    raise SystemExit(executor_main(lambda packet: issue(packet, home / '.secrets' / 'openai.env'), FIELDS))
