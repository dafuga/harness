"""Synthetic checks for the protected Chrome executor's Tracker notification."""

from pathlib import Path
from runpy import run_path
from subprocess import CalledProcessError
import sys
from tempfile import TemporaryDirectory


def verify_reporting(record):
    sent = []

    def alert():
        sent.append('alert')

    def unavailable():
        raise CalledProcessError(1, ['tracker', 'alert'])

    with TemporaryDirectory() as temp:
        state = Path(temp)
        record(state, 'reauth-required', alert)
        record(state, 'ready', alert)
        record(state, 'unknown', alert)
        assert sent == []
        try:
            record(state, 'reauth-required', unavailable)
        except CalledProcessError:
            assert (state / 'google-session-state').read_text() == 'ready\n'
        else:
            raise AssertionError('A delivery failure must remain retryable.')
        record(state, 'reauth-required', alert)
        record(state, 'reauth-required', alert)
        assert sent == ['alert']
        record(state, 'ready', alert)
        record(state, 'reauth-required', alert)
        assert sent == ['alert', 'alert']


verify_reporting(run_path(sys.argv[1])['record_health'])
print('Tracker alert routing, suppression, delivery retry and rearming passed.')
