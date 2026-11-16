import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { EmailProofController } from '../../src/lib/verification-evidence/server/auth/EmailProofController';
import type { EmailProofControllerOptions } from '../../src/lib/verification-evidence/server/auth/EmailProofController.types';

const options = (proofs: Record<string, (...args: never[]) => unknown>): EmailProofControllerOptions => ({
	proofs: proofs as unknown as EmailProofControllerOptions['proofs'],
	sessions: { crossOrigin: () => false } as unknown as EmailProofControllerOptions['sessions']
});

test('Starts email proof for a browser request', async () => {
	const controller = new EmailProofController(options({ start: async () => ({ status: 'sent' }) }));
	const response = await controller.routes()['POST /api/auth/email/start'](
		new Request('https://example.test/api/auth/email/start', { method: 'POST' })
	);
	const body = await response.json();
	expect(response.status).toBe(200);
	expect(body).toEqual({ actor: null, emailProof: { status: 'sent' } });
	recordExampleCases(
		{ unitId: 'hub.controller.email-proof', symbol: 'start', state: 'starts-email-proof-for-a-browser-request', evidence: 'examples-cases', file: 'starts-email-proof-for-a-browser-request.json' },
		[{ name: 'browser starts email proof without an existing cookie', input: { method: 'POST', cookie: null }, output: { status: response.status, body } }]
	);
});

test('Verifies an email code and issues a session', async () => {
	const controller = new EmailProofController(options({
		verify: async () => ({ credential: 'session-example', record: { actor: { id: 'actor-example' } } })
	}));
	const response = await controller.routes()['POST /api/auth/email/verify'](
		new Request('https://example.test/api/auth/email/verify', {
			method: 'POST', headers: { 'content-type': 'application/json', cookie: 'email-proof=pending-example' },
			body: JSON.stringify({ code: '12345678' })
		})
	);
	const body = await response.json();
	expect(response.status).toBe(200);
	expect(body).toEqual({ actor: { id: 'actor-example' } });
	expect(response.headers.get('set-cookie')).toContain('session-example');
	recordExampleCases(
		{ unitId: 'hub.controller.email-proof', symbol: 'verify', state: 'verifies-an-email-code-and-issues-a-session', evidence: 'examples-cases', file: 'verifies-an-email-code-and-issues-a-session.json' },
		[{ name: 'valid code exchanges pending proof for a session', input: { code: '12345678', cookie: 'pending-example' }, output: { status: response.status, body } }]
	);
});
