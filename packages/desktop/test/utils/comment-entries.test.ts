import { expect, test } from 'vitest';
import { commentEntries, pendingEntries, threadInfo } from '../../src/utils/commentEntries';
import type { CommittedThread } from '../../../collaboration/src/models/Collaboration.types';
import type { HumanCommentResult } from '../../src/models/ProjectContext.types';
import type { ThreadInfo } from '../../src/models/Desktop.types';

const anchor = {
	branch: 'main',
	commit: 'a'.repeat(40),
	entityId: 'page:a',
	version: 'v002',
	imageSha256: 'b'.repeat(64),
	state: 'default',
	viewport: 'desktop',
	region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
};
const thread: CommittedThread = {
	id: 't1',
	projectId: 'p',
	anchor,
	collaborationCommit: 'f'.repeat(40),
	comments: [
		{
			id: 'c1',
			requestId: 'r1',
			actor: { id: 'google:1', email: 'ada@example.invalid', name: 'Ada', emailVerified: true },
			text: 'Narrow this',
			createdAt: '2026-10-12T00:00:00.000Z'
		}
	]
};

test('a shared comment keeps who wrote it and is never an agent message', () => {
	expect(commentEntries(thread)).toEqual([
		{
			id: 'c1',
			at: '2026-10-12T00:00:00.000Z',
			author: 'user',
			authorName: 'Ada',
			text: 'Narrow this',
			mode: null,
			provider: null,
			model: null,
			version: 'v002',
			imageSha256: 'b'.repeat(64)
		}
	]);
});

test('a shared thread becomes a pin on its exact image', () => {
	expect(threadInfo(thread, 3)).toEqual({
		id: 't1',
		pin: 3,
		version: 'v002',
		imageSha256: 'b'.repeat(64),
		state: 'default',
		viewport: 'desktop',
		region: anchor.region,
		messageCount: 1
	});
});

test('a pending draft says it is pending, where it belongs and why', () => {
	const draft = (id: string, entityId: string, threadId?: string): HumanCommentResult => ({
		kind: 'pending',
		projectId: 'p',
		draftId: id,
		savedAt: '2026-10-12T01:00:00.000Z',
		reason: 'Saved locally; not synced.',
		input: { requestId: id, threadId, anchor: { ...anchor, entityId }, text: `text ${id}` }
	});
	const threads = [{ id: 't1', pin: 4 }] as ThreadInfo[];
	const entries = pendingEntries(
		[
			draft('d1', 'page:a', 't1'),
			draft('d2', 'page:other'),
			draft('d3', 'page:a'),
			{ kind: 'shared', projectId: 'p', thread }
		],
		'page:a',
		threads
	);
	expect(entries.map((entry) => entry.id)).toEqual(['d1', 'd3']);
	expect(entries[0]).toMatchObject({
		author: 'user',
		text: 'text d1',
		pending: true,
		note: 'Pending on this device · not shared · Thread #4',
		detail: 'Saved locally; not synced.'
	});
	expect(entries[1].note).toBe('Pending on this device · not shared');
	expect(JSON.stringify(entries)).not.toMatch(/Saved to GitHub/);
});
