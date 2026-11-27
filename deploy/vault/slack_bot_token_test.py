"""Synthetic Slack: the producer, binding store and emit path with a local fake Web API.

Every credential here is a made-up `xoxb-` string. Assertions read statuses and metadata only.
"""

import io
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import stat
import sys
import tempfile
import threading
import unittest

import slack_binding as binding
import slack_bot_token as producer
from secret_pipe import transfer

TOKEN = 'xoxb-1111111111-fixture-synthetic'
BOT, USER = 'B0FIXTURE1', 'U0FIXTURE1'
CALLS = []
PRODUCER_SCRIPT = (
    'import sys; sys.path.insert(0, sys.argv[1]); import slack_bot_token as p; '
    'raise SystemExit(p.produce({"packet": sys.argv[2], "receipt": sys.argv[3]}, base=sys.argv[4]))'
)


class FakeSlack(BaseHTTPRequestHandler):
    team, scopes, is_member = binding.BINDING['workspaceId'], 'chat:write', True

    def do_POST(self):
        CALLS.append((self.path, self.headers.get('Authorization')))
        body = {'ok': True, 'team_id': self.team, 'bot_id': BOT, 'user_id': USER}
        if self.path.endswith('conversations.info'):
            body = {'ok': True, 'channel': {'id': binding.BINDING['channelId'], 'is_member': self.is_member}}
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header('x-oauth-scopes', self.scopes)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_args):
        pass


def oauth_result(**changes):
    result = {
        'ok': True, 'access_token': TOKEN, 'token_type': 'bot', 'scope': 'chat:write',
        'bot_user_id': USER, 'app_id': binding.BINDING['appId'],
        'team': {'id': binding.BINDING['workspaceId']},
    }
    return {**result, **changes}


class SlackFixture(unittest.TestCase):
    def setUp(self):
        CALLS.clear()
        FakeSlack.team, FakeSlack.scopes, FakeSlack.is_member = binding.BINDING['workspaceId'], 'chat:write', True
        self.server = HTTPServer(('127.0.0.1', 0), FakeSlack)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.server.server_port}/api/'
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        os.chmod(self.root, 0o700)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.directory.cleanup()

    def packet(self, content):
        path = self.root / 'packet.json'
        path.write_bytes(json.dumps(content).encode())
        path.chmod(0o600)
        return str(path)

    def run_producer(self, content, **extra):
        out, receipt = io.BytesIO(), self.root / 'receipt.json'
        args = {'packet': self.packet(content), 'receipt': str(receipt), **extra}
        status = producer.produce(args, base=self.base, out=out)
        return status, out.getvalue(), json.loads(receipt.read_text()), args['packet']



class SlackProducerTests(SlackFixture):
    def test_oauth_result_passes_and_emits_only_the_credential_packet(self):
        status, out, receipt, packet = self.run_producer(oauth_result())
        self.assertEqual((status, json.loads(out)), (0, {'token': TOKEN}))
        self.assertEqual(receipt['result'], 'PASS')
        self.assertEqual((receipt['botId'], receipt['botUserId']), (BOT, USER))
        self.assertEqual(receipt['membership'], 'unverified-no-groups-read')
        self.assertNotIn(TOKEN, json.dumps(receipt))
        self.assertFalse(os.path.exists(packet))
        self.assertEqual(stat.S_IMODE((self.root / 'receipt.json').stat().st_mode), 0o600)

    def test_membership_is_checked_when_the_bot_may_read_the_private_channel(self):
        FakeSlack.scopes = 'chat:write,groups:read'
        self.assertEqual(self.run_producer(oauth_result())[2]['membership'], 'member')
        FakeSlack.is_member = False
        status, out, receipt, _ = self.run_producer(oauth_result())
        self.assertEqual((status, out, receipt['code']), (1, b'', 'not-a-channel-member'))

    def test_wrong_app_workspace_token_type_or_scope_emits_nothing(self):
        cases = [
            ('oauth-result-mismatch', oauth_result(app_id='A0OTHER')),
            ('oauth-result-mismatch', oauth_result(team={'id': 'T0OTHER'})),
            ('oauth-result-mismatch', oauth_result(token_type='user')),
            ('oauth-result-mismatch', oauth_result(ok=False)),
            ('not-a-bot-token', oauth_result(access_token='xoxp-1-user')),
            ('identity-mismatch', oauth_result(bot_user_id='U0SOMEONE')),
        ]
        for code, content in cases:
            with self.subTest(code=code, content=sorted(content)):
                status, out, receipt, _ = self.run_producer(content)
                self.assertEqual((status, out, receipt['code'], receipt['result']), (1, b'', code, 'FAIL'))

    def test_missing_chat_write_and_foreign_workspace_fail_closed(self):
        FakeSlack.scopes = 'channels:read'
        self.assertEqual(self.run_producer(oauth_result(scope='channels:read'))[2]['code'], 'chat-write-missing')
        FakeSlack.scopes, FakeSlack.team = 'chat:write', 'T0OTHER'
        self.assertEqual(self.run_producer(oauth_result())[2]['code'], 'identity-mismatch')

    def test_bare_token_needs_the_expected_bot_ids_and_the_scope_header(self):
        self.assertEqual(self.run_producer({'token': TOKEN})[2]['code'], 'app-identity-unproven')
        ids = {'bot': BOT, 'user': USER}
        status, out, receipt, _ = self.run_producer({'token': TOKEN}, **ids)
        self.assertEqual((status, json.loads(out)['token'], receipt['result']), (0, TOKEN, 'PASS'))
        self.assertEqual(self.run_producer({'token': TOKEN}, bot='B0OTHER', user=USER)[2]['code'], 'identity-mismatch')

    def test_unreachable_slack_and_unreadable_packet_leave_a_failure_receipt(self):
        self.server.shutdown()
        self.server.server_close()
        self.assertEqual(self.run_producer(oauth_result())[2]['code'], 'slack-unreachable')
        loose = self.root / 'loose.json'
        loose.write_text('{}')
        loose.chmod(0o644)
        receipt = self.root / 'unreadable.json'
        status = producer.produce({'packet': str(loose), 'receipt': str(receipt)}, base=self.base, out=io.BytesIO())
        self.assertEqual((status, json.loads(receipt.read_text())['code']), (1, 'packet-unreadable'))

    def test_produce_rejects_a_symlinked_packet(self):
        link = self.root / 'link.json'
        link.symlink_to(self.packet(oauth_result()))
        receipt = self.root / 'link-receipt.json'
        status = producer.produce({'packet': str(link), 'receipt': str(receipt)}, base=self.base, out=io.BytesIO())
        self.assertEqual((status, json.loads(receipt.read_text())['code']), (1, 'packet-unreadable'))


class SlackBindingTests(SlackFixture):
    def assert_store_refused(self, store_root, receipt):
        path = self.root / 'bad.json'
        path.write_text(json.dumps(receipt))
        path.chmod(0o600)
        with self.assertRaises(binding.BindingError):
            binding.store(str(store_root), str(path), bytearray(TOKEN.encode()))

    def test_transfer_stores_the_credential_and_emit_reproduces_the_packet(self):
        store_root = self.root / 'store'
        store_root.mkdir(mode=0o700)
        receipt = self.root / 'receipt.json'
        script = Path(__file__).parent
        producer_command = [
            sys.executable, '-c', PRODUCER_SCRIPT,
            str(script), self.packet(oauth_result()), str(receipt), self.base,
        ]
        writer = [sys.executable, str(script / 'slack_binding.py'), 'store', str(store_root), str(receipt)]
        transfer(producer_command, writer, recipe='slack-bot-token')
        directory = binding.binding_directory(str(store_root))
        for name in ('bot.token', 'bot.receipt.json'):
            self.assertEqual(stat.S_IMODE(os.stat(os.path.join(directory, name)).st_mode), 0o600)
        out = io.BytesIO()
        self.assertEqual(binding.main(['emit', str(store_root)], stdout=out), 0)
        self.assertEqual(json.loads(out.getvalue()), {'token': TOKEN})
        self.assertNotIn(TOKEN, Path(directory, 'bot.receipt.json').read_text())

    def test_store_refuses_a_receipt_that_is_not_pass_or_not_pinned(self):
        store_root = self.root / 'store'
        store_root.mkdir(mode=0o700)
        _, _, receipt, _ = self.run_producer(oauth_result())
        for changes in ({'result': 'FAIL'}, {'appId': 'A0OTHER'}, {'botId': 'nope'}, {'extra': 1}):
            with self.subTest(changes=changes):
                self.assert_store_refused(store_root, {**receipt, **changes})
        with self.assertRaises(binding.BindingError):
            binding.store(str(store_root), str(self.root / 'receipt.json'), bytearray(b'xoxp-1-user'))

    def test_emit_refuses_a_loose_directory_and_a_missing_credential(self):
        loose = self.root / 'loose'
        loose.mkdir(mode=0o755)
        self.assertEqual(binding.main(['emit', str(loose)], stdout=io.BytesIO()), 1)
        self.assertEqual(binding.main(['emit', str(self.root / 'empty')], stdout=io.BytesIO()), 1)


if __name__ == '__main__':
    unittest.main()
