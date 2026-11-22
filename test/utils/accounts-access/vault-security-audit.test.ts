import { expect, test } from 'vitest';
import { vaultSecurityAudit } from '../../../src/utils/accounts-access/vaultSecurityAudit';

const window = { from: 1_000, to: 9_000, leaseSessions: ['s-lease'] };

test('is clean when only the lease login and unrelated events occur in the window', () => {
	const verdict = vaultSecurityAudit(
		[
			{ kind: 'login', at: 1_500, session: 's-lease' },
			{ kind: 'other', at: 2_000 },
			{ kind: 'token-created', at: 500 }
		],
		window
	);
	expect(verdict).toEqual({ verdict: 'clean', checked: 2 });
});

test('alerts on new tokens, grants, recovery, 2FA or password changes and foreign sessions', () => {
	for (const kind of [
		'token-created',
		'oauth-grant',
		'recovery-changed',
		'mfa-changed',
		'password-changed'
	] as const) {
		expect(vaultSecurityAudit([{ kind, at: 5_000 }], window).verdict).toBe('alert');
	}
	expect(
		vaultSecurityAudit([{ kind: 'session-created', at: 5_000, session: 's-other' }], window).verdict
	).toBe('alert');
	expect(vaultSecurityAudit([{ kind: 'login', at: 5_000 }], window).verdict).toBe('alert');
});

test('never reports an unreadable log as clean', () => {
	expect(vaultSecurityAudit(null, window)).toMatchObject({ verdict: 'unverifiable' });
});
