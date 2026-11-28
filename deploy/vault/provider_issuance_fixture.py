"""Dummy provider HTTP routes and private CLI driver for the issuance canary."""

import json
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import openai_project_key as openai
import slack_binding as binding
from slack_bot_token_test import BOT, TOKEN, USER, oauth_result

ADMIN = 'sk-admin-dummy-001'
KEY = 'sk-fixture-not-a-real-key'
CLIENT_SECRET = 'dummy-client-secret-only'
CODE = 'dummy.one-time.code'
OPENAI_PACKET = {'project_id': 'proj_fixture', 'service_account_id': 'svc_acct_fixture', 'admin_key': ADMIN}
SLACK_PACKET = {'app_id': binding.BINDING['appId'], 'workspace_id': binding.BINDING['workspaceId'],
                'client_id': '123.456', 'client_secret': CLIENT_SECRET, 'code': CODE,
                'redirect_uri': 'https://callback.test/slack'}
PROJECT = '/v1/organization/projects/proj_fixture'
ACCOUNT = PROJECT + '/service_accounts/svc_acct_fixture'
CANARY = '''
import importlib, sys
from pathlib import Path
module = importlib.import_module(sys.argv[1])
destination, origin = Path(sys.argv[2]), sys.argv[3]
sys.argv = sys.argv[:1]
from private_provider_http import executor_main
raise SystemExit(executor_main(lambda packet: module.issue(packet, destination, origin), module.FIELDS))
'''


class FixtureHandler(BaseHTTPRequestHandler):
    def handle_call(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        self.server.requests.append((self.command, self.path, body, self.headers.get('Authorization')))
        result = self.server.routes.get((self.command, self.path))
        if isinstance(result, str):
            self.send_response(302)
            self.send_header('Location', result)
            self.end_headers()
            return
        if result is None:
            self.send_error(404)
            return
        content = json.dumps(result).encode()
        self.send_response(200)
        self.send_header('x-oauth-scopes', self.server.scopes)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    do_GET = do_POST = do_DELETE = handle_call

    def log_message(self, *_args):
        pass


def provider_routes():
    limit = {**openai.LIMIT, 'object': 'project.spend_limit', 'enforcement': {'status': 'enforcing'}}
    project = {'id': 'proj_fixture', 'name': openai.PROJECT_NAME, 'status': 'active',
               'object': 'organization.project'}
    key = {'id': 'key_fixture', 'name': openai.KEY_NAME, 'value': KEY, 'object': openai.KEY_OBJECT,
           'expires_at': int(time.time()) + openai.LIFETIME}
    identity = {'ok': True, 'team_id': binding.BINDING['workspaceId'], 'bot_id': BOT, 'user_id': USER}
    return {
        ('GET', PROJECT): project,
        ('GET', ACCOUNT): {'id': 'svc_acct_fixture', 'object': 'organization.project.service_account'},
        ('GET', PROJECT + '/api_keys?limit=100'): {'data': [], 'has_more': False},
        ('POST', PROJECT + '/spend_limit'): limit,
        ('GET', PROJECT + '/spend_limit'): dict(limit),
        ('POST', ACCOUNT + '/api_keys'): key,
        ('DELETE', PROJECT + '/api_keys/key_fixture'): {'id': 'key_fixture', 'deleted': True},
        ('POST', '/api/oauth.v2.access'): oauth_result(scope='incoming-webhook,chat:write'),
        ('POST', '/api/auth.test'): identity
    }


class ProviderIssuanceFixture(unittest.TestCase):
    def setUp(self):
        self.server = HTTPServer(('127.0.0.1', 0), FixtureHandler)
        self.server.routes, self.server.requests, self.server.scopes = provider_routes(), [], 'chat:write'
        self.thread = threading.Thread(target=self.server.serve_forever, args=(0.02,), daemon=True)
        self.thread.start()
        self.origin = f'http://127.0.0.1:{self.server.server_port}'
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.destination = self.root / 'openai.env'

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.directory.cleanup()

    def run_canary(self, module, destination, packet):
        call = [sys.executable, '-B', '-c', CANARY, module, str(destination), self.origin]
        result = subprocess.run(
            call, cwd=Path(__file__).parent, input=json.dumps(packet).encode(),
            capture_output=True, timeout=5
        )
        for secret in (KEY, ADMIN, CLIENT_SECRET, CODE, TOKEN):
            self.assertFalse(secret.encode() in result.stdout + result.stderr, 'receipt contained a secret')
        self.assertEqual(result.stderr, b'')
        return result.returncode, json.loads(result.stdout)

    def assert_private(self, path):
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
