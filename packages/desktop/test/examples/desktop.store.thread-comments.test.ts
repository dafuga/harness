import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createThreadCommentsStore } from '../../src/lib/stores/development-tooling/threadComments.svelte';
import { ThreadCommentProjectMismatchError } from '../../src/lib/stores/development-tooling/threadComments.svelte.types';
import type { CommentInput } from '../../src/lib/stores/development-tooling/threadComments.svelte.types';

const input: CommentInput = {
	text: 'The heading needs a clearer label.',
	anchor: {
		branch: 'main',
		commit: 'commit-1',
		entityId: 'entity-7',
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	},
	threadId: 'thread-2'
};
const draft = {
	kind: 'pending' as const,
	projectId: 'project-1',
	draftId: 'draft-1',
	savedAt: '2026-11-16T10:00:00.000Z',
	input,
	reason: 'offline'
};
const workspace = (bridge: Record<string, unknown>, projectId = 'project-1') =>
	({
		projectId,
		context: { projectId, entityId: 'entity-7' },
		bridge
	}) as unknown as Parameters<typeof createThreadCommentsStore>[0];

test('loads only pending drafts from the current project', async () => {
	const store = createThreadCommentsStore(
		workspace({ pendingComments: async () => [draft, { ...draft, kind: 'shared' }] })
	);
	await store.load();
	expect(store.pending).toEqual([draft]);
	expect(store.error).toBe('');
	recordExampleCases(
		{
			unitId: 'desktop.store.thread-comments',
			symbol: 'load',
			state: 'loads-only-pending-drafts-from-the-current-project',
			evidence: 'examples-cases',
			file: 'loads-only-pending-drafts-from-the-current-project.json'
		},
		[
			{
				name: 'filter loaded comments to pending drafts',
				input: { projectId: 'project-1', comments: [draft, { ...draft, kind: 'shared' }] },
				output: { pending: store.pending, error: store.error }
			}
		]
	);
});

test('posts a comment and exposes its pending acknowledgement', async () => {
	const store = createThreadCommentsStore(
		workspace({ addComment: async (posted: unknown) => ({ ...draft, input: posted }) })
	);
	const result = await store.post(input);
	expect(result).toMatchObject({ kind: 'pending', draftId: 'draft-1' });
	expect(store.pending).toHaveLength(1);
	expect(store.busy).toBe(false);
	recordExampleCases(
		{
			unitId: 'desktop.store.thread-comments',
			symbol: 'post',
			state: 'posts-a-comment-and-exposes-its-pending-acknowledgement',
			evidence: 'examples-cases',
			file: 'posts-a-comment-and-exposes-its-pending-acknowledgement.json'
		},
		[
			{
				name: 'post a comment while offline',
				input,
				output: {
					result,
					pending: store.pending,
					acknowledged: store.acknowledged,
					busy: store.busy
				}
			}
		]
	);
});

test('Throws ThreadCommentProjectMismatchError when the bridge answers for another project', async () => {
	const store = createThreadCommentsStore(
		workspace({ addComment: async () => ({ ...draft, projectId: 'project-2' }) })
	);
	const result = await store.post(input);
	const expectedError = String(
		new ThreadCommentProjectMismatchError('The bridge answered for another project.')
	);
	expect(result).toBeNull();
	expect(store.error).toBe(expectedError);
	expect(store.busy).toBe(false);
	recordExampleCases(
		{
			unitId: 'desktop.store.thread-comments',
			symbol: 'post',
			state: 'throws-threadcommentprojectmismatcherror-when-the-bridge-ans',
			evidence: 'examples-cases',
			file: 'throws-threadcommentprojectmismatcherror-when-the-bridge-ans.json'
		},
		[
			{
				name: 'store the project mismatch raised by the bridge response',
				input: { projectId: 'project-1', responseProjectId: 'project-2', comment: input },
				output: { result, error: store.error, busy: store.busy }
			}
		]
	);
});
