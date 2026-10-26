import { afterEach, expect, test, vi } from 'vitest';
import { createProjectWorkStore } from '../../../src/lib/stores/agents-providers/projectWork.svelte';
import type { Snapshot, State, Workspace } from './project-work.test.types';
const create = createProjectWorkStore as unknown as (workspace: Workspace) => State;
const empty: Snapshot = { queueCommit: null, features: [] };
const loaded: Snapshot = {
	queueCommit: 'a'.repeat(40),
	features: [
		{ id: 'checkout', goal: 'Review checkout', tldr: 'Build checkout', plan: null, tasks: [] }
	]
};
const setup = () => {
	const read = vi
		.fn<(query: { projectId: string }) => Promise<Snapshot>>()
		.mockResolvedValue(empty);
	const workspace: Workspace = { projectId: 'project-a', bridge: { projectWork: read } };
	return { read, workspace, store: create(workspace) };
};
function deferred() {
	let resolve!: (snapshot: Snapshot) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<Snapshot>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

test('initial value is readable', () => {
	const { store, read } = setup();
	expect(store.snapshot).toBeNull();
	expect(store.loading).toBe(false);
	expect(store.error).toBeNull();
	expect(read).not.toHaveBeenCalled();
});

test('setting value exposes the new value', async () => {
	const { store, read } = setup();
	await store.refresh();
	expect(read).toHaveBeenLastCalledWith({ projectId: 'project-a' });
	expect(store.snapshot).toEqual(empty);
	read.mockResolvedValueOnce(loaded);
	await store.refresh();
	expect(store.snapshot).toEqual(loaded);
	expect(store.loading).toBe(false);
	expect(store.error).toBeNull();
});

test.each(['project', 'bridge', 'method'])(
	'missing %s reports unavailable without fabricated work',
	async (missing) => {
		const { store, workspace, read } = setup();
		if (missing === 'project') workspace.projectId = null;
		if (missing === 'bridge') workspace.bridge = null;
		if (missing === 'method') workspace.bridge = {};
		await store.refresh();
		expect(store.snapshot).toBeNull();
		expect(store.error).toMatch(/unavailable|not available|not connected/i);
		expect(store.loading).toBe(false);
		expect(read).not.toHaveBeenCalled();
	}
);

test('read failures stay visible and retain only same-project prior data', async () => {
	const { store, workspace, read } = setup();
	read.mockResolvedValueOnce(loaded);
	await store.refresh();
	read.mockRejectedValue(new Error('Synthetic work read failed'));
	await store.refresh();
	expect(store.error).toContain('Synthetic work read failed');
	expect(store.snapshot).toEqual(loaded);
	workspace.projectId = 'project-b';
	await store.refresh();
	expect(store.snapshot).toBeNull();
	expect(store.error).toContain('Synthetic work read failed');
	expect(store.loading).toBe(false);
});

test('a previous project reply never becomes visible', async () => {
	const { store, workspace, read } = setup();
	const old = deferred();
	read.mockReturnValueOnce(old.promise);
	const pending = store.refresh();
	expect(store.loading).toBe(true);
	workspace.projectId = 'project-b';
	await store.refresh();
	old.resolve(loaded);
	await pending;
	expect(read).toHaveBeenLastCalledWith({ projectId: 'project-b' });
	expect(store.snapshot).toEqual(empty);
	expect(store.error).toBeNull();
	expect(store.loading).toBe(false);
});

test('selection changes hide old data before another refresh starts', async () => {
	const { store, workspace, read } = setup();
	read.mockResolvedValueOnce(loaded);
	await store.refresh();
	workspace.projectId = 'project-b';
	expect(store.snapshot).toBeNull();
	const old = deferred();
	read.mockReturnValueOnce(old.promise);
	const pending = store.refresh();
	workspace.projectId = 'project-c';
	old.resolve(loaded);
	await pending;
	expect(store.snapshot).toBeNull();
});

test('out-of-order same-project replies cannot overwrite a newer refresh', async () => {
	const { store, read } = setup();
	const old = deferred();
	read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(loaded);
	const pending = store.refresh();
	await store.refresh();
	old.resolve(empty);
	await pending;
	expect(store.snapshot).toEqual(loaded);
	expect(store.error).toBeNull();
	expect(store.loading).toBe(false);
});

test('an obsolete failed read cannot replace a newer successful state', async () => {
	const { store, read } = setup();
	const old = deferred();
	read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(loaded);
	const pending = store.refresh();
	await store.refresh();
	old.reject(new Error('Obsolete failure'));
	await pending;
	expect(store.snapshot).toEqual(loaded);
	expect(store.error).toBeNull();
});

test('listen cleanup stops visible-page polling', async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		'document',
		Object.assign(new EventTarget(), { visibilityState: 'visible', hidden: false })
	);
	const { store, read } = setup();
	const stop = store.listen();
	try {
		await vi.runOnlyPendingTimersAsync();
		expect(read).toHaveBeenCalled();
		expect(vi.getTimerCount()).toBeGreaterThan(0);
	} finally {
		stop();
	}
	const count = read.mock.calls.length;
	await vi.runOnlyPendingTimersAsync();
	expect(read).toHaveBeenCalledTimes(count);
	expect(vi.getTimerCount()).toBe(0);
});
