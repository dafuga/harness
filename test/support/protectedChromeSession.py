"""Network-disabled Docker fixture for website state in the stock Chrome profile."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from runpy import run_path
import sys
from threading import Thread
from urllib.parse import urlsplit


class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        session = 'harness_fixture=1' in self.headers.get('Cookie', '').split('; ')
        if self.path in ('/enroll', '/expire'):
            age = '86400' if self.path == '/enroll' else '0'
            self.send_response(303)
            self.send_header('Set-Cookie', f'harness_fixture=1; Max-Age={age}; Path=/; HttpOnly')
            self.send_header('Location', '/check')
        elif self.path == '/check':
            self.send_response(302)
            self.send_header('Location', '/session' if session else '/sign-in')
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if self.path in ('/session', '/sign-in'):
            self.wfile.write(b'<!doctype html><p>Disposable website session fixture</p>')

    def log_message(self, *_args):
        pass


def classify(url):
    parsed = urlsplit(url)
    if parsed.netloc == '127.0.0.1:18765':
        return {'/session': 'ready', '/sign-in': 'reauth-required'}.get(parsed.path, 'unknown')
    return 'unknown'


def check_fixture(phase, probe):
    base = 'http://127.0.0.1:18765'
    with ThreadingHTTPServer(('127.0.0.1', 18765), Fixture) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            print(probe(f'{base}/check', classify))
            print(probe(f'{base}/{"enroll" if phase == "enroll" else "expire"}', classify))
        finally:
            server.shutdown()
            thread.join()
    if phase == 'restart':
        print(probe(f'{base}/check', classify, timeout=3))


health = run_path('/opt/browser/protected-chrome-health.py')
classify_google = health['classify_google']
assert classify_google('https://myaccount.google.com/u/0/security') == 'ready'
assert classify_google('https://myaccount.google.com/intro/security') == 'reauth-required'
assert classify_google('https://accounts.google.com/v3/signin/identifier') == 'reauth-required'
assert classify_google('https://myaccount.google.com.evil.example/security') == 'unknown'
assert classify_google('https://myaccount.google.com/other') == 'unknown'
assert classify_google('chrome-error://chromewebdata/') == 'unknown'
check_fixture(sys.argv[1], health['probe'])
