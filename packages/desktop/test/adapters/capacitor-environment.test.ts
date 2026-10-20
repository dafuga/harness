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

test('an unpaired phone signs in and lists owned and invited account projects without a Mac', async () => {
	const f = native();
	let connected = true;
	const signed = {
		configured: true,
		state: 'signed-in',
		actor: { id: 'google:ada', name: 'Ada', email: 'ada@example.invalid' }
	};
	const account = {
		status: vi.fn(async () => (connected ? signed : { configured: true, state: 'signed-out' })),
		connect: vi.fn(async () => signed),
		disconnect: vi.fn(async () => {
			connected = false;
			return { configured: true, state: 'signed-out' };
		}),
		request: vi.fn(async () => ({
			status: 200,
			contentType: 'application/json',
			data: btoa(
				JSON.stringify([
					{ id: '11111111-1111-4111-8111-111111111111', name: 'Owned', role: 'owner' },
					{ id: '22222222-2222-4222-8222-222222222222', name: 'Invited', role: 'viewer' }
				])
			)
		}))
	};
	const config = { plugin: f.plugin as unknown as RemoteNativePlugin, account };
	const environment = new CapacitorEnvironmentAdapter(config).connect();
	const bridge = environment.bridge!;
	expect(typeof bridge.hostedStatus, 'Google account connection is offered without pairing').toBe(
		'function'
	);
	expect(await bridge.hostedStatus!()).toMatchObject({ configured: true, state: 'signed-in' });
	expect(await bridge.listProjects!()).toEqual([
		{ id: '11111111-1111-4111-8111-111111111111', name: 'Owned', kind: 'shared' },
		{ id: '22222222-2222-4222-8222-222222222222', name: 'Invited', kind: 'shared' }
	]);
	expect(f.plugin.request).not.toHaveBeenCalled();
	await bridge.disconnectHosted!();
	expect(await bridge.listProjects!()).toEqual([]);
});

test.each(['account-mismatch', 'session-required'])(
	'an iOS account refusal (%s) returns to sign-in without retaining the previous account',
	async (code) => {
		const f = native();
		const signed = {
			configured: true,
			state: 'signed-in' as const,
			actor: { id: 'google:ada', name: 'Ada', email: 'ada@example.invalid' }
		};
		const account = {
			status: vi.fn(async () => signed),
			connect: vi.fn(async () => signed),
			disconnect: vi.fn(async () => ({ configured: true, state: 'signed-out' as const })),
			request: vi.fn()
		};
		const bridge = new CapacitorEnvironmentAdapter({
			plugin: f.plugin as unknown as RemoteNativePlugin,
			account
		}).connect().bridge!;
		expect(await bridge.hostedStatus!()).toMatchObject({ state: 'signed-in' });
		account.status.mockRejectedValueOnce(Object.assign(new Error('Sign in again.'), { code }));
		await expect(
			bridge.hostedStatus!(),
			'revoked phone identity returns to sign-in'
		).resolves.toEqual({
			configured: true,
			state: 'signed-out'
		});
		expect(await bridge.listProjects!()).toEqual([]);
		expect(account.request).not.toHaveBeenCalled();
	}
);

test('a hosted project refusal is never retried through the paired Mac', async () => {
	const f = native(online);
	const signed = {
		configured: true,
		state: 'signed-in' as const,
		actor: { id: 'google:ada', name: 'Ada', email: 'ada@example.invalid' }
	};
	const account = {
		status: vi.fn(async () => signed),
		connect: vi.fn(async () => signed),
		disconnect: vi.fn(async () => ({ configured: true, state: 'signed-out' as const })),
		request: vi.fn(async () => ({
			status: 403,
			contentType: 'application/json',
			data: btoa(JSON.stringify({ error: 'permission-denied' }))
		}))
	};
	const bridge = new CapacitorEnvironmentAdapter({
		plugin: f.plugin as unknown as RemoteNativePlugin,
		account
	}).connect().bridge!;
	await bridge.hostedStatus!();
	await expect(
		bridge.entity({
			projectId: '11111111-1111-4111-8111-111111111111',
			entityId: 'component.example',
			commit: 'a'.repeat(40)
		})
	).rejects.toMatchObject({ status: 403 });
	expect(account.request).toHaveBeenCalledOnce();
	expect(f.plugin.request).not.toHaveBeenCalled();
});
