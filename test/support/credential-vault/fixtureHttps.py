from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import secrets
import ssl
import subprocess
import time
from urllib.parse import parse_qs


PASSWORD = 'canary-password-7f3a'
OTP = '424242'
CHANNEL = os.environ.get('VAULT_FIXTURE_OTP', 'sms')
PAGE = '<!doctype html><meta charset="utf-8"><title>Vault fixture</title>'
PASSWORD_FORM = ('<form method="post" action="/login"><label>Password '
                 '<input id="password" name="password" type="password" autocomplete="off"></label>'
                 '<button id="continue">Continue</button></form>')
OTP_FORM = (f'<p id="otp-channel">{CHANNEL}</p><form method="post" action="/verify">'
            '<label>Code <input id="otp" name="otp" autocomplete="off"></label>'
            '<button id="verify">Verify</button></form>')
ROSTER = ('<h1>Approved synthetic origin</h1><p id="identity">owner@example.test</p>'
          '<p id="capability">read-roster</p>')
CHALLENGES = set()
SESSIONS = set()
EVENTS = []


def event(kind):
    EVENTS.append({'kind': kind, 'at': int(time.time() * 1000), 'session': 'synthetic-session'})


class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/login':
            self.html(PASSWORD_FORM)
        elif self.path == '/verify' and self.cookie('challenge') in CHALLENGES:
            self.html(OTP_FORM)
        elif self.path == '/roster' and self.cookie('session') in SESSIONS:
            self.html(ROSTER)
        elif self.path == '/logout':
            self.logout()
        elif self.path == '/security-log':
            self.reply(200, json.dumps({'events': EVENTS, 'active': len(SESSIONS)}), 'application/json')
        elif self.path == '/':
            self.html('<h1>Approved synthetic origin</h1>')
        else:
            self.reply(403, 'Denied')

    def do_POST(self):
        length = int(self.headers.get('content-length', '0'))
        if length < 1 or length > 4096:
            self.reply(400, 'Bad form')
            return
        values = parse_qs(self.rfile.read(length).decode('utf-8'))
        if self.path == '/login' and values.get('password') == [PASSWORD]:
            self.issue('/verify', 'challenge', CHALLENGES)
        elif self.path == '/verify' and self.cookie('challenge') in CHALLENGES:
            CHALLENGES.remove(self.cookie('challenge'))
            if values.get('otp') == [OTP]:
                event('login')
                self.issue('/roster', 'session', SESSIONS)
            else:
                self.reply(403, 'Denied')
        else:
            self.reply(403, 'Denied')

    def issue(self, path, name, records):
        value = secrets.token_hex(16)
        records.add(value)
        self.send_response(303)
        self.send_header('Location', path)
        self.send_header('Set-Cookie', f'{name}={value}; Path=/; Secure; HttpOnly; SameSite=Strict')
        self.end_headers()

    def logout(self):
        value = self.cookie('session')
        if value in SESSIONS:
            SESSIONS.remove(value)
            event('other')
        self.html('<h1>Signed out</h1>')

    def cookie(self, name):
        values = SimpleCookie(self.headers.get('cookie', ''))
        return values[name].value if name in values else None

    def html(self, body):
        self.reply(200, PAGE + body, 'text/html; charset=utf-8')

    def reply(self, status, data, mime='text/plain'):
        body = data.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


subprocess.run(
    ['openssl', 'req', '-newkey', 'rsa:2048', '-nodes', '-x509', '-days', '1',
     '-subj', '/CN=console.example.test', '-keyout', '/tmp/fixture-key.pem',
     '-out', '/tmp/fixture-cert.pem'],
    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
server = ThreadingHTTPServer(('0.0.0.0', 443), Fixture)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/tmp/fixture-cert.pem', '/tmp/fixture-key.pem')
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
