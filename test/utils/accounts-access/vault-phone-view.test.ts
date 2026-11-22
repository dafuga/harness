import { expect, test } from 'vitest';
import {
	vaultPhoneView,
	vaultPhoneViewMs
} from '../../../src/utils/accounts-access/vaultPhoneView';

const now = 5_000_000;

test('uses the Harness relay first, then the Access tunnel with a one-time token', () => {
	expect(vaultPhoneView({ phase: 'pending', relay: 'up', accessTunnel: 'up', now })).toEqual({
		transport: 'harness-relay',
		expiresAt: now + vaultPhoneViewMs
	});
	expect(vaultPhoneView({ phase: 'pending', relay: 'down', accessTunnel: 'up', now })).toEqual({
		transport: 'access-tunnel',
		oneTimeToken: true,
		expiresAt: now + vaultPhoneViewMs
	});
});

test('offers no view when both transports are down or the login is no longer pending', () => {
	expect(
		vaultPhoneView({ phase: 'pending', relay: 'down', accessTunnel: 'unconfigured', now })
	).toMatchObject({
		transport: 'none'
	});
	expect(
		vaultPhoneView({ phase: 'operating', relay: 'up', accessTunnel: 'up', now })
	).toMatchObject({
		transport: 'none'
	});
});
