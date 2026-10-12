import { afterEach, expect, test, vi } from 'vitest';
import { createRemotePhoneStore } from '../../src/lib/stores/remotePhone.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { RemoteMobileStatus } from '../../src/models/Environment.types';
import { linkNotice } from '../../src/utils/pairingInput';

const grant = { projects: [{ id: 'local-1', name: 'One' }], agents: true };
const at = (state: RemoteMobileStatus['state'], change: Partial<RemoteMobileStatus> = {}) =>
	({
		state,
		origin: 'https://relay.example.invalid',
		host: { id: 'a1'.repeat(20), name: 'Studio Mac' },
		device: { id: 'd'.repeat(40), name: 'Ada iPhone' },
		grant: state === 'online' || state === 'offline' ? grant : null,
		reason: null,
		lastOnlineAt: '2026-10-12T08:00:00.000Z',
		...change
	}) satisfies RemoteMobileStatus;
const link = `harnessremote://pair?origin=${encodeURIComponent('https://relay.example.invalid')}&host=${'a1'.repeat(20)}&pairing=${'b2'.repeat(16)}`;

function phone(first: RemoteMobileStatus, shown = false) {
	let listener: (status: RemoteMobileStatus) => void = () => {};
	const port = {
		status: vi.fn(async () => first),
		pair: vi.fn(async () => at('pending-approval')),
		disconnect: vi.fn(async () => at('unpaired', { host: null, device: null })),
		onStatus: vi.fn((next: typeof listener) => {
			listener = next;
			return vi.fn();
		})
	};
	const workspace = {
		remote: { phone: port },
		projects: shown ? [{ id: 'local-1', name: 'One', kind: 'local' }] : [],
		snapshot: shown ? { project: { id: 'local-1' }, writable: true } : null,
		entity: null,
		offline: null as { cachedAt: string | null } | null,
		capabilities: { comments: true, agents: true, planning: true, approval: true, source: 'local' },
		selection: { id: null },
		target: null,
		error: '',
		projectId: shown ? 'local-1' : null,
		invalidate: vi.fn(),
		loadProjects: vi.fn(async () => {}),
		refresh: vi.fn(async () => {})
	};
	const store = createRemotePhoneStore(workspace as unknown as Workspace);
	return { store, port, workspace, announce: (status: RemoteMobileStatus) => listener(status) };
}
afterEach(() => vi.unstubAllGlobals());

test('a malformed link or code never reaches the plugin', async () => {
	const { store, port } = phone(at('unpaired'));
	await store.start();
	const unsafe = link.replace('https%3A', 'http%3A');
	expect(await store.pair({ link: unsafe, code: 'KQ7M2XWP', deviceName: 'Ada' })).toBe(false);
	expect(store.error).toBe(linkNotice);
	expect(await store.pair({ link, code: 'KQ7', deviceName: 'Ada' })).toBe(false);
	expect(port.pair).not.toHaveBeenCalled();
	expect(await store.pair({ link, code: 'kq7m-2xwp', deviceName: 'Ada' })).toBe(true);
	expect(port.pair).toHaveBeenCalledWith(expect.objectContaining({ code: 'KQ7M2XWP' }));
	expect(store.status?.state).toBe('pending-approval');
});

test('reaching the computer lists its projects and reloads what is shown, once', async () => {
	const { store, workspace, announce } = phone(at('connecting'), true);
	await store.start();
	announce(at('online'));
	expect(workspace.loadProjects).toHaveBeenCalledOnce();
	expect(workspace.refresh).toHaveBeenCalledOnce();
	announce(at('online'));
	expect(workspace.loadProjects).toHaveBeenCalledOnce();
	announce(at('online', { grant: { ...grant, agents: false } }));
	expect(workspace.loadProjects).toHaveBeenCalledTimes(2);
	expect(workspace.capabilities).toMatchObject({ agents: false, planning: false, approval: false });
	expect(workspace.refresh).toHaveBeenCalledTimes(2);
});

test('a lost computer leaves a read-only cached view; nothing is called a success', async () => {
	const { store, workspace, announce } = phone(at('online'), true);
	await store.start();
	announce(at('offline', { reason: 'Suspending' }));
	expect(workspace.offline).toEqual({ cachedAt: '2026-10-12T08:00:00.000Z' });
	expect(workspace.snapshot).toMatchObject({ writable: false });
	expect(workspace.capabilities).toMatchObject({ comments: false, agents: false });
	expect(store.status?.state).toBe('offline');
	announce(at('online'));
	expect(workspace.refresh).toHaveBeenCalledTimes(2);
});

test('revocation and disconnect leave nothing of the computer on the page', async () => {
	vi.stubGlobal('location', { pathname: '/' });
	const revoked = phone(at('online'), true);
	await revoked.store.start();
	revoked.announce(at('revoked'));
	expect(revoked.workspace).toMatchObject({ projects: [], snapshot: null, error: '' });
	const left = phone(at('online'), true);
	await left.store.start();
	await left.store.disconnect();
	expect(left.port.disconnect).toHaveBeenCalledOnce();
	expect(left.workspace.snapshot).toBeNull();
	expect(left.store.status?.state).toBe('unpaired');
});

test('a phone opened while its computer is away reads what it kept, once', async () => {
	vi.stubGlobal('location', { pathname: '/projects/local-1/harness/pages' });
	const { store, workspace, announce } = phone(at('connecting'));
	await store.start();
	expect(workspace.loadProjects).not.toHaveBeenCalled();
	announce(at('offline'));
	expect(workspace.loadProjects).toHaveBeenCalledOnce();
	expect(workspace.refresh).toHaveBeenCalledOnce();
	announce(at('connecting'));
	announce(at('offline'));
	expect(workspace.loadProjects).toHaveBeenCalledOnce();
	announce(at('online'));
	expect(workspace.loadProjects).toHaveBeenCalledTimes(2);
});

test('an offered pairing link is kept only when it is one, and never while a computer is paired', async () => {
	let offer: (link: string) => void = () => {};
	const { store, workspace } = phone(at('unpaired'));
	const links = {
		onPairingLink: (next: typeof offer) => {
			offer = next;
			return () => {};
		}
	};
	Object.assign(workspace.remote, { links });
	await store.start();
	offer(link.replace('https%3A', 'http%3A'));
	offer(`${link}&code=KQ7M2XWP`);
	expect(store.offered).toBe('');
	offer(link);
	expect(store.offered).toBe(link);
	expect(await store.pair({ link, code: 'KQ7M2XWP', deviceName: 'Ada' })).toBe(true);
	expect(store.offered).toBe('');
	offer(link);
	expect(store.offered).toBe('');
});

test('only a status that states a test fixture build lets a relay on this machine through', async () => {
	const remote = encodeURIComponent('https://relay.example.invalid');
	const local = link.replace(remote, encodeURIComponent('http://127.0.0.1:8791'));
	const plain = phone(at('unpaired'));
	await plain.store.start();
	expect(await plain.store.pair({ link: local, code: 'KQ7M2XWP', deviceName: 'Ada' })).toBe(false);
	expect(plain.port.pair).not.toHaveBeenCalled();
	const debug = phone({ ...at('unpaired'), fixture: true } as never);
	await debug.store.start();
	expect(debug.store.fixture).toBe(true);
	expect(await debug.store.pair({ link: local, code: 'KQ7M2XWP', deviceName: 'Ada' })).toBe(true);
	expect(debug.port.pair).toHaveBeenCalledWith(
		expect.objectContaining({ origin: 'http://127.0.0.1:8791' })
	);
});
