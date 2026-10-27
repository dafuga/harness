import { expect, test, vi } from 'vitest';
import { createProjectWorkActionsStore } from '../../../src/lib/stores/agents-providers/projectWorkActions.svelte';
import { createProjectWorkStore } from '../../../src/lib/stores/agents-providers/projectWork.svelte';

const digest = 'a'.repeat(64);
const selection = {
	feature: 'checkout',
	page: 'page.orders',
	option: 'o2',
	expectedDigest: digest
};
const approval = { feature: 'checkout', reviewer: 'Reviewer', expectedDigest: digest };

function setup() {
	const snapshot = { features: [{ id: 'checkout', plan: { digest } }] };
	const refresh = vi.fn().mockResolvedValue(undefined);
	const work = { snapshot, refresh } as {
		snapshot: typeof snapshot | null;
		refresh: typeof refresh;
	};
	const select = vi.fn().mockResolvedValue({});
	const approve = vi.fn().mockResolvedValue({});
	const bridge = { selectFeaturePlan: select, approveFeaturePlan: approve };
	const workspace = { projectId: 'project-a', bridge } as {
		projectId: string | null;
		bridge: typeof bridge | null;
	};
	const store = createProjectWorkActionsStore(workspace as never, work as never);
	return { store, work, workspace, bridge, select, approve, refresh };
}

function delayed() {
	let resolve!: (value: object) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<object>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

test('selection and approval use the visible plan digest and refresh after success', async () => {
	const f = setup();
	const waiting = delayed();
	f.select.mockReturnValueOnce(waiting.promise);
	const pending = f.store.select(selection);
	expect(f.store.pending).toBe(true);
	expect(await f.store.approve(approval)).toBe(false);
	expect(f.approve).not.toHaveBeenCalled();
	waiting.resolve({});
	expect(await pending).toBe(true);
	expect(f.select).toHaveBeenCalledExactlyOnceWith({ projectId: 'project-a', ...selection });
	expect(await f.store.approve(approval)).toBe(true);
	expect(f.approve).toHaveBeenCalledExactlyOnceWith({ projectId: 'project-a', ...approval });
	expect(f.refresh).toHaveBeenCalledTimes(2);
	expect(f.store.pending).toBe(false);
	expect(f.store.error).toBeNull();
	const spoofed = setup();
	const supplied = { ...selection, projectId: 'project-b' };
	await spoofed.store.select(supplied);
	expect(spoofed.select).toHaveBeenCalledExactlyOnceWith({ projectId: 'project-a', ...selection });
	const suppliedApproval = { ...approval, projectId: 'project-b' };
	await spoofed.store.approve(suppliedApproval);
	expect(spoofed.approve).toHaveBeenCalledExactlyOnceWith({ projectId: 'project-a', ...approval });
});

test('unavailable, unreviewed and failed actions never claim success', async () => {
	const f = setup();
	f.work.snapshot = null;
	expect(await f.store.select(selection)).toBe(false);
	expect(f.store.error).toMatch(/plan|work|review/i);
	f.work.snapshot = { features: [{ id: 'checkout', plan: { digest } }] };
	expect(await f.store.select({ ...selection, expectedDigest: 'b'.repeat(64) })).toBe(false);
	expect(f.store.error).toMatch(/stale|plan|review/i);
	expect(f.select).not.toHaveBeenCalled();
	f.select.mockRejectedValueOnce(new Error('Synthetic selection failure'));
	expect(await f.store.select(selection)).toBe(false);
	expect(f.store.error).toContain('Synthetic selection failure');
	expect(f.refresh).not.toHaveBeenCalled();
	expect(await f.store.select(selection)).toBe(true);
	expect(f.store.error).toBeNull();
	Reflect.deleteProperty(f.bridge, 'approveFeaturePlan');
	expect(await f.store.approve(approval)).toBe(false);
	expect(f.store.error).toMatch(/unavailable/i);
	expect(f.approve).not.toHaveBeenCalled();
});

test.each(['project', 'bridge', 'capability'])(
	'late %s replies never refresh or leak state',
	async (change) => {
		const f = setup();
		const waiting = delayed();
		f.select.mockReturnValueOnce(waiting.promise);
		const pending = f.store.select(selection);
		if (change === 'project') f.workspace.projectId = 'project-b';
		if (change === 'bridge') f.workspace.bridge = null;
		if (change === 'capability') Reflect.deleteProperty(f.bridge, 'selectFeaturePlan');
		expect(f.store.pending).toBe(false);
		waiting.resolve({});
		expect(await pending).toBe(false);
		expect(f.store.error).toBeNull();
		expect(f.refresh).not.toHaveBeenCalled();
	}
);

test('a stale failure cannot replace the next project action state', async () => {
	const f = setup();
	const waiting = delayed();
	f.select.mockReturnValueOnce(waiting.promise);
	const old = f.store.select(selection);
	f.workspace.projectId = 'project-b';
	expect(await f.store.approve(approval)).toBe(true);
	waiting.reject(new Error('Old project failure'));
	expect(await old).toBe(false);
	expect(f.store.error).toBeNull();
	expect(f.approve).toHaveBeenCalledExactlyOnceWith({ projectId: 'project-b', ...approval });
	expect(f.refresh).toHaveBeenCalledTimes(1);
});

test('returning to a previous project does not revive an obsolete action', async () => {
	const f = setup();
	const waiting = delayed();
	f.select.mockReturnValueOnce(waiting.promise);
	const old = f.store.select(selection);
	f.workspace.projectId = 'project-b';
	expect(f.store.pending).toBe(false);
	f.workspace.projectId = 'project-a';
	expect(f.store.pending).toBe(false);
	waiting.resolve({});
	expect(await old).toBe(false);
	expect(f.refresh).not.toHaveBeenCalled();
	expect(await f.store.select(selection)).toBe(true);
});

test('the real Work snapshot hides a previous project before an action can use it', async () => {
	const select = vi.fn().mockResolvedValue({});
	const bridge = {
		projectWork: vi.fn().mockResolvedValue({
			queueCommit: null,
			features: [{ id: 'checkout', goal: 'Checkout', tldr: 'Review', plan: { digest }, tasks: [] }]
		}),
		selectFeaturePlan: select
	};
	const workspace = { projectId: 'project-a', bridge };
	const work = createProjectWorkStore(workspace as never);
	await work.refresh();
	const actions = createProjectWorkActionsStore(workspace as never, work);
	workspace.projectId = 'project-b';
	expect(work.snapshot).toBeNull();
	expect(await actions.select(selection)).toBe(false);
	expect(select).not.toHaveBeenCalled();
});
