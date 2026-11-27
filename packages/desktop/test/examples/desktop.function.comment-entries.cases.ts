import { test } from 'vitest';
import type { CommittedThread } from '../../../collaboration/src/models/planning-collaboration/Collaboration.types';
import { commentEntries } from '../../src/adapters/explorer-ui/browser-project-adapter/commentEntries';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

export const thread: CommittedThread = {
	id: '8d2f4e1a-6b3c-4f70-9a51-2c7e9d0b4f36',
	projectId: '0f6a3c8e-d2b4-4e91-b7a5-5c1f9e8d2a64',
	anchor: {
		branch: 'main',
		commit: '9c1e4a7b2d8f03e5a6b1c9d7e2f4a8b0c3d5e6f7',
		entityId: 'desktop.function.comment-entries',
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	},
	comments: [
		{
			id: 'c41e7b90-2a5d-4e3f-8b16-7d9a0c3e5f21',
			requestId: '3b9d6f02-7e1a-4c85-a4f3-0d8e2b6c9a17',
			actor: {
				id: 'google-1048275619304857261',
				email: 'sam.rivera@example.com',
				name: 'Sam Rivera',
				emailVerified: true
			},
			text: 'Should the pending note keep the thread number too?',
			createdAt: '2026-11-14T09:12:40.118Z'
		},
		{
			id: '6e0b3d7a-f19c-4a28-9d54-3b8e1c7f2a90',
			requestId: 'b5e2a9c4-03d7-4f6e-8a1b-9c4d7e0f2b38',
			actor: {
				id: 'google-2930847165029384715',
				email: 'lee.okafor@example.com',
				name: 'Lee Okafor',
				emailVerified: true
			},
			text: 'Yes, keep it to the pin number only.',
			createdAt: '2026-11-14T10:47:03.906Z'
		}
	],
	collaborationCommit: '5a7d0e2c9b41f8e63d2a07c5b9e1f4d8a3c6b02e'
};

function summarizeEntries(entries: ReturnType<typeof commentEntries>) {
	return entries.map(
		({
			id,
			at,
			author,
			authorName,
			text,
			mode,
			provider,
			model,
			version: entryVersion,
			imageSha256: hash
		}) => ({
			id,
			at,
			author,
			...(authorName === undefined ? {} : { authorName }),
			text,
			mode,
			provider,
			model,
			version: entryVersion,
			imageSha256: hash
		})
	);
}

test('Maps committed comments to ordered conversation entries', () => {
	const output = commentEntries(thread);
	const emptyThread = { ...thread, comments: [] };

	expect(output.map(({ id, authorName }) => [id, authorName])).toEqual([
		['c41e7b90-2a5d-4e3f-8b16-7d9a0c3e5f21', 'Sam Rivera'],
		['6e0b3d7a-f19c-4a28-9d54-3b8e1c7f2a90', 'Lee Okafor']
	]);
	expect(commentEntries(emptyThread)).toEqual([]);
	recordExampleCases(
		{
			unitId: 'desktop.function.comment-entries',
			symbol: 'commentEntries',
			state: 'maps-committed-comments-to-ordered-conversation-entries',
			evidence: 'examples-cases',
			file: 'maps-committed-comments-to-ordered-conversation-entries.json'
		},
		[
			{ name: 'map two stored comments in order', input: thread, output: summarizeEntries(output) },
			{
				name: 'map a thread without comments',
				input: emptyThread,
				output: commentEntries(emptyThread)
			}
		]
	);
});
