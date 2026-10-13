import { expect, test } from 'vitest';
import type { RemoteHostState } from '../../src/adapters/RemoteHostStoreAdapter';
import type { RemoteHostRuntimeService } from '../../src/services/RemoteHostRuntimeService';
import { remoteHostStatus } from '../../src/utils/remoteHostStatus';
import type { RemoteHostStatusInput } from '../../src/utils/remoteHostStatus';

const hostId = 'a'.repeat(40),
	deviceId = 'd'.repeat(40),
	project = { id: 'local-' + 'a'.repeat(64), name: 'Harness' };
const state: RemoteHostState = {
	enabled: true,
	origin: 'https://relay.example',
	hostId,
	keys: { d: 'private-scalar-value', publicKey: 'public-point-value' },
	credential: 'host-credential-value',
	generation: 1,
	revoked: [],
	devices: [
		{
			deviceId,
			deviceKey: 'device-key-value',
			name: 'Phone',
			platform: 'ios',
			projects: [project],
			agents: true,
			approvedAt: '2026-10-12T10:00:00.000Z',
			generation: 1,
			lastSeenAt: null
		}
	]
};
const offer = {
	pairingId: 'b'.repeat(32),
	code: 'ABCD-EFGH',
	expiresAt: '2026-10-12T10:05:00.000Z'
};
const runtime = (link: string, open = false) =>
	({
		link: { state: link },
		pairing: { offer: () => (open ? offer : null), requests: () => [] },
		online: () => true
	}) as unknown as RemoteHostRuntimeService;
const input = (overrides: Partial<RemoteHostStatusInput> = {}): RemoteHostStatusInput => ({
	supported: true,
	state,
	runtime: runtime('online'),
	phase: 'idle',
	reason: null,
	name: 'Mac',
	projects: [{ ...project, kind: 'local', root: '/Users/someone/harness' } as never],
	...overrides
});

test('the status is public metadata: no key, no credential, no folder', () => {
	const status = remoteHostStatus(input({ runtime: runtime('online', true) })),
		text = JSON.stringify(status);
	for (const secret of [
		'host-credential-value',
		'private-scalar-value',
		'device-key-value',
		'/Users/'
	])
		expect(text).not.toContain(secret);
	expect(status).toMatchObject({
		supported: true,
		enabled: true,
		state: 'online',
		reason: null,
		host: { id: hostId, name: 'Mac' },
		origin: 'https://relay.example',
		projects: [project],
		devices: [{ deviceId, name: 'Phone', projectIds: [project.id], agents: true, online: true }]
	});
	const seconds = Math.floor(Date.parse(offer.expiresAt) / 1000);
	const fields = `exp=${seconds};host=${hostId};pairing=${offer.pairingId};code=${offer.code.replace('-', '')}`;
	expect(status.pairing).toEqual({
		...offer,
		hostId,
		origin: 'https://relay.example',
		scan: `harness-pair:v1;aud=harness-phone;env=production;${fields};origin=https://relay.example`
	});
});
test('the state follows support, registration, enablement and the link, with words when not online', () => {
	const cases: [Partial<RemoteHostStatusInput>, string][] = [
		[{ supported: false }, 'unavailable'],
		[{ phase: 'registering' }, 'registering'],
		[{ phase: 'signed-out', state: null, runtime: null }, 'signed-out'],
		[{ state: null, runtime: null }, 'disabled'],
		[{ state: { ...state, enabled: false }, runtime: null }, 'disabled'],
		[{ runtime: runtime('connecting') }, 'connecting'],
		[{ runtime: runtime('offline') }, 'offline'],
		[{ runtime: null }, 'offline']
	];
	for (const [overrides, expected] of cases)
		expect(remoteHostStatus(input(overrides)).state).toBe(expected);
	expect(remoteHostStatus(input({ supported: false }))).toMatchObject({
		enabled: false,
		host: null,
		devices: [],
		pairing: null
	});
	expect(remoteHostStatus(input({ runtime: runtime('offline') })).reason).toMatch(/offline/);
	expect(remoteHostStatus(input({ reason: 'Explained' })).reason).toBe('Explained');
});
