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
    'slack-bot-token': ('token',),
}


def transfer(producer, writer, recipe=None, timeout=60):
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
        write_secret(writer, selected, timeout)
    except (OSError, KeyError, TypeError, ValueError, subprocess.SubprocessError):
        raise RuntimeError('Secret transfer failed. Check provider state before retrying.') from None
    finally:
        wipe(selected)
        wipe(credential)


def write_secret(writer, credential, timeout):
    if not credential or b'\0' in credential:
        raise ValueError()
    subprocess.run(
        writer, input=credential, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, timeout=timeout, check=True
    )


def wipe(buffer):
    if buffer is not None:
        buffer[:] = bytes(len(buffer))


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
    deadline = time.monotonic() + timeout
    with subprocess.Popen(
        producer, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
    ) as child:
        capture_process(child, credential, deadline)


def capture_process(child, credential, deadline):
    try:
        read_bounded(child.stdout, credential, deadline)
        if child.wait(timeout=max(0, deadline - time.monotonic())) != 0:
            raise ValueError()
    finally:
        if child.poll() is None:
            child.kill()


def read_bounded(output, credential, deadline):
    with selectors.DefaultSelector() as watch:
        watch.register(output, selectors.EVENT_READ)
        read_chunks(watch, output.fileno(), credential, deadline)


def read_chunks(watch, source, credential, deadline):
    limit = 64 * 1024
    while len(credential) <= limit and watch.select(max(0, deadline - time.monotonic())):
        chunk = os.read(source, min(4096, limit + 1 - len(credential)))
        if not chunk:
            return
        credential.extend(chunk)
    raise ValueError()
