"""Run the Harness Gmail consent callback inside the approved Vault executor."""

import base64
import hashlib
import hmac
import http.client
import os
import secrets
import stat
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit

import harness_gmail_grant as grant

AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
WAIT = 300


class ConsentServer(HTTPServer):
    code = None

    def get_request(self):
        request, address = super().get_request()
        request.settimeout(3)
        return request, address

    def handle_error(self, *_args):
        pass


class Callback(BaseHTTPRequestHandler):
    def do_GET(self):
        expected_host = f'127.0.0.1:{self.server.server_port}'
        code = callback_code(self.path, self.server.state) if self.headers.get('Host') == expected_host else None
        if code:
            self.server.code = code
        self.send_response(200 if code else 400)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        self.wfile.write(b'Harness received the callback. You can close this page.' if code else b'Callback refused.')

    def log_message(self, *_args):
        pass


def callback_code(path, expected_state):
    parsed = urlsplit(path)
    if parsed.path != '/' or parsed.netloc or len(parsed.query) > 8192:
        return None
    values = parse_qs(parsed.query)
    states, codes = values.get('state', []), values.get('code', [])
    if len(states) == 1 and len(codes) == 1 and 'error' not in values:
        state, code = states[0], codes[0]
        if grant.matches(r'[A-Za-z0-9._~-]{43,128}', state) and hmac.compare_digest(state, expected_state):
            if grant.matches(r'[A-Za-z0-9._~/-]{1,4096}', code):
                return code
    return None


def consent_url(policy, state, verifier, redirect):
    grant.validate_policy(policy)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    return AUTH + '?' + urlencode({
        'client_id': policy['clientId'], 'redirect_uri': redirect, 'response_type': 'code',
        'scope': ' '.join(sorted(grant.SCOPES)), 'state': state, 'code_challenge_method': 'S256',
        'code_challenge': challenge, 'access_type': 'offline', 'prompt': 'consent',
        'include_granted_scopes': 'false', 'login_hint': policy['account'],
    })


def open_private_browser(program, url):
    grant.ensure(os.path.isabs(program) and os.path.realpath(program) == program)
    info = os.stat(program)
    grant.ensure(stat.S_ISREG(info.st_mode) and info.st_uid in (0, os.getuid()) and not info.st_mode & 0o022)
    subprocess.run([program], input=url.encode(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                   timeout=30, check=True)


def receive_consent(policy, client_secret, open_browser):
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
    with ConsentServer(('127.0.0.1', 0), Callback) as server:
        redirect = f'http://127.0.0.1:{server.server_port}/'
        server.state = state
        open_browser(consent_url(policy, state, verifier, redirect))
        deadline = time.monotonic() + WAIT
        while not server.code and time.monotonic() < deadline:
            server.timeout = min(1, max(0, deadline - time.monotonic()))
            server.handle_request()
        grant.ensure(server.code)
        return {
            'clientSecret': client_secret, 'code': server.code, 'state': state, 'expectedState': state,
            'codeVerifier': verifier, 'redirectUri': redirect,
        }


def main(args):
    grant.ensure(len(args) == 3 and stat.S_ISFIFO(os.fstat(sys.stdin.fileno()).st_mode))
    policy_path, destination, private_browser = args
    grant.grant_target(destination)
    policy = grant.private_record(policy_path)
    client = grant.parse(sys.stdin.buffer.read(grant.MAX_PACKET + 1))
    grant.ensure(set(client) == {'installed'})
    installed = client['installed']
    grant.ensure(installed['project_id'] == grant.PROJECT and installed['client_id'] == policy['clientId'])
    secret = installed['client_secret']
    grant.ensure(grant.matches(r'[A-Za-z0-9._~/-]{1,4096}', secret))
    packet = receive_consent(policy, secret, lambda url: open_private_browser(private_browser, url))
    grant.write_grant(destination, grant.exchange(policy, packet, grant.private_http, int(time.time())))


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (
        grant.GrantError, OSError, ValueError, TypeError, KeyError, AttributeError,
        http.client.HTTPException, subprocess.SubprocessError,
    ):
        sys.exit('Harness Gmail consent operation refused.')
