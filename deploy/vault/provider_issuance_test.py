"""Exercise private provider issuance and storage with dummy credentials."""

import io
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs

import openai_project_key as openai
import slack_binding as binding
from private_provider_http import ProviderError
from slack_bot_token_test import BOT, TOKEN, USER, oauth_result
from provider_issuance_fixture import ACCOUNT, CODE, KEY, OPENAI_PACKET, PROJECT, SLACK_PACKET
from provider_issuance_fixture import ProviderIssuanceFixture, provider_routes


class ProviderIssuanceTest(ProviderIssuanceFixture):
    def test_openai_issues_scoped_key_after_limit_readback_and_publishes_env(self):
        status, receipt = self.run_canary('openai_project_key', self.destination, OPENAI_PACKET)
        self.assertEqual((status, receipt['result'], receipt['keyId']), (0, 'PASS', 'key_fixture'))
        self.assertEqual(receipt['monthlyHardLimitCents'], 500)
        self.assertEqual(receipt['scope'], 'api.model.request')
        self.assert_private(self.destination)
        self.assertTrue(self.destination.read_text() == f'OPENAI_API_KEY={KEY}\n')
        calls = [(method, path) for method, path, _, _ in self.server.requests]
        expected_calls = [
            ('GET', PROJECT), ('GET', ACCOUNT), ('GET', PROJECT + '/api_keys?limit=100'),
            ('POST', PROJECT + '/spend_limit'), ('GET', PROJECT + '/spend_limit'), ('POST', ACCOUNT + '/api_keys'),
        ]
        self.assertEqual(calls, expected_calls)
        limit = {'threshold_amount': 500, 'currency': 'USD', 'interval': 'month'}
        key = {'name': 'Fluora Demo Realtime', 'scopes': ['api.model.request'], 'expires_in_seconds': 86400}
        self.assertEqual(json.loads(self.server.requests[-3][2]), limit)
        self.assertEqual(json.loads(self.server.requests[-1][2]), key)

    def test_openai_refuses_wrong_project_duplicate_key_and_inactive_limit_before_mint(self):
        for request, field, invalid, code in (
            (('GET', PROJECT), 'name', 'Fluora Production', 'wrong-openai-project'),
            (('GET', PROJECT + '/api_keys?limit=100'), 'data', [{'name': openai.KEY_NAME}],
             'verify-existing-openai-key-before-retrying'),
            (('GET', PROJECT + '/spend_limit'), 'enforcement', {'status': 'inactive'},
             'openai-hard-limit-not-verified'),
        ):
            with self.subTest(code=code):
                self.server.routes = provider_routes()
                self.server.requests.clear()
                self.server.routes[request][field] = invalid
                result = self.run_canary('openai_project_key', self.destination, OPENAI_PACKET)
                self.assertEqual(result, (1, {'result': 'FAIL', 'code': code}))
                self.assertNotIn(ACCOUNT + '/api_keys', [row[1] for row in self.server.requests])
                self.assertFalse(self.destination.exists())

    def test_openai_revokes_new_key_if_file_publication_fails(self):
        with patch.object(openai, 'publish_env', side_effect=OSError), self.assertRaisesRegex(
                ProviderError, '^openai-delivery-failed-key-revoked$'):
            openai.issue(OPENAI_PACKET, self.destination, self.origin)
        self.assertEqual(self.server.requests[-1][:2], ('DELETE', PROJECT + '/api_keys/key_fixture'))
        self.assertFalse(self.destination.exists())

    def test_slack_exchange_stores_the_credential_in_the_pinned_smoke_binding(self):
        status, receipt = self.run_canary('slack_install', self.root, SLACK_PACKET)
        self.assertEqual((status, receipt['result'], receipt['botId'], receipt['botUserId']), (0, 'PASS', BOT, USER))
        self.assertEqual(receipt['binding'], 'harness/slack-smoke/buildflexity-alerts/bot@1')
        directory = Path(binding.binding_directory(self.root))
        for filename in ('bot.token', 'bot.receipt.json'):
            self.assert_private(directory / filename)
        self.assertEqual(binding.read_receipt(directory / 'bot.receipt.json'), receipt)
        out = io.BytesIO()
        binding.emit(self.root, out)
        self.assertTrue(json.loads(out.getvalue()) == {'token': TOKEN})
        oauth, verify = self.server.requests
        self.assertEqual(oauth[:2], ('POST', '/api/oauth.v2.access'))
        self.assertTrue(parse_qs(oauth[2].decode()) == {'code': [CODE], 'redirect_uri': [SLACK_PACKET['redirect_uri']]})
        self.assertTrue(oauth[3].startswith('Basic '))
        self.assertEqual(verify[:2], ('POST', '/api/auth.test'))
        self.assertTrue(verify[3] == 'Bearer ' + TOKEN)

    def test_slack_rejects_wrong_app_scope_workspace_and_bot_identity(self):
        for changes, code in (
            ({'app_id': 'A0OTHER'}, 'oauth-result-mismatch'),
            ({'team': {'id': 'T0OTHER'}}, 'oauth-result-mismatch'),
            ({'scope': 'chat:write,groups:read'}, 'slack-oauth-grant-outside-approved-scope'),
            ({'bot_user_id': 'U0OTHER'}, 'identity-mismatch'),
        ):
            with self.subTest(code=code):
                self.server.routes[('POST', '/api/oauth.v2.access')] = oauth_result(**changes)
                result = self.run_canary('slack_install', self.root, SLACK_PACKET)
                self.assertEqual(result, (1, {'result': 'FAIL', 'code': code}))
                self.assertFalse(list(self.root.rglob('bot.*')))

    def test_provider_redirects_are_not_followed_and_neither_store_is_written(self):
        for module, dest, packet, method, path in (
            ('openai_project_key', self.destination, OPENAI_PACKET, 'GET', PROJECT),
            ('slack_install', self.root, SLACK_PACKET, 'POST', '/api/oauth.v2.access'),
        ):
            with self.subTest(module=module):
                self.server.requests.clear()
                self.server.routes[(method, path)] = self.origin.replace('127.0.0.1', 'localhost') + '/unexpected'
                expected = (1, {'result': 'FAIL', 'code': 'provider-request-failed'})
                self.assertEqual(self.run_canary(module, dest, packet), expected)
                self.assertEqual([row[:2] for row in self.server.requests], [(method, path)])
                self.assertFalse(self.destination.exists() or list(self.root.rglob('bot.*')))

    def test_provider_issuance_refuses_existing_paths_before_any_network_request(self):
        self.destination.symlink_to(self.root / 'missing')
        Path(binding.binding_directory(self.root), 'bot.receipt.json').touch()
        targets = [('openai_project_key', self.destination, OPENAI_PACKET), ('slack_install', self.root, SLACK_PACKET)]
        for module, dest, packet in targets:
            self.assertEqual(self.run_canary(module, dest, packet)[0], 1)
            script = Path(__file__).parent / (module + '.py')
            command = [sys.executable, '-B', script]
            direct = subprocess.run(command, stdin=subprocess.DEVNULL, capture_output=True, timeout=5)
            expected = (1, {'result': 'FAIL', 'code': 'executor-pipe-required'}, b'')
            self.assertEqual((direct.returncode, json.loads(direct.stdout), direct.stderr), expected)
        self.assertFalse(self.server.requests)
        self.assertTrue(self.destination.is_symlink())


if __name__ == '__main__':
    unittest.main()
