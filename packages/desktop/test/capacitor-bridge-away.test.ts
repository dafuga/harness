import { expect, test, vi } from 'vitest';
import { CapacitorBridgeAdapter } from '../src/adapters/CapacitorBridgeAdapter';
import type { RemoteNativePlugin, RemoteNativeStatus } from '../src/models/Environment.types';

const online: RemoteNativeStatus = {
	state: 'online',
	origin: 'https://relay.example.invalid',
	host: { id: 'a1'.repeat(20), name: 'Studio Mac' },
	device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
	grant: { projects: [{ id: 'local-1', name: 'One' }], agents: true },
	reason: null,
	lastOnlineAt: null
};
function phone(status: RemoteNativeStatus) {
	const request = vi.fn(async () => ({ value: [] }));
	const plugin = { request, addListener: vi.fn() } as unknown as RemoteNativePlugin;
	const adapter = new CapacitorBridgeAdapter({ plugin });
	adapter.allow(status);
	return { adapter, bridge: adapter.connect(), request };
}
/** Drafts, permissions and comments are never answered from a saved copy. */
const live = ['pendingComments', 'capabilities', 'addComment'];
const saved = ['listProjects', 'selectProject', 'history'];

test('while the computer is away the page does not find what a saved copy never answers', () => {
	for (const state of ['offline', 'connecting'] as const) {
		const surface = phone({ ...online, state }).bridge as unknown as Record<string, unknown>;
		for (const name of live) expect(surface[name]).toBeUndefined();
		for (const name of saved) expect(typeof surface[name]).toBe('function');
	}
});

test('it finds them again as soon as the computer is reached, and loses them when it is lost', () => {
	const { adapter, bridge } = phone({ ...online, state: 'offline' });
	const surface = bridge as unknown as Record<string, unknown>;
	adapter.allow(online);
	for (const name of [...live, ...saved]) expect(typeof surface[name]).toBe('function');
	adapter.allow({ ...online, state: 'offline' });
	for (const name of live) expect(surface[name]).toBeUndefined();
});
