"""Pinned Slack bot binding: harness / slack-smoke / buildflexity-alerts / bot.

The store keeps the bot credential and a metadata-only receipt in an owner-only directory.
`emit` re-checks the receipt against the pinned identity and prints the stdin packet that
the Harness Slack smoke consumer reads. Nothing here prints or logs the credential.
"""

import fcntl
import json
import os
import re
import stat
import sys
from contextlib import contextmanager

BINDING = {
    'project': 'harness',
    'environment': 'slack-smoke',
    'installationId': 'buildflexity-alerts',
    'purpose': 'bot',
    'appId': 'A0CM4RZ3508',
    'workspaceId': 'T0CHRK2DS0M',
    'channelId': 'C0CL8D6PCLS',
    'version': 1,
}
TOKEN = re.compile(r'^xoxb-[A-Za-z0-9-]{1,512}$')
BOT_ID = re.compile(r'^B[A-Z0-9]{1,30}$')
USER_ID = re.compile(r'^U[A-Z0-9]{1,30}$')
RECEIPT_KEYS = {
    'binding', 'result', 'code', 'appId', 'workspaceId', 'botId', 'botUserId',
    'chatWrite', 'membership', 'channelId',
}


class BindingError(Exception):
    """Failure with a fixed message that never contains a credential."""


def read_receipt(path):
    """Return a PASS receipt whose binding and IDs match the pins, or raise."""
    try:
        receipt = json.loads(read_private(path, 8192))
    except (OSError, ValueError):
        raise BindingError('The receipt is unreadable.') from None
    validate_receipt(receipt)
    return receipt


def validate_receipt(receipt):
    if not isinstance(receipt, dict) or set(receipt) - RECEIPT_KEYS:
        raise BindingError('The receipt has unexpected fields.')
    expected = {
        'binding': binding_id(), 'result': 'PASS', 'appId': BINDING['appId'],
        'workspaceId': BINDING['workspaceId'], 'channelId': BINDING['channelId'],
        'chatWrite': True,
    }
    if any(receipt.get(key) != value for key, value in expected.items()):
        raise BindingError('The receipt does not match the pinned binding.')
    if not BOT_ID.match(str(receipt.get('botId'))) or not USER_ID.match(str(receipt.get('botUserId'))):
        raise BindingError('The receipt lacks verified bot IDs.')


def binding_id():
    keys = ('project', 'environment', 'installationId', 'purpose')
    return '/'.join(BINDING[key] for key in keys) + '@' + str(BINDING['version'])


def read_private(path, limit):
    """Read a regular owner-only file without following links."""
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise OSError('not private')
        return os.read(descriptor, limit + 1)[:limit]
    finally:
        os.close(descriptor)


def write_private(path, data):
    """Create or replace a file with mode 0600 through a same-directory rename."""
    temporary = f'{path}.{os.getpid()}.part'
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(descriptor, 'wb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        if os.path.lexists(temporary):
            os.unlink(temporary)
        raise


def binding_directory(root):
    require_directory(root, 0o077)
    path = root
    for field in ('project', 'environment', 'installationId'):
        path = os.path.join(path, BINDING[field])
        try:
            os.mkdir(path, mode=0o700)
        except FileExistsError:
            pass
        require_directory(path, 0o077 if field == 'installationId' else 0o022)
    return path


def require_directory(path, forbidden):
    info = os.lstat(path)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & forbidden:
        raise BindingError('The binding directory must be an owner-controlled directory.')


@contextmanager
def binding_write_lock(directory):
    handle = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally:
        os.close(handle)


def store(root, receipt_path, token):
    """Write the credential beside its receipt after the receipt passes the pins."""
    receipt = read_receipt(receipt_path)
    directory = binding_directory(root)
    with binding_write_lock(directory):
        store_in_locked_binding(directory, receipt, token)


def store_in_locked_binding(directory, receipt, token):
    if not TOKEN.fullmatch(bytes(token).decode('ascii', 'replace')):
        raise BindingError('The credential is not a Slack bot token.')
    validate_receipt(receipt)
    write_private(os.path.join(directory, 'bot.receipt.json'), json.dumps(receipt, sort_keys=True).encode())
    write_private(os.path.join(directory, 'bot.token'), bytes(token))


def emit(root, out):
    """Write the consumer's `{token}` packet to `out` after re-checking the stored receipt."""
    directory = binding_directory(root)
    with binding_write_lock(directory):
        read_receipt(os.path.join(directory, 'bot.receipt.json'))
        try:
            token = bytearray(read_private(os.path.join(directory, 'bot.token'), 1024))
        except OSError:
            raise BindingError('The binding holds no credential.') from None
    try:
        if not TOKEN.fullmatch(token.decode('ascii', 'replace')):
            raise BindingError('The stored credential is invalid.')
        out.write(b'{"token":"' + bytes(token) + b'"}')
        out.flush()
    finally:
        token[:] = bytes(len(token))


def main(argv, stdin=None, stdout=None):
    """`store <root> <receipt>` reads the token from stdin. `emit <root>` writes the packet."""
    stdin = stdin or sys.stdin.buffer
    stdout = stdout or sys.stdout.buffer
    try:
        if len(argv) == 3 and argv[0] == 'store':
            data = bytearray(stdin.read(1025))
            try:
                store(argv[1], argv[2], data)
            finally:
                data[:] = bytes(len(data))
        elif len(argv) == 2 and argv[0] == 'emit':
            emit(argv[1], stdout)
        else:
            raise BindingError('Usage: store <root> <receipt> | emit <root>')
    except BindingError as error:
        print(str(error), file=sys.stderr)
        return 1
    except OSError:
        print('The binding store failed.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
