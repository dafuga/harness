"""Own the headed Chromium and its private CDP pipe for one disposable container."""
import fcntl
import json
import os
import select
import signal
import socket
import stat
import subprocess
import time
from contextlib import ExitStack


BRIDGE = '/work/cdp.sock'
PROXY = '0100007F:7EC1'  # 127.0.0.1:32449 in /proc/net/tcp
CHROMIUM = [
    '/usr/bin/chromium', '--remote-debugging-pipe', '--disable-setuid-sandbox',
    '--disable-background-networking', '--disable-component-update', '--disable-quic',
    '--disable-sync', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--proxy-server=http://127.0.0.1:32449', '--proxy-bypass-list=<-loopback>',
    '--user-data-dir=/work/profile', 'about:blank',
]


def listen_addresses():
    for table in ('/proc/net/tcp', '/proc/net/tcp6'):
        yield from listen_table(table)


def listen_table(table):
    with open(table, encoding='ascii') as stream:
        next(stream)
        for line in stream:
            fields = line.split()
            if fields[3] == '0A':
                yield fields[1]


def require_proxy():
    for _ in range(100):
        listeners = set(listen_addresses())
        # Docker's embedded DNS binds this address on private bridge networks.
        other = {address for address in listeners if not address.startswith('0B00007F:')}
        if other == {PROXY}:
            return
        if other:
            break
        time.sleep(0.05)
    raise RuntimeError('Unexpected TCP listeners or missing Vault proxy.')


def chrome_pipe(cleanup):
    into, send = os.pipe()
    receive, out = os.pipe()
    saved_in = fcntl.fcntl(into, fcntl.F_DUPFD_CLOEXEC, 10)
    saved_out = fcntl.fcntl(out, fcntl.F_DUPFD_CLOEXEC, 10)
    child = subprocess.Popen(
        ['/bin/bash', '-c', 'exec 3<&"$1" 4>&"$2"; shift 2; exec "$@"',
         'vault-chromium', str(saved_in), str(saved_out), *CHROMIUM],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        pass_fds=(saved_in, saved_out),
    )
    cleanup.callback(stop, child)
    for fd in (into, out, saved_in, saved_out):
        os.close(fd)
    for fd in (receive, send):
        cleanup.callback(os.close, fd)
    return child, send, receive


def stop(child):
    if child.poll() is not None:
        return
    child.terminate()
    try:
        child.wait(timeout=3)
    except subprocess.TimeoutExpired:
        child.kill()
        child.wait()


def wait_for_xvfb(display):
    for _ in range(100):
        if display.poll() is not None:
            break
        try:
            if stat.S_ISSOCK(os.stat('/tmp/.X11-unix/X99').st_mode):
                return
        except FileNotFoundError:
            pass
        time.sleep(0.05)
    raise RuntimeError('Vault display did not start.')


def bridge(client, send, receive):
    # One in-container client for the lifetime of this browser. The host relay owns reconnects.
    while True:
        readable, _, _ = select.select([client, receive], [], [], 1)
        if client in readable:
            data = client.recv(65536)
            if not data:
                return
            with os.fdopen(os.dup(send), 'wb') as stream:
                stream.write(data)
        if receive in readable:
            data = os.read(receive, 65536)
            if not data:
                return
            client.sendall(data)
        if any(address != PROXY and not address.startswith('0B00007F:') for address in listen_addresses()):
            raise RuntimeError('An unexpected TCP listener appeared.')


def check_browser_pipe(send, receive):
    os.write(send, b'{"id":32673,"method":"Browser.getVersion"}\0')
    deadline = time.monotonic() + 8
    message = bytearray()
    while time.monotonic() < deadline and len(message) < 65536:
        if not select.select([receive], [], [], max(0, deadline - time.monotonic()))[0]:
            break
        data = os.read(receive, 8192)
        if not data:
            break
        message.extend(data)
        if b'\0' in message:
            response = json.loads(message.split(b'\0', 1)[0])
            if response.get('id') == 32673 and response.get('result', {}).get('product'):
                return
            break
    raise RuntimeError('Chromium could not complete its private pipe preflight.')


def main():
    os.umask(0o077)
    require_proxy()
    with ExitStack() as cleanup:
        display = subprocess.Popen(
            ['Xvfb', ':99', '-screen', '0', '1280x800x24', '-nolisten', 'tcp'],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        cleanup.callback(stop, display)
        wait_for_xvfb(display)
        child, send, receive = chrome_pipe(cleanup)
        check_browser_pipe(send, receive)
        listener = cleanup.enter_context(socket.socket(socket.AF_UNIX))
        listener.bind(BRIDGE)
        listener.listen(1)
        listener.settimeout(0.2)
        serve_pipe(listener, child, send, receive)


def serve_pipe(listener, child, send, receive):
    while child.poll() is None:
        try:
            client, _ = listener.accept()
        except TimeoutError:
            continue
        with client:
            listener.close()
            os.unlink(BRIDGE)
            bridge(client, send, receive)
        return
    raise RuntimeError('Chromium exited before the private pipe was attached.')


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: exit(0))
    main()
