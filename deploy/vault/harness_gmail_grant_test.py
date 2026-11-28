"""Synthetic scope, metadata, private storage and refresh checks."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import harness_gmail_grant as gmail
import harness_gmail_consent as consent

POLICY = {
    'project': gmail.PROJECT, 'clientId': '123456-fixture.apps.googleusercontent.com',
    'account': 'fixture@gmail.com', 'threadId': 'a11b',
}
PACKET = {
    'clientSecret': 'synthetic-client', 'code': 'synthetic-code', 'state': 'a' * 43,
    'expectedState': 'a' * 43, 'codeVerifier': 's' * 43, 'redirectUri': 'http://127.0.0.1:40517/',
}
REPLY = {
    'access_token': 'synthetic-access', 'token_type': 'Bearer', 'refresh_token': 'synthetic-refresh',
    'scope': ' '.join(sorted(gmail.SCOPES)),
}
THREAD = {'messages': [{
    'threadId': POLICY['threadId'],
    'payload': {'headers': [
        {'name': 'Subject', 'value': '[Harness test] Fixture'},
        {'name': 'Message-ID', 'value': '<test@example.test>'},
    ]},
}]}


class GmailGrantTests(unittest.TestCase):
    def setUp(self):
        self.requests = []

    def requester(self, token=REPLY, thread=THREAD):
        def request(url, form=None, *, bearer=None):
            self.requests.append((url, form, bearer))
            return token if url == gmail.TOKEN else thread
        return request

    def test_only_pinned_headers_and_token_post_are_requested(self):
        record = gmail.exchange(POLICY, PACKET, self.requester(), 100)
        token, headers = self.requests
        self.assertEqual(token[0], gmail.TOKEN)
        self.assertEqual(token[1]['code_verifier'], PACKET['codeVerifier'])
        self.assertIsNone(token[2])
        url = urlsplit(headers[0])
        self.assertEqual((url.scheme, url.netloc), ('https', 'gmail.googleapis.com'))
        self.assertTrue(url.path.endswith('/fixture%40gmail.com/threads/a11b'))
        self.assertEqual(parse_qs(url.query), {
            'format': ['metadata'], 'fields': [gmail.HEADER_FIELDS],
            'metadataHeaders': ['Message-ID', 'Subject', 'References'],
        })
        self.assertIsNone(headers[1])
        self.assertEqual(record['validUntil'], 100 + 86400)
        self.assertNotIn('access_token', record)
        self.assertNotIn('code', record)

    def test_refuses_forged_state_wrong_project_wrong_thread_and_overgrant(self):
        bad = [
            ({**POLICY, 'project': 'different-project'}, PACKET),
            (POLICY, {**PACKET, 'state': 'b' * 43}),
            (POLICY, {**PACKET, 'redirectUri': 'https://other.example.test/'}),
        ]
        for policy, packet in bad:
            with self.assertRaises(gmail.GrantError):
                gmail.exchange(policy, packet, self.requester(), 100)
        self.assertEqual(self.requests, [])
        for scope in ('', REPLY['scope'] + ' https://www.googleapis.com/auth/gmail.readonly'):
            with self.assertRaises(gmail.GrantError):
                gmail.exchange(POLICY, PACKET, self.requester({**REPLY, 'scope': scope}), 100)
        self.assertEqual([item[0] for item in self.requests], [gmail.TOKEN, gmail.TOKEN])
        with self.assertRaises(gmail.GrantError):
            gmail.exchange({**POLICY, 'threadId': 'a000'}, PACKET, self.requester(), 100)

    def test_consent_has_only_the_two_scopes_and_the_callback_rejects_other_states(self):
        url = consent.consent_url(POLICY, PACKET['state'], PACKET['codeVerifier'], PACKET['redirectUri'])
        parsed = urlsplit(url)
        query = parse_qs(parsed.query)
        self.assertEqual((parsed.scheme, parsed.netloc), ('https', 'accounts.google.com'))
        self.assertEqual(set(query['scope'][0].split()), gmail.SCOPES)
        self.assertEqual(query['code_challenge_method'], ['S256'])
        self.assertEqual(query['include_granted_scopes'], ['false'])
        self.assertNotIn(PACKET['codeVerifier'], url)
        state = PACKET['state']
        self.assertIsNone(consent.callback_code('/?state=other&code=synthetic-code', state))
        self.assertIsNone(consent.callback_code(f'/?state={state}&code=a&code=b', state))
        self.assertEqual(consent.callback_code(f'/?state={state}&code=synthetic-code', state), 'synthetic-code')

    def test_store_is_private_and_exclusive(self):
        record = gmail.exchange(POLICY, PACKET, self.requester({**REPLY, 'refresh_token_expires_in': 900}), 100)
        with tempfile.TemporaryDirectory() as fixture:
            root = os.path.realpath(fixture)
            gmail.write_grant(root, record)
            path = Path(root) / 'gmail-self-test.json'
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(path.read_bytes()), record)
            with self.assertRaises(gmail.GrantError):
                gmail.write_grant(root, {'invalid': True})
            self.assertEqual(gmail.private_record(path), record)
            path.chmod(0o640)
            with self.assertRaises(gmail.GrantError):
                gmail.private_record(path)

    def test_refresh_is_pinned_and_time_bounded(self):
        record = gmail.exchange(POLICY, PACKET, self.requester({**REPLY, 'refresh_token_expires_in': 900}), 100)
        self.requests.clear()
        for policy, at in [(POLICY, 1000), ({**POLICY, 'threadId': 'a000'}, 110)]:
            with self.assertRaises(gmail.GrantError):
                gmail.refresh(policy, record, self.requester(), at)
        self.assertEqual(self.requests, [])
        self.assertEqual(gmail.refresh(POLICY, record, self.requester(), 999), 'synthetic-access')
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(self.requests[0][1]['grant_type'], 'refresh_token')


if __name__ == '__main__':
    unittest.main()
