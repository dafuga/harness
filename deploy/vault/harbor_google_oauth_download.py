"""Transfer one newly downloaded Chrome export from the owner-only Downloads directory."""

import json
import os
from pathlib import Path
import re
import resource
import stat
import sys
import tempfile
import time

from private_provider_http import ProviderError, read_object

PROJECT = 'harbor-calendar-oauth-test'
DESTINATION = 'harbor-google-oauth-test.json'
EXPORT_NAME = re.compile(r'client_secret_([A-Za-z0-9-]{1,150}\.apps\.googleusercontent\.com)\.json')
DUMMY_ID = 'harness-canary.apps.googleusercontent.com'


def validate(packet, canary):
    client = packet.get('installed')
    if set(packet) != {'installed'} or not isinstance(client, dict):
        raise ProviderError('wrong-client-type')
    if client.get('project_id') != PROJECT:
        raise ProviderError('wrong-project')
    client_id = client.get('client_id')
    if not isinstance(client_id, str) or not re.fullmatch(
        r'[A-Za-z0-9-]{1,150}\.apps\.googleusercontent\.com', client_id
    ):
        raise ProviderError('invalid-client-id')
    if (client_id == DUMMY_ID) != canary:
        raise ProviderError('wrong-execution-mode')
    secret = client.get('client_secret')
    if not isinstance(secret, str) or not re.fullmatch(r'[A-Za-z0-9_-]{16,256}', secret):
        raise ProviderError('invalid-client-secret')
    if (
        client.get('auth_uri') != 'https://accounts.google.com/o/oauth2/auth'
        or client.get('token_uri') != 'https://oauth2.googleapis.com/token'
        or client.get('redirect_uris') != ['http://localhost']
    ):
        raise ProviderError('unexpected-provider-endpoints')
    return client_id


def read_private_file(source):
    with os.fdopen(os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1:
            raise ProviderError('unsafe-download')
        os.fchmod(stream.fileno(), 0o600)
        return read_object(stream, 8192)


def store_packet(destination, packet):
    fd, temp_name = tempfile.mkstemp(dir=destination.parent, prefix='.harbor-oauth-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(packet, stream)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.link(temp_name, destination)
    finally:
        Path(temp_name).unlink()


def wait_for_export(downloads, canary):
    existing = set(downloads.iterdir())
    if canary and downloads / f'client_secret_{DUMMY_ID}.json' in existing:
        raise ProviderError('canary-download-already-exists')
    print('{"result":"READY"}', flush=True)
    deadline = time.monotonic() + 120
    while True:
        candidates = [
            path for path in set(downloads.iterdir()) - existing
            if (match := EXPORT_NAME.fullmatch(path.name)) and (match[1] == DUMMY_ID) == canary
        ]
        if len(candidates) > 1:
            raise ProviderError('ambiguous-download')
        if candidates:
            return candidates[0]
        if time.monotonic() >= deadline:
            raise ProviderError('download-not-observed')
        time.sleep(0.15)



def watch(downloads, destination, canary):
    mode = downloads.lstat()
    if (
        not stat.S_ISDIR(mode.st_mode)
        or stat.S_IMODE(mode.st_mode) != 0o700
        or mode.st_uid != os.getuid()
    ):
        raise ProviderError('unsafe-download-directory')
    if os.path.lexists(destination):
        raise ProviderError('destination-already-exists')

    source = wait_for_export(downloads, canary)
    packet = read_private_file(source)
    client_id = validate(packet, canary)
    if source.name != f'client_secret_{client_id}.json':
        raise ProviderError('download-client-id-mismatch')
    store_packet(destination, packet)
    source.unlink()
    return {'project': PROJECT, 'client_id': client_id, 'canary': canary}


def main():
    try:
        os.umask(0o077)
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        if len(sys.argv) != 2 or sys.argv[1] not in ('live', 'canary'):
            raise ProviderError('expected-execution-mode')
        canary = sys.argv[1] == 'canary'
        root = Path.home() / '.secrets'
        owner = root.lstat()
        if not stat.S_ISDIR(owner.st_mode) or owner.st_uid != os.getuid() or owner.st_mode & 0o022:
            raise ProviderError('unsafe-secrets-root')
        destination = root / DESTINATION
        downloads = Path.home() / 'Downloads'
        if canary:
            with tempfile.TemporaryDirectory(dir=root, prefix='.harbor-oauth-canary-') as temporary:
                receipt = watch(downloads, Path(temporary) / 'canary-result.json', canary)
        else:
            receipt = watch(downloads, destination, canary)
    except ProviderError as error:
        print(json.dumps({'result': 'FAIL', 'code': str(error)}))
        return 1
    except (OSError, ValueError):
        print('{"result":"FAIL","code":"private-transfer-failed"}')
        return 1
    print(json.dumps({'result': 'PASS', **receipt}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
