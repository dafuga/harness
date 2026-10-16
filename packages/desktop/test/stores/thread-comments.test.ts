import { expect, test, vi } from 'vitest';
import { createThreadCommentsStore } from '../../src/lib/stores/threadComments.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import type { HumanCommentDraft, HumanCommentResult } from '../../src/models/ProjectContext.types';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const anchor = {
	branch: 'main',
	commit: 'a'.repeat(40),
	entityId: 'page:a',
	version: null,
	imageSha256: null,
	state: null,
	viewport: null,
	region: null
};
const pending = (input: HumanCommentDraft): HumanCommentResult => ({
	kind: 'pending',
	projectId: 'p',
	draftId: `draft-${input.requestId}`,
	savedAt: '2026-10-12T00:00:00.000Z',
	input,
	reason: 'Saved locally; not synced.'
});
function workspaceOf(bridge: object, projectId = 'p') {
	return { bridge, projectId, context: { projectId } } as unknown as Workspace;
}

test('a comment is one comment call that names the project and never a run', async () => {
	const addComment = vi.fn(async (input: HumanCommentDraft) => pending(input));
	const startRun = vi.fn();
	const openThread = vi.fn();
	const store = createThreadCommentsStore(workspaceOf({ addComment, startRun, openThread }));
	const result = await store.post({ text: 'Tighten this', anchor, threadId: 't1' });
	expect(addComment).toHaveBeenCalledTimes(1);
	const sent = addComment.mock.calls[0][0];
	expect(sent).toMatchObject({ projectId: 'p', text: 'Tighten this', anchor, threadId: 't1' });
	expect(sent.requestId).toMatch(uuid);
	expect(startRun).not.toHaveBeenCalled();
	expect(openThread).not.toHaveBeenCalled();
	expect(result?.kind).toBe('pending');
	expect(store.pending.map((item) => item.input.text)).toEqual(['Tighten this']);
	expect(store.acknowledged).toBe('');
	expect(store.error).toBe('');
});

test('only a shared answer is acknowledged, with its collaboration commit', async () => {
	const addComment = vi.fn(
		async (input: HumanCommentDraft): Promise<HumanCommentResult> => ({
			kind: 'shared',
			projectId: 'p',
			thread: {
				id: 't9',
				projectId: 'p',
				anchor: input.anchor,
				comments: [],
				collaborationCommit: 'f'.repeat(40)
			}
		})
	);
	const store = createThreadCommentsStore(workspaceOf({ addComment }));
	await store.post({ text: 'Looks right', anchor });
	expect(store.acknowledged).toBe('f'.repeat(40));
	expect(store.pending).toEqual([]);
	expect(addComment.mock.calls[0][0]).not.toHaveProperty('threadId');
});

test('a failed comment keeps its request id for the retry and is neither pending nor saved', async () => {
	const addComment = vi
		.fn(async (input: HumanCommentDraft) => pending(input))
		.mockRejectedValueOnce(new Error('offline'));
	const store = createThreadCommentsStore(workspaceOf({ addComment }));
	expect(await store.post({ text: 'Retry me', anchor })).toBeNull();
	expect(store.error).toMatch(/offline/);
	expect(store.pending).toEqual([]);
	expect(store.acknowledged).toBe('');
	await store.post({ text: 'Retry me', anchor });
	await store.post({ text: 'Another', anchor });
	const ids = addComment.mock.calls.map((call) => call[0].requestId);
	expect(ids[1]).toBe(ids[0]);
	expect(ids[2]).not.toBe(ids[0]);
	expect(store.error).toBe('');
});

test('an answer for another project is refused', async () => {
	const addComment = vi.fn(async (input: HumanCommentDraft) => ({
		...pending(input),
		projectId: 'other'
	}));
	const store = createThreadCommentsStore(workspaceOf({ addComment }));
	expect(await store.post({ text: 'Mine', anchor })).toBeNull();
	expect(store.pending).toEqual([]);
	expect(store.error).toMatch(/another project/);
});

test('pending drafts are read from the bridge of the shown project', async () => {
	const saved = pending({ requestId: 'r1', anchor, text: 'From before the restart' });
	const pendingComments = vi.fn(async () => [saved]);
	const store = createThreadCommentsStore(workspaceOf({ pendingComments }));
	await store.load();
	expect(pendingComments).toHaveBeenCalledWith({ projectId: 'p' });
	expect(store.pending).toEqual([saved]);
	const legacy = createThreadCommentsStore(workspaceOf({}));
	await legacy.load();
	expect(legacy.pending).toEqual([]);
	expect(await legacy.post({ text: 'No operation', anchor })).toBeNull();
});
