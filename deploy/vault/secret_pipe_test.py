"""Transfer synthetic data through private child streams and assert status only."""

import json
from pathlib import Path
import subprocess
import tempfile
import sys
import unittest

from secret_pipe import transfer


def python(code):
    return [sys.executable, '-c', code]


class SecretPipeTests(unittest.TestCase):
    def test_child_stdout_stderr_and_secret_do_not_escape(self):
        probe = (
            'from secret_pipe import transfer; import sys; '
            'transfer([sys.executable, "-c", "print(4172, end=\'\')"], '
            '[sys.executable, "-c", '
            '"import sys; assert sys.stdin.buffer.read() == b\'4172\'; '
            'print(4172); print(4172, file=sys.stderr)"])'
        )
        result = subprocess.run(python(probe), cwd=Path(__file__).parent, capture_output=True, check=True)
        self.assertEqual((result.stdout, result.stderr), (b'', b''))

    def test_scoped_recipes_put_only_the_selected_field_into_the_store(self):
        structures = {
            'google-oauth-web-client': {'web': {'client_secret': 'fixture', 'client_id': 'other'}},
            'stripe-webhook': {'secret': 'fixture', 'id': 'other'},
            'cloudflare-token': {'result': {'value': 'fixture', 'id': 'other'}},
            'openai-service-account-key': {'value': 'fixture', 'id': 'other'},
            'twilio-key': {'secret': 'fixture', 'sid': 'other'},
            'npm-token': {'token': 'fixture', 'key': 'other'},
        }
        writer = python("import sys; assert sys.stdin.buffer.read() == b'fixture'")
        for recipe, response in structures.items():
            with self.subTest(recipe=recipe):
                producer = python(f'print({json.dumps(json.dumps(response))})')
                transfer(producer, writer, recipe=recipe)

    def test_failed_producer_cannot_invoke_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / 'writer-invoked'
            writer = python('from pathlib import Path; import sys; Path(sys.argv[1]).touch()')
            with self.assertRaisesRegex(RuntimeError, '^Secret transfer failed[.]'):
                transfer(python('print(4172); raise SystemExit(1)'), [*writer, str(marker)])
            self.assertFalse(marker.exists())

    def test_writer_error_prints_no_provider_or_sink_output(self):
        with self.assertRaisesRegex(RuntimeError, '^Secret transfer failed[.]'):
            transfer(python('print(4172)'), python('print(4172); raise SystemExit(1)'))

    def test_oversized_output_stops_before_writing(self):
        with self.assertRaisesRegex(RuntimeError, '^Secret transfer failed[.]'):
            transfer(python('print("X" * 65537)'), [sys.executable, '-c', 'raise SystemExit(0)'])


if __name__ == '__main__':
    unittest.main()
