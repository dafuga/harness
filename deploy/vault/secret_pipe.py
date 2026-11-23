"""Private stdout-to-stdin relay for reviewed credential producer and store commands."""

import json
import os
import selectors
import subprocess
import time


JSON_FIELDS = {
    'google-oauth-web-client': ('web', 'client_secret'),
    'stripe-webhook': ('secret',),
    'cloudflare-token': ('result', 'value'),
    'openai-service-account-key': ('value',),
    'twilio-key': ('secret',),
    'npm-token': ('token',),
}


def transfer(producer, writer, *, recipe=None, timeout=60):
    """Return on successful storage. Child output and failure details stay private."""
    if not os.path.isabs(producer[0]) or not os.path.isabs(writer[0]):
        raise RuntimeError('Secret transfer requires pinned command paths.')
    if recipe is not None and recipe not in JSON_FIELDS:
        raise RuntimeError('Unknown secret transfer recipe.')
    credential = bytearray()
    selected = None
    try:
        capture(producer, credential, timeout)
        selected = extract(credential, JSON_FIELDS[recipe]) if recipe is not None else credential
        if not selected or b'\0' in selected:
            raise ValueError()
        subprocess.run(writer, input=selected, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=timeout, check=True)
    except (OSError, KeyError, TypeError, ValueError, subprocess.SubprocessError):
        raise RuntimeError('Secret transfer failed. Check provider state before retrying.') from None
    finally:
        if selected is not None and selected is not credential:
            selected[:] = bytes(len(selected))
        credential[:] = bytes(len(credential))


def extract(response, fields):
    value = json.loads(response)
    for field in fields:
        if not isinstance(value, dict):
            raise ValueError()
        value = value[field]
    if not isinstance(value, str) or any(char.isspace() for char in value):
        raise ValueError()
    return bytearray(value, 'utf-8')


def capture(producer, credential, timeout):
    limit = 64 * 1024
    deadline = time.monotonic() + timeout
    with subprocess.Popen(producer, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL) as child, selectors.DefaultSelector() as watch:
        try:
            watch.register(child.stdout, selectors.EVENT_READ)
            while True:
                if not watch.select(max(0, deadline - time.monotonic())):
                    raise subprocess.TimeoutExpired(producer[0], timeout)
                chunk = os.read(child.stdout.fileno(), min(4096, limit + 1 - len(credential)))
                if not chunk:
                    break
                credential.extend(chunk)
                if len(credential) > limit:
                    raise ValueError()
            if child.wait(timeout=max(0, deadline - time.monotonic())) != 0:
                raise ValueError()
        finally:
            if child.poll() is None:
                child.kill()
