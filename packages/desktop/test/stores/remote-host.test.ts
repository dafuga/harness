import { expect, test, vi } from 'vitest';
import { createRemoteHostStore } from '../../src/lib/stores/remoteHost.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { RemoteHostStatus } from '../../src/models/Environment.types';

const off: RemoteHostStatus = {
	supported: true,
	enabled: false,
	state: 'disabled',
	reason: null,
	host: null,
	origin: 'https://relay.example.invalid',
	pairing: null,
	requests: [],
	devices: [],
	projects: [{ id: 'local-1', name: 'One' }]
};
const on: RemoteHostStatus = { ...off, enabled: true, state: 'online' };
function desktop() {
	let listener: (status: RemoteHostStatus) => void = () => {};
	const release = vi.fn();
	const port = {
		status: vi.fn(async () => off),
		enable: vi.fn(async () => on),
		disable: vi.fn(async () => off),
		createPairing: vi.fn(async () => ({ pairingId: 'b2'.repeat(16) })),
		approvePairing: vi.fn(async () => on),
		denyPairing: vi.fn(async () => on),
		revokeDevice: vi.fn(async () => on),
		onStatus: vi.fn((next: typeof listener) => {
			listener = next;
			return release;
		})
	};
	const workspace = { remote: { host: port } } as unknown as Workspace;
	const announce = (status: RemoteHostStatus) => listener(status);
	return { store: createRemoteHostStore(workspace), port, release, announce };
}

test('the status is asked once, then heard, until the store is disposed', async () => {
	const { store, port, release, announce } = desktop();
	await store.start();
	await store.start();
	expect(port.status).toHaveBeenCalledOnce();
	expect(store.status).toEqual(off);
	announce(on);
	expect(store.status?.state).toBe('online');
	store.dispose();
	expect(release).toHaveBeenCalledOnce();
});

test('a pairing offer is read from the status again, and a grant is passed exactly as chosen', async () => {
	const { store, port } = desktop();
	await store.start();
	port.status.mockResolvedValueOnce({ ...on, pairing: { code: 'KQ7M2XWP' } } as never);
	expect(await store.createPairing()).toBe(true);
	expect(store.status?.pairing?.code).toBe('KQ7M2XWP');
	const grant = {
		pairingId: 'b2'.repeat(16),
		deviceId: 'd'.repeat(40),
		projectIds: ['local-1'],
		agents: false
	};
	await store.approve(grant);
	expect(port.approvePairing).toHaveBeenCalledWith(grant);
	await store.deny('pairing-2');
	expect(port.denyPairing).toHaveBeenCalledWith({ pairingId: 'pairing-2' });
	await store.revoke('device-1');
	expect(port.revokeDevice).toHaveBeenCalledWith({ deviceId: 'device-1' });
});

test('a refusal is shown and changes nothing, and a second request waits for the first', async () => {
	const { store, port } = desktop();
	await store.start();
	port.enable.mockRejectedValueOnce(new Error('Sign in to shared projects first.'));
	expect(await store.enable()).toBe(false);
	expect(store.error).toContain('Sign in to shared projects first.');
	expect(store.status).toEqual(off);
	const first = store.enable();
	expect(await store.disable()).toBe(false);
	expect(await first).toBe(true);
	expect(port.disable).not.toHaveBeenCalled();
	expect(store.error).toBe('');
});

test('a runtime without the control port does nothing', async () => {
	const store = createRemoteHostStore({ remote: {} } as unknown as Workspace);
	await store.start();
	expect(await store.enable()).toBe(false);
	expect(store.status).toBeNull();
});
