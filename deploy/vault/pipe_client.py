"""Copy only raw CDP frames between Docker exec stdio and a guest-local Unix socket."""
import os
import select
import socket
import sys


with socket.socket(socket.AF_UNIX) as channel:
    channel.connect('/work/cdp.sock')
    while True:
        ready, _, _ = select.select([sys.stdin.fileno(), channel], [], [])
        if sys.stdin.fileno() in ready:
            data = os.read(sys.stdin.fileno(), 65536)
            if not data:
                break
            channel.sendall(data)
        if channel in ready:
            data = channel.recv(65536)
            if not data:
                break
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
