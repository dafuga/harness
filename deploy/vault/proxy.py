"""An exact-host HTTPS CONNECT proxy. Egress is constrained independently by nftables."""
import asyncio
import os
import re


HOSTS = frozenset(os.environ['VAULT_PROXY_HOSTS'].split(','))
REQUEST_LINE = re.compile(rb'CONNECT ([a-z0-9.-]+):443 HTTP/1\.[01]\r\n')


async def transfer(reader, writer):
    while data := await reader.read(65536):
        writer.write(data)
        await writer.drain()


async def connect(reader, writer):
    remote = None
    try:
        request = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 4)
        match = REQUEST_LINE.match(request)
        host = match[1].decode('ascii') if match else None
        if host not in HOSTS or len(request) >= 8192:
            writer.write(b'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n')
            await writer.drain()
            return
        received, remote = await asyncio.wait_for(asyncio.open_connection(host, 443), 5)
        writer.write(b'HTTP/1.1 200 Connection Established\r\n\r\n')
        await writer.drain()
        outgoing = asyncio.create_task(transfer(reader, remote))
        incoming = asyncio.create_task(transfer(received, writer))
        _, pending = await asyncio.wait((outgoing, incoming), return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(outgoing, incoming, return_exceptions=True)
    except (OSError, TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError):
        pass
    finally:
        if remote:
            remote.close()
        writer.close()


async def main():
    proxy = await asyncio.start_server(connect, '127.0.0.1', 32449, limit=8192)
    async with proxy:
        await proxy.serve_forever()


asyncio.run(main())
