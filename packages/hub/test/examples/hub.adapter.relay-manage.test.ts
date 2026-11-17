import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RelayManageAdapter } from '../../src/routes/api/[...path]/RelayManageAdapter';
import type { RelayManageAdapterConfig, Operation } from '../../src/routes/api/[...path]/RelayManageAdapter.types';

const hostId = '3f9a1c07b2e84d5f96a0c1e7d4b2a8f05c9e6d13';
const owner = { owner: { id: 'google-104857392016548213374' }, hostId };

function adapterFor(operation: Operation, payload: unknown): RelayManageAdapter {
	const namespace = {
		idFromName: (name: string) => name,
		get: () => ({
			fetch: async (url: string) => {
				if (!url.endsWith(`/manage/${operation}`)) throw new Error('unexpected operation');
				return Response.json(payload);
			}
		})
	} as unknown as DurableObjectNamespace;
	const config: RelayManageAdapterConfig = { hosts: namespace };
	return new RelayManageAdapter(config);
}

const unavailable = { code: 'unavailable', message: 'Harness artifact unavailable' };
const offline = () => Promise.reject(new Error('relay offline'));
const notJson = () => Promise.resolve(new Response('upstream gone'));
const refusals = [
	{ status: 400, error: 'invalid-input' },
	{ status: 403, error: 'forbidden' },
	{ status: 404, error: 'not-found' }
];

function adapterAnswering(respond: () => Promise<Response>): RelayManageAdapter {
	const namespace = {
		idFromName: (name: string) => name,
		get: () => ({ fetch: respond })
	} as unknown as DurableObjectNamespace;
	const config: RelayManageAdapterConfig = { hosts: namespace };
	return new RelayManageAdapter(config);
}

async function failureOf(call: Promise<unknown>): Promise<{ code: unknown; message: unknown }> {
	try {
		await call;
	} catch (error) {
		const { code, message } = error as { code: unknown; message: unknown };
		return { code, message };
	}
	throw new Error('the call was expected to fail');
}

function summaryFailure(respond: () => Promise<Response>): Promise<{ code: unknown; message: unknown }> {
	return failureOf(adapterAnswering(respond).summary(owner));
}

test('register returns the relay registration', async () => {
	const input = {
		...owner,
		hostKey: 'BNq3vXk9Rf2TzLw8Ys1Hd6Jc4Ua0Ge7Mp5Vb2Iy9Oi3Qa8Wt6Zr1Eu4Lx0Ck7Sn5Dh2Fj9Gm3Pb8Tv6Yo1Ka4Ze',
		credentialHash: 'a6f0e2c94b7d13085e9af2c6d4b8107e35c9f1a2b0d7e8643c5f9a1b2d3e4f60',
		name: 'Studio Mac mini'
	};
	const payload = { hostId, generation: 1, registeredAt: '2026-11-14T18:02:47.913Z' };
	const output = await adapterFor('register', payload).register(input);
	expect(output).toEqual(payload);
	recordExampleCases(
		{ unitId: 'hub.adapter.relay-manage', symbol: 'RelayManageAdapter.register', state: 'register-returns-the-relay-registration', evidence: 'examples-cases', file: 'register-returns-the-relay-registration.json' },
		[{ name: 'relay returns the first registration', input, output }]
	);
});

test('summary returns the relay host and devices', async () => {
	const payload = {
		hostId, name: 'Studio Mac mini', online: true, generation: 2,
		registeredAt: '2026-11-14T18:02:47.913Z',
		devices: [{ deviceId: '9b41e0d7c6a25f83e1b0d4c97a6f2e5081d3ab64', online: true,
			createdAt: '2026-11-14T18:40:11.205Z', lastSeenAt: '2026-11-15T09:28:51.602Z' }]
	};
	const output = await adapterFor('summary', payload).summary(owner);
	expect(output).toEqual(payload);
	recordExampleCases(
		{ unitId: 'hub.adapter.relay-manage', symbol: 'RelayManageAdapter.summary', state: 'summary-returns-the-relay-host-and-devices', evidence: 'examples-cases', file: 'summary-returns-the-relay-host-and-devices.json' },
		[{ name: 'relay returns current host status and device activity', input: owner, output }]
	);
});

test('revokeDevice returns the relay acknowledgement', async () => {
	const input = { ...owner, deviceId: '9b41e0d7c6a25f83e1b0d4c97a6f2e5081d3ab64' };
	const output = await adapterFor('revoke-device', { ok: true }).revokeDevice(input);
	expect(output).toEqual({ ok: true });
	recordExampleCases(
		{ unitId: 'hub.adapter.relay-manage', symbol: 'RelayManageAdapter.revokeDevice', state: 'revokedevice-returns-the-relay-acknowledgement', evidence: 'examples-cases', file: 'revokedevice-returns-the-relay-acknowledgement.json' },
		[{ name: 'relay confirms the device was revoked', input, output }]
	);
});

test('unregister returns the relay acknowledgement', async () => {
	const output = await adapterFor('unregister', { ok: true }).unregister(owner);
	expect(output).toEqual({ ok: true });
	recordExampleCases(
		{ unitId: 'hub.adapter.relay-manage', symbol: 'RelayManageAdapter.unregister', state: 'unregister-returns-the-relay-acknowledgement', evidence: 'examples-cases', file: 'unregister-returns-the-relay-acknowledgement.json' },
		[{ name: 'relay confirms the host was unregistered', input: owner, output }]
	);
});

test('Throws unavailable when the relay call fails', async () => {
	const offlineFailure = await summaryFailure(offline);
	const notJsonFailure = await summaryFailure(notJson);
	expect(offlineFailure).toEqual(unavailable);
	expect(notJsonFailure).toEqual(unavailable);
	recordExampleCases(
		{ unitId: 'hub.adapter.relay-manage', symbol: 'RelayManageAdapter.summary', state: 'throws-unavailable-when-the-relay-call-fails', evidence: 'examples-cases', file: 'throws-unavailable-when-the-relay-call-fails.json' },
		[
			{ name: 'the call to the host object throws', input: owner, error: offlineFailure },
			{ name: 'the relay answer is not JSON', input: owner, error: notJsonFailure }
		]
	);
});

test('Throws relay error codes for HTTP 400, 403 and 404', async () => {
	const failures = await Promise.all(
		refusals.map((refusal) =>
			summaryFailure(() => Promise.resolve(Response.json({ error: refusal.error }, { status: refusal.status })))
		)
	);
	expect(failures).toEqual(refusals.map(({ error }) => ({ code: error, message: unavailable.message })));
	recordExampleCases(
		{ unitId: 'hub.adapter.relay-manage', symbol: 'RelayManageAdapter.summary', state: 'throws-relay-error-codes-for-http-400-403-and-404', evidence: 'examples-cases', file: 'throws-relay-error-codes-for-http-400-403-and-404.json' },
		refusals.map((refusal, index) => ({ name: `relay answers HTTP ${refusal.status} ${refusal.error}`, input: refusal, error: failures[index] }))
	);
});
