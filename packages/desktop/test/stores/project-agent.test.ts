import { expect, test, vi } from 'vitest';
import { createProjectAgentStore } from '../../src/lib/stores/projectAgent.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { RunEvent } from '../../src/models/DesktopBridge.types';

function shown(change: object = {}) {
	let follow: (event: RunEvent) => void = () => {};
	const bridge = {
		providers: vi.fn(async () => []),
		startRun: vi.fn(async () => ({ runId: 'run-1' })),
		onRunEvent: (listener: typeof follow) => {
			follow = listener;
			return () => {};
		}
	};
	const workspace = {
		bridge,
		category: 'functions',
		pinned: false,
		capabilities: { agents: true },
		snapshot: { writable: true },
		projectId: 'local-1',
		get context(): { projectId: string } {
			return { projectId: this.projectId };
		},
		refresh: vi.fn(async () => {}),
		navigate: vi.fn(async () => {}),
		path: (category: string, id: string) => `/${category}/${id}`,
		...change
	};
	const agent = createProjectAgentStore(workspace as unknown as Workspace);
	agent.listen();
	const emit = (event: object, runId = 'run-1') => follow({ runId, ...event } as RunEvent);
	return { agent, bridge, workspace, emit };
}
const draft = {
	mode: 'plan' as const,
	provider: 'codex' as const,
	model: 'listed',
	effort: null,
	text: 'Add a formatter'
};
const made = { category: 'functions', entityId: 'function.new' };
const created = { ...made, threadId: 'thread-1', requestSaved: true };

test('a Plan is one creation request of the shown project, and its plan is opened once it exists', async () => {
	const f = shown();
	const sent = f.agent.send(draft);
	await vi.waitFor(() => expect(f.agent.runId).toBe('run-1'));
	expect(f.bridge.startRun.mock.calls).toEqual([
		[{ intent: 'create', category: 'functions', ...draft, projectId: 'local-1' }]
	]);
	f.emit({ kind: 'status', phase: 'saving', detail: 'Another run' }, 'run-2');
	expect(f.agent.status).toBe('Request accepted');
	f.emit({ kind: 'finished', summary: 'Planned it.', verified: false, created });
	await expect(sent).resolves.toBe(true);
	await vi.waitFor(() =>
		expect(f.workspace.navigate).toHaveBeenCalledWith('/functions/function.new')
	);
	expect(f.workspace.refresh).toHaveBeenCalledOnce();
});

test('a run that failed keeps the request with the person and opens nothing', async () => {
	const f = shown();
	const sent = f.agent.send(draft);
	await vi.waitFor(() => expect(f.agent.runId).toBe('run-1'));
	f.emit({ kind: 'failed', message: 'The proposal was not used.' });
	await expect(sent).resolves.toBe(false);
	expect([f.agent.error, f.agent.asked]).toEqual(['The proposal was not used.', draft.text]);
	expect(f.workspace.navigate).not.toHaveBeenCalled();
});

test('a draft left without the request is linked: the text stays and nothing is opened', async () => {
	for (const threadId of [null, 'thread-1']) {
		const f = shown();
		const sent = f.agent.send(draft);
		await vi.waitFor(() => expect(f.agent.runId).toBe('run-1'));
		const left = { ...made, threadId, requestSaved: false };
		f.emit({ kind: 'failed', message: 'It failed here.', created: left });
		await expect(sent).resolves.toBe(false);
		await vi.waitFor(() => expect(f.workspace.refresh).toHaveBeenCalledOnce());
		expect([f.agent.saved, f.agent.asked, f.agent.error]).toEqual([
			left,
			draft.text,
			'It failed here.'
		]);
		expect(f.workspace.navigate).not.toHaveBeenCalled();
	}
});

test('a cancelled run says whether a draft was saved, and a new request forgets the last draft', async () => {
	const f = shown();
	const first = f.agent.send(draft);
	await vi.waitFor(() => expect(f.agent.runId).toBe('run-1'));
	f.emit({ kind: 'cancelled', created: { ...made, threadId: null, requestSaved: false } });
	await expect(first).resolves.toBe(false);
	expect(f.agent.status).toBe('Cancelled. A draft was saved.');
	const second = f.agent.send(draft);
	await vi.waitFor(() => expect(f.agent.runId).toBe('run-1'));
	expect(f.agent.saved).toBeNull();
	f.emit({ kind: 'cancelled' });
	await expect(second).resolves.toBe(false);
	expect(f.agent.status).toBe('Cancelled. Nothing was planned.');
});

test('a run that failed after its plan was written opens that plan and is not kept to resend', async () => {
	const f = shown();
	const sent = f.agent.send(draft);
	await vi.waitFor(() => expect(f.agent.runId).toBe('run-1'));
	f.emit({ kind: 'failed', message: 'No image was made.', created });
	await expect(sent).resolves.toBe(true);
	await vi.waitFor(() =>
		expect(f.workspace.navigate).toHaveBeenCalledWith('/functions/function.new')
	);
	expect(f.agent.error).toBe('No image was made.');
});

test('nothing is asked for a Change, in a hosted project or at a past commit', async () => {
	const local = shown();
	await expect(local.agent.send({ ...draft, mode: 'change' })).resolves.toBe(false);
	for (const change of [
		{ capabilities: { agents: false } },
		{ pinned: true },
		{ snapshot: { writable: false } },
		{ projectId: null }
	]) {
		const f = shown(change);
		expect(f.agent.allowed).toBe(false);
		await expect(f.agent.send(draft)).resolves.toBe(false);
		expect([f.bridge.startRun.mock.calls, f.bridge.providers.mock.calls]).toEqual([[], []]);
	}
	expect(local.bridge.startRun).not.toHaveBeenCalled();
});
