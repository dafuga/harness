"""Executor-only website session check for the running stock Chrome profile."""

from contextlib import contextmanager
import fcntl
import os
from pathlib import Path
import re
from subprocess import DEVNULL, PIPE, SubprocessError, run
from time import monotonic, sleep
from urllib.parse import urlsplit

import gi

gi.require_version('Atspi', '2.0')
from gi.repository import Atspi, GLib

PROFILE = Path('/profile/google-chrome')
GOOGLE_ACCOUNT_PAGE = 'https://myaccount.google.com/security'
PROBE_LOCK = Path('/tmp/harness-chrome-session/probe.lock')


def classify_google(url):
    location = urlsplit(url)
    if location.scheme != 'https':
        return 'unknown'
    if location.netloc == 'myaccount.google.com':
        if re.fullmatch(r'/(?:u/\d+/)?security/?', location.path):
            return 'ready'
        if location.path.rstrip('/') == '/intro/security':
            return 'reauth-required'
    if location.netloc == 'accounts.google.com':
        if location.path.startswith(('/v3/signin/', '/signin/')) or location.path == '/ServiceLogin':
            return 'reauth-required'
    return 'unknown'


def xprop(*args):
    return run(['xprop', *args], stdout=PIPE, stderr=DEVNULL, text=True, timeout=2, check=True).stdout


def chrome_windows(pid):
    windows = re.findall(r'\b0x[0-9a-f]+\b', xprop('-root', '_NET_CLIENT_LIST'))
    return {window for window in windows if xprop('-id', window, '_NET_WM_PID').strip().endswith(f'= {pid}')}


def children(node):
    return [node.get_child_at_index(index) for index in range(node.get_child_count())]


def browser_app(atspi, pid):
    deadline = monotonic() + 4
    while monotonic() < deadline:
        for app in children(atspi.get_desktop(0)):
            if app is not None and app.get_process_id() == pid:
                return app
        sleep(0.15)
    return None


def document_location(atspi, frame):
    for relation in frame.get_relation_set():
        if relation.get_relation_type() == atspi.RelationType.EMBEDS:
            tab = relation.get_target(0)
            document = tab.get_document_iface()
            if document:
                return document.get_document_attribute_value('URI')
    return None


def wait_for_status(atspi, snapshot, classify, deadline):
    app, previous = snapshot
    while monotonic() < deadline:
        new_frames = set(children(app)) - previous
        if len(new_frames) > 1:
            break
        if new_frames:
            try:
                location = document_location(atspi, next(iter(new_frames)))
            except (AttributeError, GLib.Error):
                # A navigation can replace its accessibility document during this read.
                location = None
            status = classify(location) if location else 'unknown'
            if status != 'unknown':
                return status
        sleep(0.15)
    return 'unknown'


@contextmanager
def probe_window(pid, url):
    previous = chrome_windows(pid)
    if not previous:
        raise RuntimeError('No persistent Chrome window')
    try:
        run(
            ['/usr/bin/google-chrome-stable', f'--user-data-dir={PROFILE}', '--new-window', url],
            stdout=DEVNULL, stderr=DEVNULL, timeout=8, check=True
        )
        yield
    finally:
        opened = chrome_windows(pid) - previous
        if len(opened) != 1:
            raise RuntimeError('Could not isolate the probe window')
        run(['wmctrl', '-ic', next(iter(opened))], stdout=DEVNULL, stderr=DEVNULL, timeout=2, check=True)
        deadline = monotonic() + 3
        while chrome_windows(pid) - previous:
            if monotonic() >= deadline:
                raise RuntimeError('Could not close the probe window')
            sleep(0.15)


def probe(url, classify, timeout=12):
    """Run with viewer input and other browser work excluded by the executor."""
    try:
        with PROBE_LOCK.open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            pid = int(os.readlink(PROFILE / 'SingletonLock').rsplit('-', 1)[-1])
            Atspi.set_timeout(1000, 1000)
            app = browser_app(Atspi, pid)
            if app is None:
                return 'unknown'
            previous = set(children(app))
            with probe_window(pid, url):
                return wait_for_status(Atspi, (app, previous), classify, monotonic() + timeout)
    except (AttributeError, GLib.Error, OSError, RuntimeError, SubprocessError, ValueError):
        # D-Bus, window manager and navigation failures reveal neither URLs nor page contents.
        return 'unknown'


if __name__ == '__main__':
    print(probe(GOOGLE_ACCOUNT_PAGE, classify_google))
