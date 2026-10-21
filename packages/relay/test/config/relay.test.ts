import { expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import { profilePublicEntry } from '../../../../test/support/taskProfiles';
import { remoteLimits } from '../../../remote/src/index';
import { relayConfig } from '../../src/config/relayConfig';

test('relayConfig bounds what the relay reads and keeps', async () => {
	expect(
		await profilePublicEntry(
			'relay.config.relay',
			fileURLToPath(new URL('../../src/config/relayConfig.ts', import.meta.url)),
			['relayConfig']
		)
	).toEqual(['relayConfig']);
	expect(relayConfig.bodyBytes).toBe(16 * 1024);
	expect(relayConfig.internalOrigin).toBe('https://relay.internal');
	expect(relayConfig.tlsEnvironments).toEqual(['production', 'staging']);
	expect(relayConfig.openPairings).toBeGreaterThan(0);
	expect(relayConfig.sweepDelayMs).toBeLessThan(remoteLimits.pairingTtlMs);
});

test('relayConfig rate limits leave room for a phone that polls every two seconds', () => {
	expect(relayConfig.rateWindowMs).toBe(60_000);
	const pollsPerWindow = relayConfig.rateWindowMs / 2000;
	expect(relayConfig.pairingCalls).toBeGreaterThanOrEqual(2 * pollsPerWindow);
	expect(relayConfig.failedConnects).toBeGreaterThan(0);
	expect(relayConfig.failedConnects).toBeLessThanOrEqual(30);
	expect(relayConfig.deviceFrames).toBeGreaterThan(remoteLimits.pendingRequests);
});
