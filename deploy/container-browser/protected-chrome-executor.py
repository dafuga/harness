"""Host commands for the private Chrome executor on a FileVault-enabled Mac."""

import fcntl
import os
from pathlib import Path
import plistlib
import pwd
import re
import stat
from subprocess import DEVNULL, PIPE, SubprocessError, run
import sys

EXECUTOR = 'harness-browser-executor'
VM = 'harness-google-chrome'
CONTAINER = 'harness-browser-google-slack'
STATUSES = ('ready', 'reauth-required', 'unknown')
REAUTH_ALERT = 'The protected Google Chrome session expired. Request Google sign-in through Daniel’s paired private viewer.'


def output(command, timeout=10):
    return run(command, stdout=PIPE, stderr=DEVNULL, check=True, timeout=timeout).stdout


def verify_storage(path, home):
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(home):
        raise RuntimeError('The Chrome VM storage is outside the private executor home.')
    device = output(['/bin/df', '-P', str(resolved)]).splitlines()[1].split()[0].decode('ascii')
    volume = plistlib.loads(output(['/usr/sbin/diskutil', 'info', '-plist', device]))
    if volume.get('FileVault') is not True or volume.get('EncryptionThisVolumeProper') is not True:
        raise RuntimeError('The actual Chrome VM storage volume must have FileVault enabled.')


def executor_home():
    identity = pwd.getpwuid(os.geteuid())
    if identity.pw_name != EXECUTOR or identity.pw_uid == 0:
        raise RuntimeError('Run this only as the dedicated private Chrome executor.')
    home = Path(identity.pw_dir)
    permissions = home.stat()
    if home.resolve() != home or permissions.st_uid != identity.pw_uid or stat.S_IMODE(permissions.st_mode) != 0o700:
        raise RuntimeError('The private Chrome executor home must be owner-only.')
    return home


def verify_engine(home):
    colima = home / '.colima'
    socket = colima / VM / 'docker.sock'
    lima = colima / '_lima'
    verify_storage(lima / f'colima-{VM}' / 'disk', home)
    verify_storage(lima / '_disks' / f'colima-{VM}' / 'datadisk', home)
    if socket.resolve() != socket or not socket.is_socket() or socket.stat().st_uid != os.geteuid():
        raise RuntimeError('The private Chrome executor does not own the expected Docker socket.')
    return socket


def health(home, socket):
    state = home / '.harness' / 'container-browser' / 'google-slack'
    docker = ['/opt/homebrew/bin/docker', '--config', str(state), '--host', f'unix://{socket}']
    mount_format = '{{range .Mounts}}{{if eq .Destination "/profile"}}{{.Type}} {{.Name}}{{end}}{{end}}'
    mount = output([*docker, 'inspect', '--format', mount_format, CONTAINER]).strip()
    if mount != b'volume harness-browser-google-slack-profile':
        raise RuntimeError('The protected Chrome profile is not on its dedicated Docker volume.')
    probe = ['timeout', '-k', '3', '35', '/usr/bin/python3', '/opt/browser/protected-chrome-health.py']
    status = output([*docker, 'exec', CONTAINER, *probe], timeout=45).decode('ascii').strip()
    return status if status in STATUSES else 'unknown'


def record_health(directory, status, send_alert):
    """Record a confirmed expiry once per signed-in session, with retry on failed delivery."""
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    state = directory / 'google-session-state'
    with (directory / 'google-session.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        previous = state.read_text().strip() if state.exists() else ''
        if status == 'ready' and previous != 'ready':
            next_state = 'ready'
        elif status == 'reauth-required' and previous == 'ready':
            send_alert()
            next_state = 'alerted'
        else:
            return
        pending = state.with_suffix('.pending')
        pending.write_text(f'{next_state}\n')
        pending.replace(state)


def main(args):
    os.umask(0o077)
    if args not in (['verify-storage'], ['health']) and (len(args) != 4 or args[0] != 'report'):
        raise RuntimeError('Use verify-storage, health, or report STATUS TRACKER_EXECUTABLE TRACKER_ITEM.')
    home = executor_home()
    socket = verify_engine(home)
    if args == ['health']:
        print(health(home, socket))
    if args[0] == 'report':
        _, status, tracker, item = args
        if status not in STATUSES or not Path(tracker).is_absolute() or not re.fullmatch(r'[a-z0-9]{6,24}', item):
            raise RuntimeError('Use a known session status, absolute Tracker executable and Tracker item ID.')
        directory = home / '.harness' / 'container-browser' / 'google-slack'
        record_health(directory, status, lambda: output([tracker, 'alert', item, REAUTH_ALERT], timeout=20))


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (OSError, ValueError, IndexError, SubprocessError, plistlib.InvalidFileException):
        print('Private Chrome executor could not verify the host or record session health.', file=sys.stderr)
        sys.exit(1)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
