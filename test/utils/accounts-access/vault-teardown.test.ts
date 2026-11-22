import { expect, test } from 'vitest';
import {
	vaultTeardown,
	vaultTeardownLimits
} from '../../../src/utils/accounts-access/vaultTeardown';

const endedAt = 2_000_000;
const by = endedAt + vaultTeardownLimits.completeMs;

test('closes the CDP endpoint, signs out and revokes, destroys the container, then checks the log twice', () => {
	const steps = vaultTeardown({
		teardown: { logout: '/logout', revoke: 'sessions-api', securityLog: 'audit-page' },
		browser: true,
		leaseStartedAt: 1_000_000,
		endedAt
	});
	expect(steps).toEqual([
		{ step: 'close-cdp-endpoint', by },
		{ step: 'provider-logout', path: '/logout', by },
		{ step: 'revoke-sessions', via: 'sessions-api', by },
		{ step: 'remove-container', by },
		{ step: 'verify-removal', by },
		{ step: 'security-log', source: 'audit-page', at: endedAt, from: 1_000_000 },
		{
			step: 'security-log',
			source: 'audit-page',
			at: endedAt + vaultTeardownLimits.recheckMs,
			from: 1_000_000
		}
	]);
});

test('flags an unverifiable lease when the recipe has no security log', () => {
	const steps = vaultTeardown({
		teardown: { logout: null, revoke: 'token-revoke', securityLog: null },
		browser: false,
		leaseStartedAt: 1_000_000,
		endedAt
	});
	expect(steps.map(({ step }) => step)).toEqual([
		'close-cdp-endpoint',
		'revoke-sessions',
		'flag-unverifiable'
	]);
});
