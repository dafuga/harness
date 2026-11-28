"""Private exchange and refresh for the Harness Gmail self-send test."""

import hmac
import http.client
import json
import os
import re
import stat
import sys
import time
import urllib.parse
import urllib.request

PROJECT = 'harness-gmail-outgoing-test'
SCOPES = frozenset(f'https://www.googleapis.com/auth/gmail.{name}' for name in ('metadata', 'send'))
TOKEN = 'https://oauth2.googleapis.com/token'
GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/'
HEADER_FIELDS = 'messages(threadId,payload(headers(name,value)))'
HEADERS = ('Message-ID', 'Subject', 'References')
MAX_PACKET = 16384
TEST_WINDOW = 24 * 60 * 60


class GrantError(Exception):
    """A stopped exchange with no public provider or credential details."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def ensure(condition):
    if not condition:
        raise GrantError('Gmail test grant refused')


def parse(raw):
    ensure(len(raw) <= MAX_PACKET)
    data = json.loads(raw)
    ensure(isinstance(data, dict))
    return data


def private_record(path):
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as handle:
        info = os.fstat(handle.fileno())
        ensure(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and not info.st_mode & 0o077)
        return parse(handle.read(MAX_PACKET + 1))


def grant_target(directory):
    ensure(os.path.isabs(directory) and os.path.realpath(directory) == directory)
    parent = os.lstat(directory)
    ensure(stat.S_ISDIR(parent.st_mode) and parent.st_uid == os.getuid() and not parent.st_mode & 0o077)
    path = os.path.join(directory, 'gmail-self-test.json')
    ensure(not os.path.lexists(path) and not os.path.lexists(path + '.part'))
    return path


def write_grant(directory, record):
    path = grant_target(directory)
    temporary = path + '.part'
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as handle:
            json.dump(record, handle)
            handle.flush()
            os.fsync(handle.fileno())
        os.link(temporary, path)
    finally:
        os.unlink(temporary)


def matches(pattern, value):
    return isinstance(value, str) and re.fullmatch(pattern, value) is not None


def validate_policy(policy):
    ensure(set(policy) == {'project', 'clientId', 'account', 'threadId'} and policy['project'] == PROJECT)
    ensure(matches(r'[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', policy['clientId']))
    ensure(matches(r'[A-Za-z0-9._+\-]+@gmail\.com', policy['account']))
    ensure(matches(r'[0-9a-f]{1,128}', policy['threadId']))


def validate_callback(packet):
    keys = {'clientSecret', 'code', 'state', 'expectedState', 'codeVerifier', 'redirectUri'}
    ensure(set(packet) == keys)
    for key in ('state', 'expectedState', 'codeVerifier'):
        ensure(matches(r'[A-Za-z0-9._~-]{43,128}', packet[key]))
    ensure(hmac.compare_digest(packet['state'], packet['expectedState']))
    ensure(matches(r'http://127\.0\.0\.1:[1-9][0-9]{0,4}/', packet['redirectUri']))
    ensure(1 <= urllib.parse.urlsplit(packet['redirectUri']).port <= 65535)
    for key in ('code', 'clientSecret'):
        ensure(matches(r'[A-Za-z0-9._~/-]{1,4096}', packet[key]))


def checked_access(reply, require_scopes):
    if require_scopes or 'scope' in reply:
        ensure(isinstance(reply.get('scope'), str) and set(reply['scope'].split()) == SCOPES)
    ensure(isinstance(reply.get('token_type'), str) and reply['token_type'].lower() == 'bearer')
    token = reply.get('access_token')
    ensure(matches(r'[A-Za-z0-9._~-]{1,4096}', token))
    return token


def exchange(policy, packet, run_request, now):
    validate_policy(policy)
    validate_callback(packet)
    reply = run_request(TOKEN, {
        'grant_type': 'authorization_code',
        'client_id': policy['clientId'],
        'client_secret': packet['clientSecret'],
        'code': packet['code'],
        'code_verifier': packet['codeVerifier'],
        'redirect_uri': packet['redirectUri'],
    })
    access = checked_access(reply, require_scopes=True)
    refresh_token = reply.get('refresh_token')
    ensure(matches(r'[A-Za-z0-9._~/-]{1,4096}', refresh_token))
    check_thread(policy, access, run_request)
    lifetime = reply.get('refresh_token_expires_in', TEST_WINDOW)
    ensure(type(lifetime) is int and lifetime > 0)
    return {
        'policy': policy, 'clientSecret': packet['clientSecret'], 'refreshToken': refresh_token,
        'validUntil': now + min(lifetime, TEST_WINDOW),
    }


def check_thread(policy, access, run_request):
    query = [('format', 'metadata'), ('fields', HEADER_FIELDS)]
    query.extend(('metadataHeaders', header) for header in HEADERS)
    user = urllib.parse.quote(policy['account'], safe='')
    path = GMAIL + user + '/threads/' + policy['threadId']
    result = run_request(path + '?' + urllib.parse.urlencode(query), bearer=access)
    messages = result.get('messages')
    ensure(isinstance(messages, list) and messages)
    parent = messages[-1]
    ensure(parent['threadId'] == policy['threadId'])
    headers = {entry['name'].lower(): entry['value'] for entry in parent['payload']['headers']}
    ensure(headers.get('subject', '').startswith('[Harness test]') and bool(headers.get('message-id')))


def refresh(policy, grant, run_request, now):
    validate_policy(policy)
    ensure(grant.get('policy') == policy and now < grant['validUntil'])
    ensure(matches(r'[A-Za-z0-9._~/-]{1,4096}', grant.get('refreshToken')))
    ensure(matches(r'[A-Za-z0-9._~/-]{1,4096}', grant.get('clientSecret')))
    reply = run_request(TOKEN, {
        'grant_type': 'refresh_token',
        'client_id': policy['clientId'],
        'client_secret': grant['clientSecret'],
        'refresh_token': grant['refreshToken'],
    })
    return checked_access(reply, require_scopes=False)


def private_http(url, form=None, *, bearer=None):
    ensure(url == TOKEN or url.startswith(GMAIL))
    headers = {'Accept': 'application/json'}
    if bearer:
        headers['Authorization'] = 'Bearer ' + bearer
    body = urllib.parse.urlencode(form).encode() if form else None
    req = urllib.request.Request(url, headers=headers, data=body)
    with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect).open(req, timeout=8) as reply:
        return parse(reply.read(MAX_PACKET + 1))


def main(args):
    ensure(len(args) == 3 and args[0] in ('enroll', 'refresh'))
    mode, policy_path, target = args
    policy = private_record(policy_path)
    now = int(time.time())
    if mode == 'enroll':
        ensure(stat.S_ISFIFO(os.fstat(sys.stdin.fileno()).st_mode))
        grant_target(target)
        packet = parse(sys.stdin.buffer.read(MAX_PACKET + 1))
        write_grant(target, exchange(policy, packet, private_http, now))
        return
    # Token output is reserved for Tracker's private capture pipe.
    ensure(stat.S_ISFIFO(os.fstat(sys.stdout.fileno()).st_mode))
    access = refresh(policy, private_record(target), private_http, now)
    json.dump({'accessToken': access, 'account': policy['account'], 'threadId': policy['threadId']}, sys.stdout)


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (GrantError, OSError, ValueError, TypeError, KeyError, AttributeError, http.client.HTTPException):
        sys.exit('Harness Gmail grant operation refused.')
