import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { remoteFailureText } from '../../src/services/networking-security/remote-host-service/device-session-service/remoteFailureText';

test('keeps short ordinary error messages', () => {
	const cancelled = remoteFailureText(new Error('Pairing request was cancelled.'));
	const closed = remoteFailureText(new Error('Device session closed before the response arrived.'));

	expect(cancelled).toEqual({ code: 'failed', message: 'Pairing request was cancelled.' });
	expect(closed).toEqual({
		code: 'failed',
		message: 'Device session closed before the response arrived.'
	});
	recordExampleCases(
		{
			unitId: 'desktop.function.remote-failure-text',
			symbol: 'remoteFailureText',
			state: 'keeps-short-ordinary-error-messages',
			evidence: 'examples-cases',
			file: 'keeps-short-ordinary-error-messages.json'
		},
		[
			{
				name: 'cancelled pairing request',
				input: { message: 'Pairing request was cancelled.' },
				output: cancelled
			},
			{
				name: 'closed device session',
				input: { message: 'Device session closed before the response arrived.' },
				output: closed
			}
		]
	);
});

test('uses generic wording for hidden or unsafe details', () => {
	const root = '/workspace/user/projects/harness-app';
	const hiddenRoot = remoteFailureText(new Error(`Failed under ${root}/config.json`), [root]);
	const path = remoteFailureText(new Error('Could not read /var/tmp/session.json'));
	const nonError = remoteFailureText('connection refused');

	expect(hiddenRoot.code).toBe('failed');
	expect(hiddenRoot.message).not.toContain(root);
	expect(path.message).toBe(nonError.message);
	recordExampleCases(
		{
			unitId: 'desktop.function.remote-failure-text',
			symbol: 'remoteFailureText',
			state: 'uses-generic-wording-for-hidden-or-unsafe-details',
			evidence: 'examples-cases',
			file: 'uses-generic-wording-for-hidden-or-unsafe-details.json'
		},
		[
			{
				name: 'project root is hidden',
				input: { message: `Failed under ${root}/config.json`, roots: [root] },
				output: hiddenRoot
			},
			{
				name: 'absolute path is unsafe',
				input: { message: 'Could not read /var/tmp/session.json' },
				output: path
			},
			{ name: 'non-error value has no message', input: 'connection refused', output: nonError }
		]
	);
});
