import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createRemotePhoneStore } from '../../src/lib/stores/networking-security/remotePhone.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type { RemoteMobileStatus } from '../../src/models/development-tooling/Environment.types';
import {
	nameNotice,
	scanNotices
} from '../../src/utils/networking-security/scan-notice/scanNotice';

const grant = { projects: [{ id: 'local-1', name: 'One' }], agents: true };
const unpaired = { host: null, device: null } satisfies Partial<RemoteMobileStatus>;
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

/** A workspace whose phone port is a recording fake that answers with the given first status. */
function phone(first: RemoteMobileStatus) {
	const release = vi.fn();
	const port = {
		status: vi.fn(async () => first),
		scan: vi.fn(async () => at('pending-approval')),
		disconnect: vi.fn(async () => at('unpaired', unpaired)),
		onStatus: vi.fn(() => release)
	};
	const workspace = {
		remote: { phone: port },
		projects: [],
		snapshot: null,
		capabilities: { comments: true, agents: true, planning: true, approval: true },
		projectId: null,
		invalidate: vi.fn(),
		selection: { id: null },
		loadProjects: vi.fn(async () => {}),
		refresh: vi.fn(async () => {})
	};
	const store = createRemotePhoneStore(workspace as unknown as Workspace);
	return { store, port, workspace, release };
}

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'desktop.store.remote-phone',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('A fresh store is bound to the workspace phone port with empty state and asks nothing', () => {
	const { store, port, workspace } = phone(at('unpaired', unpaired));
	const second = createRemotePhoneStore(workspace as unknown as Workspace);
	const initial = {
		status: store.status,
		error: store.error,
		busy: store.busy,
		scanFailure: store.scanFailure,
		fixture: store.fixture
	};
	expect(initial).toEqual({
		status: null,
		error: '',
		busy: false,
		scanFailure: null,
		fixture: false
	});
	expect(store.port).toBe(port);
	expect(second).not.toBe(store);
	expect(port.status).not.toHaveBeenCalled();
	expect(port.onStatus).not.toHaveBeenCalled();
	recordCases('createRemotePhoneStore', 'factory-binds-the-workspace-port', [
		{
			name: 'two factory calls return distinct stores',
			input: {},
			output: { distinct: second !== store }
		},
		{
			name: 'store reads the workspace phone port',
			input: {},
			output: { bound: store.port === port }
		},
		{ name: 'initial status, error, busy, scan failure and fixture', input: {}, output: initial },
		{ name: 'port status calls before start', input: {}, output: port.status.mock.calls.length }
	]);
});

test('start asks the port once, listens for announcements and keeps the answer', async () => {
	const { store, port, release } = phone(at('unpaired', unpaired));
	await store.start();
	await store.start();
	const started = { state: store.status?.state, busy: store.busy, error: store.error };
	expect(started).toEqual({ state: 'unpaired', busy: false, error: '' });
	expect(port.status).toHaveBeenCalledOnce();
	expect(port.onStatus).toHaveBeenCalledOnce();
	store.dispose();
	expect(release).toHaveBeenCalledOnce();
	recordCases('start', 'start-asks-once-and-listens', [
		{ name: 'answered state after two starts', input: {}, output: started },
		{
			name: 'port status calls after two starts',
			input: {},
			output: port.status.mock.calls.length
		},
		{
			name: 'announcement listeners registered',
			input: {},
			output: port.onStatus.mock.calls.length
		},
		{ name: 'listener releases after dispose', input: {}, output: release.mock.calls.length }
	]);
});

test('A blank name is refused, a refused scan is said in words, and a busy scan is not repeated', async () => {
	const { store, port } = phone(at('unpaired', unpaired));
	await store.start();
	const blank = { returned: await store.scan('   '), error: store.error };
	expect(blank).toEqual({ returned: false, error: nameNotice });
	expect(port.scan).not.toHaveBeenCalled();
	port.scan.mockRejectedValueOnce(
		Object.assign(new Error('native words'), { code: 'offer-expired' })
	);
	const refused = {
		returned: await store.scan('Ada'),
		scanFailure: store.scanFailure,
		error: store.error,
		busy: store.busy,
		state: store.status?.state
	};
	expect(refused).toEqual({
		returned: false,
		scanFailure: 'offer-expired',
		error: scanNotices['offer-expired'],
		busy: false,
		state: 'unpaired'
	});
	let answer: (status: RemoteMobileStatus) => void = () => {};
	port.scan.mockImplementationOnce(
		() => new Promise<RemoteMobileStatus>((resolve) => (answer = resolve))
	);
	const pending = store.scan(' Ada iPhone ');
	const during = { busy: store.busy, secondScan: await store.scan('Grace') };
	expect(during).toEqual({ busy: true, secondScan: false });
	answer(at('pending-approval'));
	const accepted = { returned: await pending, scanFailure: store.scanFailure, error: store.error };
	expect(accepted).toEqual({ returned: true, scanFailure: null, error: '' });
	expect(port.scan).toHaveBeenCalledTimes(2);
	expect(port.scan).toHaveBeenLastCalledWith({ deviceName: 'Ada iPhone' });
	recordCases('scan', 'scan-busy-then-refused-with-the-notice', [
		{ name: 'blank name is refused before the port', input: { name: '   ' }, output: blank },
		{ name: 'expired code is refused with its notice', input: { name: 'Ada' }, output: refused },
		{ name: 'scan while busy is not started again', input: { name: 'Grace' }, output: during },
		{
			name: 'trimmed name is accepted and clears the failure',
			input: { name: ' Ada iPhone ' },
			output: accepted
		}
	]);
});

test('Without a workspace phone port nothing is asked and no error is invented', async () => {
	const store = createRemotePhoneStore({ remote: {} } as unknown as Workspace);
	await store.start();
	const unavailable = {
		started: store.status,
		scanned: await store.scan('Ada'),
		errorAfterScan: store.error,
		disconnected: await store.disconnect(),
		busy: store.busy
	};
	expect(unavailable).toEqual({
		started: null,
		scanned: false,
		errorAfterScan: '',
		disconnected: false,
		busy: false
	});
	const blank = await store.scan('');
	expect([blank, store.error]).toEqual([false, nameNotice]);
	recordCases('start', 'unavailable-port-is-inert', [
		{ name: 'start and status without a port', input: {}, output: unavailable.started },
		{ name: 'scan with a name and no port', input: { name: 'Ada' }, output: unavailable.scanned },
		{ name: 'disconnect without a port', input: {}, output: unavailable.disconnected },
		{ name: 'blank name still reports the name notice', input: { name: '' }, output: store.error }
	]);
});

test('disconnect asks the port to forget the computer and shows what it answers', async () => {
	const { store, port } = phone(at('online'));
	await store.start();
	const online = store.status?.state;
	const returned = await store.disconnect();
	const after = { state: store.status?.state, busy: store.busy, error: store.error };
	expect(online).toBe('online');
	expect(returned).toBe(true);
	expect(after).toEqual({ state: 'unpaired', busy: false, error: '' });
	expect(port.disconnect).toHaveBeenCalledOnce();
	recordCases('disconnect', 'disconnect-forgets-through-the-port', [
		{ name: 'state before disconnect', input: {}, output: online },
		{ name: 'disconnect returns true', input: {}, output: returned },
		{ name: 'state and busy after disconnect', input: {}, output: after },
		{ name: 'port disconnect calls', input: {}, output: port.disconnect.mock.calls.length }
	]);
});
