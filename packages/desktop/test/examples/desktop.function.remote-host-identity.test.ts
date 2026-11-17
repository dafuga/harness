import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { remoteHostIdentity, registerRemoteHost } from '../../src/services/networking-security/remote-host-service/remote-host-switch-service/remoteHostIdentity';
import { HubNoRelayError } from '../../src/services/networking-security/remote-host-service/remote-host-switch-service/remoteHostIdentity.types';
import type { RegisterRemoteHost } from '../../src/utils/networking-security/remoteHostIdentity';

test('creates a disabled identity ready for registration', async () => {
	const state = await remoteHostIdentity();
	const output = {
		enabled: state.enabled,
		origin: state.origin,
		hostId: state.hostId,
		keys: { publicKey: state.keys.publicKey },
		credentialPresent: state.credential.length > 0,
		generation: state.generation,
		devices: state.devices,
		revoked: state.revoked
	};

	expect(output).toMatchObject({
		enabled: false,
		origin: null,
		generation: 0,
		devices: [],
		revoked: []
	});
	expect(output.hostId).toMatch(/^[a-f0-9]{40}$/);
	expect(output.keys.publicKey).toBeTruthy();
	expect(output.credentialPresent).toBe(true);

	recordExampleCases(
		{
			unitId: 'desktop.function.remote-host-identity',
			symbol: 'remoteHostIdentity',
			state: 'creates-a-disabled-identity-ready-for-registration',
			evidence: 'examples-cases',
			file: 'creates-a-disabled-identity-ready-for-registration.json'
		},
		[{ name: 'generate a fresh host identity', input: {}, output }]
	);
});

test('registers the host and adopts its accepted relay', async () => {
	const state = await remoteHostIdentity();
	let request: Parameters<RegisterRemoteHost>[0] | undefined;
	const register: RegisterRemoteHost = async (input) => {
		request = input;
		return {
			origin: 'http://localhost:4312',
			hostId: state.hostId,
			generation: 7,
			registeredAt: '2026-11-17T10:00:00.000Z'
		};
	};
	const keys = await registerRemoteHost(state, 'Studio Mac', register);
	const output = {
		enabled: state.enabled,
		origin: state.origin,
		hostId: state.hostId,
		generation: state.generation,
		returnedPublicKeyPresent: keys.publicKey.length > 0,
		request: request && {
			hostId: request.hostId,
			hostKey: request.hostKey,
			credentialHashPresent: request.credentialHash.length > 0,
			name: request.name
		}
	};

	expect(state).toMatchObject({ enabled: true, origin: 'http://localhost:4312', generation: 7 });
	expect(request).toMatchObject({ hostId: state.hostId, hostKey: state.keys.publicKey, name: 'Studio Mac' });
	expect(output.returnedPublicKeyPresent).toBe(true);

	recordExampleCases(
		{
			unitId: 'desktop.function.remote-host-identity',
			symbol: 'registerRemoteHost',
			state: 'registers-the-host-and-adopts-its-accepted-relay',
			evidence: 'examples-cases',
			file: 'registers-the-host-and-adopts-its-accepted-relay.json'
		},
		[
			{
				name: 'register with the hub and accept loopback relay',
				input: { hostId: state.hostId, name: 'Studio Mac', origin: 'http://localhost:4312' },
				output
			}
		]
	);
});

test('rejects a registration for a different host identity', async () => {
	const state = await remoteHostIdentity();
	const register: RegisterRemoteHost = async () => ({
		origin: 'https://relay.example.test',
		hostId: 'different-host-id',
		generation: 1,
		registeredAt: '2026-11-17T10:00:00.000Z'
	});
	let thrown: unknown;
	try {
		await registerRemoteHost(state, 'Studio Mac', register);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(HubNoRelayError);
	expect(thrown).toMatchObject({ message: 'The hub named no relay.' });
	expect(state.enabled).toBe(false);
	if (!(thrown instanceof Error)) throw new Error('Expected a registration response error.');

	recordExampleCases(
		{
			unitId: 'desktop.function.remote-host-identity',
			symbol: 'registerRemoteHost',
			state: 'rejects-a-registration-for-a-different-host-identity',
			evidence: 'examples-cases',
			file: 'rejects-a-registration-for-a-different-host-identity.json'
		},
		[
			{
				name: 'reject a hub response naming another host',
				input: { hostId: state.hostId, responseHostId: 'different-host-id' },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
