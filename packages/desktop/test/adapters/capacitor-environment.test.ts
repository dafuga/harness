import { expect, test, vi } from 'vitest';
import { CapacitorEnvironmentAdapter } from '../../src/adapters/CapacitorEnvironmentAdapter';
import type { RemoteNativePlugin, RemoteNativeStatus } from '../../src/models/Environment.types';

type Listener = (value: never) => void;
const unpaired: RemoteNativeStatus = {
	state: 'unpaired',
	origin: null,
	host: null,
	device: null,
	grant: null,
	reason: null,
	lastOnlineAt: null
};
const online: RemoteNativeStatus = {
	...unpaired,
	state: 'online',
	host: { id: 'a1'.repeat(20), name: 'Studio Mac' },
	device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
	grant: { projects: [], agents: false },
	methods: ['listProjects', 'snapshot']
};
function native(first: RemoteNativeStatus = unpaired) {
	const remove = vi.fn(async () => {});
	const listeners = new Map<string, Listener>();
	const plugin = {
		status: vi.fn(async () => first),
		scan: vi.fn(async () => ({ ...unpaired, state: 'pairing' as const })),
		disconnect: vi.fn(async () => unpaired),
		request: vi.fn(),
		addListener: vi.fn(async (name: string, listener: Listener) => {
			listeners.set(name, listener);
			return { remove };
		})
	};
	const emit = (name: string, value: unknown) => listeners.get(name)?.(value as never);
	const adapter = new CapacitorEnvironmentAdapter({
		plugin: plugin as unknown as RemoteNativePlugin
	});
	return { plugin, remove, emit, environment: adapter.connect() };
}

test('the phone control port is the native plugin, and nothing of the desktop is offered', async () => {
	const { plugin, environment } = native();
	expect(environment).toMatchObject({ kind: 'capacitor', local: false });
	expect(environment.host).toBeUndefined();
	expect(await environment.phone!.status()).toBe(unpaired);
	expect((await environment.phone!.scan({ deviceName: 'Ada iPhone' })).state).toBe('pairing');
	expect(plugin.scan).toHaveBeenCalledExactlyOnceWith({ deviceName: 'Ada iPhone' });
	expect('pair' in environment.phone!).toBe(false);
	await environment.phone!.disconnect();
	expect(plugin.disconnect).toHaveBeenCalledOnce();
});

test('status is heard through the plugin until the listener is released', async () => {
	const { plugin, remove, emit, environment } = native();
	const listener = vi.fn();
	const release = environment.phone!.onStatus(listener);
	expect(plugin.addListener).toHaveBeenCalledWith('status', expect.any(Function));
	emit('status', online);
	expect(listener).toHaveBeenCalledExactlyOnceWith(online);
	release();
	await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
});

test('each status decides at once what the bridge offers, before anyone acts on it', async () => {
	const { emit, environment } = native(online);
	const bridge = environment.bridge!;
	expect(bridge.listProjects).toBeUndefined();
	await environment.phone!.status();
	expect(typeof bridge.listProjects).toBe('function');
	expect(bridge.addComment).toBeUndefined();
	const seen: boolean[] = [];
	environment.phone!.onStatus(() => seen.push(typeof bridge.addComment === 'function'));
	emit('status', { ...online, methods: ['listProjects', 'snapshot', 'addComment'] });
	emit('status', { ...unpaired, state: 'revoked' });
	expect(seen).toEqual([true, false]);
	expect(bridge.listProjects).toBeUndefined();
});

test('what the scanner refuses reaches the page with its code, and no pairing link is listened for', async () => {
	const { plugin, environment } = native();
	const refusal = Object.assign(new Error('Camera access is off.'), { code: 'camera-denied' });
	plugin.scan.mockRejectedValueOnce(refusal);
	await expect(environment.phone!.scan({ deviceName: 'Ada iPhone' })).rejects.toBe(refusal);
	expect('links' in environment).toBe(false);
	expect(plugin.addListener).not.toHaveBeenCalledWith('pairingLink', expect.any(Function));
});
