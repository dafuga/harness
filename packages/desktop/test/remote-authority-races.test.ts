import { afterEach, expect, test, vi } from 'vitest';
import { createRemotePhoneStore } from '../src/lib/stores/remotePhone.svelte';
import { createRemoteHostStore } from '../src/lib/stores/remoteHost.svelte';
import { createWorkspaceStore } from '../src/lib/stores/workspace.svelte';
import type { DesktopBridge } from '../src/models/DesktopBridge.types';
import type { DesktopProject } from '../src/models/ProjectContext.types';
import type { RemoteHostStatus, RemoteMobileStatus } from '../src/models/Environment.types';

const project = { id: 'local-' + '1'.repeat(64), name: 'Private project', kind: 'local' } as const;
const online: RemoteMobileStatus = {
	state: 'online',
	origin: 'https://relay.example.invalid',
	host: { id: 'a'.repeat(40), name: 'Fixture Mac' },
	device: { id: 'b'.repeat(40), name: 'Fixture phone' },
	grant: { projects: [project], agents: true },
	reason: null,
	lastOnlineAt: null
};
const revoked: RemoteMobileStatus = { ...online, state: 'revoked', grant: null };
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}
function fixture(initial: Promise<RemoteMobileStatus> = Promise.resolve(online)) {
	let announce: (status: RemoteMobileStatus) => void = () => {};
	const port = {
		status: () => initial,
		scan: async () => online,
		disconnect: async () => revoked,
		onStatus: (listener: typeof announce) => {
			announce = listener;
			return () => {};
		}
	};
	const workspace = createWorkspaceStore();
	workspace.connect({ listProjects: async () => [project] } as unknown as DesktopBridge, {
		phone: port,
		local: false
	});
	workspace.refresh = vi.fn(async () => {});
	const phone = createRemotePhoneStore(workspace);
	return { phone, workspace, announce: (status: RemoteMobileStatus) => announce(status) };
}
function show(workspace: ReturnType<typeof createWorkspaceStore>) {
	workspace.snapshot = {
		project: { ...project, root: '' },
		revision: { branch: 'main', commit: 'c'.repeat(40), tip: 'c'.repeat(40), atTip: true },
		branches: [],
		commits: [],
		entities: [],
		writable: true
	};
	workspace.capabilities = {
		comments: true,
		agents: true,
		planning: true,
		approval: true,
		source: 'local'
	};
}
afterEach(() => vi.unstubAllGlobals());

test('removing a granted project clears its view before another response can arrive', async () => {
	const { phone, workspace, announce } = fixture();
	await phone.start();
	show(workspace);
	announce({ ...online, grant: { projects: [], agents: false } });
	expect(workspace.snapshot).toBeNull();
	expect(workspace.capabilities.agents).toBe(false);
});

test('an execution downgrade disables writes immediately and rechecks the retained project', async () => {
	const { phone, workspace, announce } = fixture();
	await phone.start();
	show(workspace);
	const refresh = vi.mocked(workspace.refresh);
	refresh.mockClear();
	announce({ ...online, grant: { projects: [project], agents: false } });
	expect(workspace.capabilities).toMatchObject({ agents: false, planning: false, approval: false });
	expect(refresh).toHaveBeenCalledOnce();
});

test('a host identity change cannot retain the old host view under an identical grant', async () => {
	const { phone, workspace, announce } = fixture();
	await phone.start();
	show(workspace);
	announce({ ...online, host: { id: 'd'.repeat(40), name: 'Other fixture Mac' } });
	expect(workspace.snapshot).toBeNull();
});

test('a revoked event supersedes an older status response', async () => {
	const pending = deferred<RemoteMobileStatus>();
	const { phone, workspace, announce } = fixture(pending.promise);
	const starting = phone.start();
	announce(revoked);
	pending.resolve(online);
	await starting;
	expect(phone.status?.state).toBe('revoked');
	expect(workspace.projects).toEqual([]);
});

test('late project discovery cannot reveal private names after revocation on an empty root view', async () => {
	vi.stubGlobal('location', { pathname: '/' });
	const pending = deferred<DesktopProject[]>();
	const { phone, workspace, announce } = fixture();
	workspace.bridge = { listProjects: () => pending.promise } as unknown as DesktopBridge;
	await phone.start();
	const loading = workspace.loadProjects();
	announce(revoked);
	pending.resolve([project]);
	await loading;
	expect(workspace.projects).toEqual([]);
});

test('a desktop disabled event supersedes an older online status response', async () => {
	const pending = deferred<RemoteHostStatus>();
	const off: RemoteHostStatus = {
		supported: true,
		enabled: false,
		state: 'disabled',
		reason: null,
		host: null,
		origin: null,
		pairing: null,
		requests: [],
		devices: [],
		projects: []
	};
	let announce: (status: RemoteHostStatus) => void = () => {};
	const workspace = createWorkspaceStore();
	workspace.remote = {
		host: {
			status: () => pending.promise,
			onStatus: (listener: (status: RemoteHostStatus) => void) => {
				announce = listener;
				return () => {};
			}
		} as never
	};
	const host = createRemoteHostStore(workspace);
	const starting = host.start();
	announce(off);
	pending.resolve({ ...off, state: 'online', enabled: true });
	await starting;
	expect(host.status?.state).toBe('disabled');
});
