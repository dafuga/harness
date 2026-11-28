"""Bounded provider requests and metadata-only output for private Vault executors."""

import http.client
import json
import os
import resource
import ssl
import stat
import sys
import urllib.error
import urllib.request


class ProviderError(Exception):
    """A fixed error code safe for an executor receipt."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def request_json(origin, path, method, **request_options):
    """Use the caller's pinned origin, bypass environment proxies, and refuse redirects."""
    if not path.startswith('/') or path.startswith('//'):
        raise ProviderError('invalid-provider-path')
    url = origin + path
    request = urllib.request.Request(url, method=method, **request_options)
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    tls.load_default_certs()
    https = urllib.request.HTTPSHandler(context=tls)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect, https)
    try:
        with opener.open(request, timeout=15) as response:
            if response.geturl() != url:
                raise ProviderError('provider-origin-mismatch')
            payload = read_object(response, 64 * 1024)
            return payload, response.headers
    except (OSError, ValueError) as error:
        if isinstance(error, urllib.error.HTTPError):
            error.close()
        raise ProviderError('provider-request-failed') from None


def read_object(stream, limit):
    raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise ProviderError('packet-too-large')
    try:
        value = json.loads(raw)
    except ValueError:
        raise ProviderError('invalid-json-packet') from None
    if not isinstance(value, dict):
        raise ProviderError('invalid-json-packet')
    return value


def executor_main(issue, fields):
    """Read exactly one private pipe packet and return only the issuer's receipt."""
    try:
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        if len(sys.argv) != 1 or not stat.S_ISFIFO(os.fstat(sys.stdin.fileno()).st_mode):
            raise ProviderError('executor-pipe-required')
        packet = read_object(sys.stdin.buffer, 8192)
        if set(packet) != fields:
            raise ProviderError('invalid-approval-packet')
        receipt = issue(packet)
    except ProviderError as error:
        print(json.dumps({'result': 'FAIL', 'code': str(error)}))
        return 1
    except (OSError, ValueError, TypeError, KeyError, RuntimeError, http.client.HTTPException):
        print('{"result":"FAIL","code":"executor-failed-check-provider-state"}')
        return 1
    print(json.dumps({'result': 'PASS', **receipt}, sort_keys=True))
    return 0
