import { expect, test, vi } from 'vitest';
import { VaultTeardownService } from '../../../src/services/accounts-access/VaultTeardownService';
import {
	vaultTeardown,
	vaultTeardownLimits
} from '../../../src/utils/accounts-access/vaultTeardown';

const leaseStartedAt = 1_000_000;
const endedAt = leaseStartedAt + 60_000;
const steps = vaultTeardown({
	browser: true,
	leaseStartedAt,
	endedAt,
	teardown: { logout: '/logout', revoke: null, securityLog: 'fixture-security-log' }
});

test('run performs ordered cleanup and carries the second check until it is due', async () => {
	const observed: string[] = [];
	let now = endedAt;
	const service = new VaultTeardownService({
		now: () => now,
		cleanup: async (step: { step: string }) => {
			observed.push(step.step);
		},
		readSecurityLog: async () => {
			observed.push('read-security-log');
			return [];
		}
	});
	const outcome = await service.run(steps, []);
	expect(observed).toEqual([
		'close-cdp-endpoint',
		'provider-logout',
		'remove-container',
		'verify-removal',
		'read-security-log'
	]);
	expect(outcome.audit).toEqual([{ verdict: 'clean', checked: 0 }]);
	expect(outcome.followUps).toHaveLength(1);
	now += vaultTeardownLimits.recheckMs;
	const repeated = await service.run(outcome.followUps, []);
	expect(repeated.followUps).toEqual([]);
	expect(repeated.audit).toEqual([{ verdict: 'clean', checked: 0 }]);
});

test('run still removes the guest when provider logout fails and records an unverifiable audit', async () => {
	const cleanup = vi.fn(async (step: { step: string }) => {
		if (step.step === 'provider-logout') throw new Error('synthetic failure with private detail');
	});
	const service = new VaultTeardownService({
		now: () => endedAt,
		cleanup,
		readSecurityLog: async () => null
	});
	const outcome = await service.run(steps, []);
	expect(cleanup).toHaveBeenCalledWith(expect.objectContaining({ step: 'remove-container' }));
	expect(outcome.failed).toEqual(['provider-logout']);
	expect(outcome.audit[0]).toMatchObject({ verdict: 'unverifiable' });
	expect(JSON.stringify(outcome)).not.toContain('private detail');
});
