import { afterEach, expect, test, vi } from 'vitest';
import { createRemotePhoneStore } from '../../src/lib/stores/remotePhone.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { RemoteMobileStatus } from '../../src/models/Environment.types';
import { nameNotice, scanFailures, scanNotices } from '../../src/utils/scan-notice/scanNotice';

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

function phone(first: RemoteMobileStatus, shown = false) {
	let listener: (status: RemoteMobileStatus) => void = () => {};
	const port = {
		status: vi.fn(async () => first),
		scan: vi.fn(async () => at('pending-approval')),
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

test('scanning asks the plugin with a name only, and what the scanner refuses is said in words', async () => {
	const { store, port } = phone(at('unpaired', { host: null, device: null }));
	await store.start();
	expect(await store.scan('   ')).toBe(false);
	expect(store.error).toBe(nameNotice);
	expect(port.scan).not.toHaveBeenCalled();
	for (const code of scanFailures) {
		port.scan.mockRejectedValueOnce(Object.assign(new Error('native words'), { code }));
		expect(await store.scan('Ada')).toBe(false);
		expect([store.scanFailure, store.error]).toEqual([code, scanNotices[code]]);
		expect(store.status?.state).toBe('unpaired');
	}
	expect(await store.scan(' Ada iPhone ')).toBe(true);
	expect(port.scan).toHaveBeenLastCalledWith({ deviceName: 'Ada iPhone' });
	expect([store.scanFailure, store.error]).toEqual([null, '']);
	expect(store.status?.state).toBe('pending-approval');
});

test('a failure that is no scan failure is said as it is, and the phone store takes no link or code', async () => {
	const { store, port } = phone(at('unpaired', { host: null, device: null }));
	await store.start();
	port.scan.mockRejectedValueOnce(new Error('The bridge is gone.'));
	expect(await store.scan('Ada')).toBe(false);
	expect([store.scanFailure, store.error]).toEqual([null, 'Error: The bridge is gone.']);
	expect('pair' in store).toBe(false);
	expect('offered' in store).toBe(false);
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

test('a pairing link the phone is opened with is nothing to this page: it listens for none', async () => {
	const { store, workspace } = phone(at('unpaired', { host: null, device: null }));
	const onPairingLink = vi.fn(() => () => {});
	Object.assign(workspace.remote, { links: { onPairingLink } });
	await store.start();
	expect(onPairingLink).not.toHaveBeenCalled();
	expect(store.status?.state).toBe('unpaired');
});

test('only a status that states a test fixture build is shown as one', async () => {
	const plain = phone(at('unpaired'));
	await plain.store.start();
	expect(plain.store.fixture).toBe(false);
	const debug = phone({ ...at('unpaired'), fixture: true } as never);
	await debug.store.start();
	expect(debug.store.fixture).toBe(true);
});
