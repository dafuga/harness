import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubMessages } from '../../src/routes/api/[...path]/hub-projection-service/hubThreads';
import { hubThreads } from '../../src/utils/networking-security/hubThreads';

type CommittedThread = Parameters<typeof hubThreads>[0][number];
type ThreadSummary = ReturnType<typeof hubThreads>[number];

interface CommentInput {
	id: string;
	actorId: string;
	actorName: string;
	text: string;
	createdAt: string;
}

function comment(input: CommentInput) {
	return {
		id: input.id,
		createdAt: input.createdAt,
		text: input.text,
		actor: { id: input.actorId, name: input.actorName }
	};
}

function thread(
	id: string,
	version: string,
	comments: ReturnType<typeof comment>[]
): CommittedThread {
	return {
		id,
		anchor: {
			version,
			imageSha256: `sha-${id}`,
			state: 'open',
			viewport: 'desktop',
			region: { x: 0, y: 0, width: 120, height: 80 }
		},
		comments
	} as unknown as CommittedThread;
}

function summarizeThread(info: ThreadSummary) {
	return {
		id: info.id,
		pin: info.pin,
		version: info.version,
		imageSha256: info.imageSha256,
		state: info.state,
		viewport: info.viewport,
		messageCount: info.messageCount
	};
}

const sharedThreads: CommittedThread[] = [
	thread('thr-b', 'v2', [
		comment({
			id: 'c-2',
			actorId: 'u-2',
			actorName: 'Grace',
			text: 'Move the button left',
			createdAt: '2026-11-16T09:00:00Z'
		})
	]),
	thread('thr-a', 'v1', [
		comment({
			id: 'c-1',
			actorId: 'u-1',
			actorName: 'Ada',
			text: 'Check the contrast',
			createdAt: '2026-11-16T08:00:00Z'
		}),
		comment({
			id: 'c-3',
			actorId: 'u-2',
			actorName: 'Grace',
			text: 'Agreed',
			createdAt: '2026-11-16T08:30:00Z'
		})
	])
];

const commentedThread: CommittedThread = thread('thr-c', 'v3', [
	comment({
		id: 'c-10',
		actorId: 'u-1',
		actorName: 'Ada',
		text: 'Make it larger',
		createdAt: '2026-11-16T10:00:00Z'
	}),
	comment({
		id: 'c-11',
		actorId: 'u-2',
		actorName: 'Grace',
		text: 'Done in v3',
		createdAt: '2026-11-16T11:00:00Z'
	})
]);

const emptyThread: CommittedThread = thread('thr-d', 'v1', []);

test('Numbers shared threads by id with an offset', () => {
	const originalOrder = sharedThreads.map((t) => t.id);

	const offsetOutput = hubThreads(sharedThreads, 10);
	expect(offsetOutput.map((t) => t.id)).toEqual(['thr-a', 'thr-b']);
	expect(offsetOutput.map((t) => t.pin)).toEqual([11, 12]);
	expect(offsetOutput[0].messageCount).toBe(2);
	expect(offsetOutput[1].messageCount).toBe(1);

	const defaultOutput = hubThreads(sharedThreads);
	expect(defaultOutput.map((t) => t.pin)).toEqual([1, 2]);
	expect(sharedThreads.map((t) => t.id)).toEqual(originalOrder);

	const emptyOutput = hubThreads([]);
	expect(emptyOutput).toEqual([]);

	recordExampleCases(
		{
			unitId: 'hub.function.hub-threads',
			symbol: 'hubThreads',
			state: 'numbers-shared-threads-by-id-with-an-offset',
			evidence: 'examples-cases',
			file: 'numbers-shared-threads-by-id-with-an-offset.json'
		},
		[
			{
				name: 'sorts by id and starts pins after offset 10',
				input: { threads: sharedThreads, offset: 10 },
				output: offsetOutput.map(summarizeThread)
			},
			{
				name: 'uses offset zero when none is given',
				input: { threads: sharedThreads },
				output: defaultOutput.map(summarizeThread)
			},
			{
				name: 'returns an empty list for no threads',
				input: { threads: [], offset: 0 },
				output: emptyOutput.map(summarizeThread)
			}
		]
	);
});

test('Maps thread comments to user display messages', () => {
	const output = hubMessages(commentedThread);
	expect(output.map((m) => m.id)).toEqual(['c-10', 'c-11']);
	expect(output.map((m) => m.text)).toEqual(['Make it larger', 'Done in v3']);
	for (const message of output) {
		expect(message.author).toBe('user');
		expect(message.mode).toBeNull();
		expect(message.provider).toBeNull();
		expect(message.model).toBeNull();
		expect(message.version).toBe('v3');
		expect(message.imageSha256).toBe('sha-thr-c');
	}
	expect(output[0].actorId).toBe('u-1');
	expect(output[0].authorName).toBe('Ada');
	expect(output[0].at).toBe('2026-11-16T10:00:00Z');

	const emptyOutput = hubMessages(emptyThread);
	expect(emptyOutput).toEqual([]);

	recordExampleCases(
		{
			unitId: 'hub.function.hub-threads',
			symbol: 'hubMessages',
			state: 'maps-thread-comments-to-user-display-messages',
			evidence: 'examples-cases',
			file: 'maps-thread-comments-to-user-display-messages.json'
		},
		[
			{
				name: 'maps two comments in supplied order',
				input: commentedThread,
				output: output
			},
			{
				name: 'returns no messages for a thread without comments',
				input: emptyThread,
				output: emptyOutput
			}
		]
	);
});
