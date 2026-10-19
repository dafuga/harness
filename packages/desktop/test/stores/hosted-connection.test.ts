import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createHostedConnectionStore } from '../../src/lib/stores/hostedConnection.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { NativeHostedStatus } from '../../src/models/ProjectContext.types';

const signedOut: NativeHostedStatus = { configured: true, state: 'signed-out' };
const pendingOf = (verificationUrl: string, interval = 5, minutes = 5): NativeHostedStatus => ({
	configured: true,
	state: 'pending',
	handoff: {
		userCode: 'ABCD-EFGH',
		verificationUrl,
		expiresAt: new Date(Date.now() + minutes * 60000).toISOString(),
		interval
	}
});
const address = 'https://hub.example.invalid/native/handoff-1';
const signedIn: NativeHostedStatus = {
	configured: true,
	state: 'signed-in',
	actor: { id: 'google:1', name: 'Ada', email: 'ada@example.invalid' }
};
function workspaceOf(bridge: object) {
	const workspace = {
		bridge,
		projects: [
			{ id: 'local-1', name: 'Local', kind: 'local' },
			{ id: 'shared-1', name: 'Shared', kind: 'shared' }
		],
		target: null,
		projectId: null,
		capabilities: { source: 'local' },
		invalidate: vi.fn(),
		loadProjects: vi.fn(async () => {})
	};
	return workspace as unknown as Workspace & { loadProjects: ReturnType<typeof vi.fn> };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('pending approval shows a code and an address and is asked about no sooner than the interval', async () => {
	const hostedStatus = vi
		.fn(async () => signedIn)
		.mockResolvedValueOnce(signedOut)
		.mockResolvedValueOnce(pendingOf(address));
	const connectHosted = vi.fn(async () => pendingOf(address));
	const workspace = workspaceOf({ hostedStatus, connectHosted, disconnectHosted: vi.fn() });
	const connection = createHostedConnectionStore(workspace);
	await connection.load();
	expect(connection.status?.state).toBe('signed-out');
	await connection.connect();
	expect(connection.status?.handoff?.userCode).toBe('ABCD-EFGH');
	expect(connection.address).toBe(address);
	expect(JSON.stringify(connection.status)).not.toMatch(/verifier|nonce|secret|token/i);
	await vi.advanceTimersByTimeAsync(4999);
	expect(hostedStatus).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(1);
	expect(hostedStatus).toHaveBeenCalledTimes(2);
	await vi.advanceTimersByTimeAsync(5000);
	expect(hostedStatus).toHaveBeenCalledTimes(3);
	expect(connection.status?.state).toBe('signed-in');
	expect(workspace.loadProjects).toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(60000);
	expect(hostedStatus.mock.calls.length).toBeGreaterThan(3);
	connection.dispose();
});

test('an address that is not a plain approval address is never offered', async () => {
	const bad = 'https://hub.example.invalid/native/handoff-1?code=ABCD-EFGH';
	const connectHosted = vi.fn(async () => pendingOf(bad));
	const bridge = {
		hostedStatus: vi.fn(async () => signedOut),
		connectHosted,
		disconnectHosted: vi.fn()
	};
	const connection = createHostedConnectionStore(workspaceOf(bridge));
	await connection.connect();
	expect(connection.status?.state).toBe('pending');
	expect(connection.address).toBeNull();
	connection.dispose();
});

test('an expired code is not asked about again, and disposing stops the asking', async () => {
	const hostedStatus = vi.fn(async () => pendingOf(address, 5, -1));
	const bridge = {
		hostedStatus,
		connectHosted: vi.fn(async () => pendingOf(address)),
		disconnectHosted: vi.fn()
	};
	const connection = createHostedConnectionStore(workspaceOf(bridge));
	await connection.load();
	expect(connection.expired).toBe(true);
	await vi.advanceTimersByTimeAsync(60000);
	expect(hostedStatus).toHaveBeenCalledTimes(1);
	await connection.connect();
	connection.dispose();
	await vi.advanceTimersByTimeAsync(60000);
	expect(hostedStatus).toHaveBeenCalledTimes(1);
});

test('disconnecting removes what was shared from the page before the bridge is asked', async () => {
	const workspace = workspaceOf({});
	const seen: string[][] = [];
	const disconnectHosted = vi.fn(async () => {
		seen.push(workspace.projects.map((item) => item.id));
		return signedOut;
	});
	workspace.bridge = { hostedStatus: vi.fn(), connectHosted: vi.fn(), disconnectHosted } as never;
	const connection = createHostedConnectionStore(workspace);
	await connection.disconnect();
	expect(seen).toEqual([['local-1']]);
	expect(connection.status?.state).toBe('signed-out');
});

test('a bridge without the three operations offers no connection', async () => {
	const hostedStatus = vi.fn(async () => signedOut);
	const connection = createHostedConnectionStore(workspaceOf({ hostedStatus }));
	expect(connection.available).toBe(false);
	await connection.load();
	expect(hostedStatus).not.toHaveBeenCalled();
	expect(connection.status).toBeNull();
});

test('a signed-in device keeps owned and joined projects current and clears another account first', async () => {
	let identity = signedIn;
	const hostedStatus = vi.fn(async () => identity);
	const workspace = workspaceOf({
		hostedStatus,
		connectHosted: vi.fn(),
		disconnectHosted: vi.fn()
	});
	const connection = createHostedConnectionStore(workspace);
	await connection.load();
	workspace.loadProjects.mockClear();
	await vi.advanceTimersByTimeAsync(30000);
	expect(workspace.loadProjects, 'signed-in projects refresh automatically').toHaveBeenCalled();
	const names: string[][] = [];
	workspace.loadProjects.mockImplementation(async () => {
		names.push(workspace.projects.map((p) => p.id));
	});
	identity = { ...signedIn, actor: { id: 'google:2', name: 'Ben', email: 'ben@example.invalid' } };
	await connection.load();
	expect(names.at(-1), 'old account projects leave before loading the new account').toEqual([
		'local-1'
	]);
	connection.dispose();
	const calls = hostedStatus.mock.calls.length;
	await vi.advanceTimersByTimeAsync(60000);
	expect(hostedStatus).toHaveBeenCalledTimes(calls);
});

test('an account status that arrives after disposal cannot restart polling or repopulate projects', async () => {
	let answer!: (value: NativeHostedStatus) => void;
	const response = new Promise<NativeHostedStatus>((resolve) => {
		answer = resolve;
	});
	const workspace = workspaceOf({
		hostedStatus: () => response,
		connectHosted: vi.fn(),
		disconnectHosted: vi.fn()
	});
	const connection = createHostedConnectionStore(workspace);
	const loading = connection.load();
	connection.dispose();
	answer(signedIn);
	await loading;
	expect(workspace.loadProjects).not.toHaveBeenCalled();
	expect(connection.status).toBeNull();
});
