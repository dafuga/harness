import { expect, test, vi } from 'vitest';
import { CapacitorEnvironmentAdapter } from '../../src/adapters/CapacitorEnvironmentAdapter';
import type {
	RemoteNativePlugin,
	RemoteNativeStatus
} from '../../src/models/development-tooling/Environment.types';
import type { Listener } from './capacitor-environment.test.types';

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

/** The native plugin with only the calls the overview reads: status, requests and status listeners. */
function native(first: RemoteNativeStatus = unpaired) {
	const listeners = new Map<string, Listener>();
	const plugin = {
		status: vi.fn(async () => first),
		request: vi.fn(),
		addListener: vi.fn(async (name: string, listener: Listener) => {
			listeners.set(name, listener);
			return { remove: async () => {} };
		})
	};
	const emit = (name: string, value: unknown) => listeners.get(name)?.(value as never);
	const plugged = { plugin: plugin as unknown as RemoteNativePlugin };
	return { plugin, emit, environment: new CapacitorEnvironmentAdapter(plugged).connect() };
}

const owner = signedInAs('daniel', 'Daniel');

const ready = { status: 'ready', projects: [], machines: [], liveSessions: 0 };
const denial = { error: 'permission-denied' };

/** The account status of another signed-in person, as the native plugin reports it after a switch. */
function signedInAs(id: string, name: string) {
	return {
		configured: true,
		state: 'signed-in',
		actor: { id: `google:${id}`, name, email: `${id}@example.invalid` }
	} as never;
}

function replyOf(status: number, body: unknown) {
	return { status, contentType: 'application/json', data: btoa(JSON.stringify(body)) };
}

/** This phone's own account, with one answer per request and a status that names its person. */
function accountOf(request = vi.fn(async () => replyOf(200, ready)), state: object = owner) {
	return {
		status: vi.fn(async () => state as never),
		connect: vi.fn(async () => state as never),
		disconnect: vi.fn(async () => ({ configured: true, state: 'signed-out' as const })),
		request
	};
}

/** A phone in the given pairing state with its account known, read through the bridge the page sees. */
async function phoneWith(state: RemoteNativeStatus, account = accountOf()) {
	const f = native(state);
	const environment = new CapacitorEnvironmentAdapter({
		plugin: f.plugin as unknown as RemoteNativePlugin,
		account
	}).connect();
	environment.phone!.onStatus(() => undefined);
	await environment.phone!.status();
	await environment.bridge!.hostedStatus!();
	return {
		...f,
		account,
		bridge: environment.bridge!,
		outgoing: environment.trackerHome?.outgoing
	};
}

test('a paired phone with an owner account reads the overview with one fixed GET and nothing else', async () => {
	const { account, bridge, plugin } = await phoneWith(online);
	expect(typeof bridge.projectOverview).toBe('function');
	expect(await bridge.projectOverview!()).toEqual(ready);
	expect(account.request).toHaveBeenCalledExactlyOnceWith({
		method: 'GET',
		path: '/api/tracker-overview'
	});
	expect(plugin.request, 'the computer is never asked for the overview').not.toHaveBeenCalled();
});

test('the phone sends owner draft operations through its own Hub account', async () => {
	const draft = { id: '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c', revision: 2, status: 'draft' };
	const account = accountOf(
		vi
			.fn()
			.mockResolvedValueOnce(replyOf(200, [draft]))
			.mockResolvedValueOnce(replyOf(200, { ...draft, status: 'sent' }))
			.mockResolvedValueOnce(replyOf(403, denial))
	);
	const f = await phoneWith(online, account);
	const cache = vi.fn();
	f.bridge.onCacheStatus!(cache);
	const body = { id: draft.id, revision: draft.revision, action: 'send' as const };
	await expect(f.outgoing!.read()).resolves.toEqual([draft]);
	await expect(f.outgoing!.write(body)).resolves.toEqual({ ...draft, status: 'sent' });
	await expect(f.outgoing!.read()).rejects.toMatchObject({ status: 403 });
	expect(account.request.mock.calls).toEqual([
		[{ method: 'GET', path: '/api/outgoing-drafts' }],
		[{ method: 'POST', path: '/api/outgoing-drafts', body }],
		[{ method: 'GET', path: '/api/outgoing-drafts' }]
	]);
	expect(cache).not.toHaveBeenCalled();
	expect(f.plugin.request).not.toHaveBeenCalled();
});

test('the overview waits for the account without waiting for computer status', async () => {
	const f = native(online);
	const account = accountOf();
	const environment = new CapacitorEnvironmentAdapter({
		plugin: f.plugin as unknown as RemoteNativePlugin,
		account
	}).connect();
	const bridge = environment.bridge!;
	await bridge.hostedStatus!();
	expect(f.plugin.status).not.toHaveBeenCalled();
	expect(typeof bridge.projectOverview).toBe('function');
	expect(account.request).not.toHaveBeenCalled();
});

test('an unpaired owner reads the overview from the Hub', async () => {
	const { account, bridge, plugin } = await phoneWith(unpaired);
	await expect(bridge.projectOverview!()).resolves.toEqual(ready);
	expect(account.request).toHaveBeenCalledOnce();
	expect(plugin.request).not.toHaveBeenCalled();
});

test('a signed-out account offers no overview while the computer is online', async () => {
	const signedOut = { configured: true, state: 'signed-out' as const };
	const { account, bridge } = await phoneWith(online, accountOf(undefined, signedOut));
	expect(bridge.projectOverview).toBeUndefined();
	expect(account.request).not.toHaveBeenCalled();
});

test('losing the pairing keeps the pending Hub overview read', async () => {
	let answer!: (value: unknown) => void;
	const request = vi.fn(() => new Promise((resolve) => (answer = resolve)));
	const f = await phoneWith(online, accountOf(request as never));
	const pending = f.bridge.projectOverview!();
	f.emit('status', { ...unpaired, state: 'revoked' });
	answer(replyOf(200, ready));
	await expect(pending).resolves.toEqual(ready);
	expect(f.bridge.projectOverview).toBeTypeOf('function');
});

test('an authorized 503 reads as unavailable and keeps the offer', async () => {
	const unavailable = await phoneWith(
		online,
		accountOf(vi.fn(async () => replyOf(503, { status: 'unavailable' })))
	);
	await expect(unavailable.bridge.projectOverview!()).resolves.toEqual({ status: 'unavailable' });
	expect(typeof unavailable.bridge.projectOverview).toBe('function');
});

test.each([401, 403, 404])(
	'the Hub denying this account (%i) clears the rows and withdraws the offer',
	async (status) => {
		const denied = await phoneWith(online, accountOf(vi.fn(async () => replyOf(status, denial))));
		expect(typeof denied.bridge.projectOverview).toBe('function');
		await expect(denied.bridge.projectOverview!()).resolves.toEqual({ status: 'unavailable' });
		expect(denied.bridge.projectOverview).toBeUndefined();
	}
);

test('a 403 of the overview is not a project denial, so no listener is told of one', async () => {
	const denied = await phoneWith(online, accountOf(vi.fn(async () => replyOf(403, denial))));
	const listener = vi.fn();
	denied.bridge.onCacheStatus!(listener);
	await denied.bridge.projectOverview!();
	expect(listener).not.toHaveBeenCalled();
});

test('a switch to another account asks again, after a denial of the first', async () => {
	const f = await phoneWith(online, accountOf(vi.fn(async () => replyOf(403, denial))));
	await f.bridge.projectOverview!();
	expect(f.bridge.projectOverview).toBeUndefined();
	f.account.status.mockResolvedValueOnce(signedInAs('owner', 'Owner'));
	await f.bridge.hostedStatus!();
	expect(typeof f.bridge.projectOverview).toBe('function');
});

test('changing computers keeps the pending Hub overview read', async () => {
	let answer!: (value: unknown) => void;
	const request = vi.fn(() => new Promise((resolve) => (answer = resolve)));
	const f = await phoneWith(online, accountOf(request as never));
	const pending = f.bridge.projectOverview!();
	f.emit('status', { ...online, host: { id: 'b2'.repeat(20), name: 'Other Mac' } });
	answer(replyOf(200, ready));
	await expect(pending).resolves.toEqual(ready);
});

test('an answer asked before an account switch is discarded', async () => {
	let answer!: (value: unknown) => void;
	const request = vi.fn(() => new Promise((resolve) => (answer = resolve)));
	const account = accountOf(request as never);
	const f = await phoneWith(online, account);
	const pending = f.bridge.projectOverview!();
	account.status.mockResolvedValueOnce(signedInAs('second', 'Second'));
	await f.bridge.hostedStatus!();
	answer(replyOf(200, ready));
	await expect(pending).resolves.toEqual({ status: 'unavailable' });
});

test('an answer this app cannot read as an overview is unavailable, never shown in part', async () => {
	const partial = await phoneWith(
		online,
		accountOf(vi.fn(async () => replyOf(200, { status: 'ready', projects: [] })))
	);
	await expect(partial.bridge.projectOverview!()).resolves.toEqual({ status: 'unavailable' });
});

test('an account switch clears the overview at once and no later answer of the old one is used', async () => {
	const f = await phoneWith(online);
	const listener = vi.fn();
	f.bridge.onCacheStatus!(listener);
	f.account.status.mockResolvedValueOnce(signedInAs('second', 'Second'));
	await f.bridge.hostedStatus!();
	expect(listener).toHaveBeenCalledWith({ projectId: expect.any(String), status: 'denied' });
	expect(f.bridge.projectOverview!).toBeDefined();
	expect(await f.bridge.projectOverview!()).toEqual(ready);
});

test('signing out removes the overview from the phone', async () => {
	const { bridge } = await phoneWith(online);
	expect(typeof bridge.projectOverview).toBe('function');
	await bridge.disconnectHosted!();
	expect(bridge.projectOverview).toBeUndefined();
});
