// @harness-uid u_trkinbox11
import { describe, expect, it, vi } from 'vitest';
import { phoneTrackerInboxSource } from '../../src/lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';
import type {
	PhoneTrackerResult,
	PhoneTrackerTools
} from '../../src/models/development-tooling/PhoneTracker.types';

const header = (id: string, status = 'open') => ({
	id,
	title: `Item ${id}`,
	project: 'Harness',
	status,
	updatedAt: '2026-11-23T10:00:00.000Z',
	dueAt: null
});

const fresh = {
	source: 'local_tracker',
	lastSyncedAt: '2026-11-23T10:00:00.000Z',
	freshness: 'current',
	partial: false
} as const;

function tools(
	reply: (name: string, input: Record<string, unknown>) => Partial<PhoneTrackerResult>
) {
	const call = vi.fn(async (name: never, input: Record<string, unknown>) => ({
		...fresh,
		...reply(name, input)
	}));
	return {
		tools: { schemas: [], call, refresh: async () => {} } as unknown as PhoneTrackerTools,
		call
	};
}

describe('phoneTrackerInboxSource overview', () => {
	it('lists Needs you first and does not repeat a recent item', async () => {
		const { tools: t } = tools(() => ({
			data: {
				counts: {},
				unresolvedFlags: 1,
				needsYou: [header('aaaaaa1', 'in_progress')],
				recent: [header('aaaaaa1', 'in_progress'), header('bbbbbb2', 'blocked')]
			}
		}));
		const reply = await phoneTrackerInboxSource(t).overview();
		expect(reply.value?.rows.map((row) => [row.header.id, row.bucket])).toEqual([
			['aaaaaa1', 'needs-you'],
			['bbbbbb2', 'blocked']
		]);
		expect(reply.value?.unresolvedFlags).toBe(1);
		expect(reply.value?.needsYouCapped).toBe(false);
		expect(reply.freshness).toBe('current');
	});

	it('reports a cap of Needs you items and drops malformed headers', async () => {
		const many = Array.from({ length: 25 }, (_, index) => header(`id${index}000`));
		const { tools: t } = tools(() => ({ data: { needsYou: [...many, { id: 'x' }], recent: [] } }));
		const reply = await phoneTrackerInboxSource(t).overview();
		expect(reply.value?.rows).toHaveLength(25);
		expect(reply.value?.needsYouCapped).toBe(true);
	});

	it('passes through a denied or unavailable code without a value', async () => {
		const { tools: t } = tools(() => ({
			freshness: 'unavailable',
			code: 'noReplica',
			data: undefined
		}));
		const reply = await phoneTrackerInboxSource(t).overview();
		expect(reply.code).toBe('noReplica');
		expect(reply.value).toBeUndefined();
	});

	it('reports unavailable when the bridge throws', async () => {
		const throwing = {
			schemas: [],
			call: async () => {
				throw new Error('bridge gone');
			},
			refresh: async () => {}
		} as unknown as PhoneTrackerTools;
		const reply = await phoneTrackerInboxSource(throwing).overview();
		expect(reply).toMatchObject({ code: 'unavailable', freshness: 'unavailable' });
	});
});

describe('phoneTrackerInboxSource detail', () => {
	it('reads an item with its flag, notes, runs and reviewed revision', async () => {
		const { tools: t } = tools(() => ({
			data: {
				item: header('cccccc3', 'blocked'),
				notes: [{ id: 'n1', author: 'Daniel', at: '2026-11-23', text: 'Looked' }],
				flag: { state: 'open', at: null, question: 'Merge?' },
				runs: [
					{
						id: '7',
						origin: 'native',
						state: 'done',
						outcome: 'ok',
						queuedAt: 1,
						startedAt: 2,
						endedAt: 3
					}
				],
				attentionRevision: 'rev-9'
			}
		}));
		const reply = await phoneTrackerInboxSource(t).detail('cccccc3');
		expect(reply.value).toMatchObject({
			header: { id: 'cccccc3' },
			flag: { question: 'Merge?' },
			revision: 'rev-9'
		});
		expect(reply.value?.runs[0]).toMatchObject({ state: 'done', outcome: 'ok', endedAt: 3 });
	});
});

describe('phoneTrackerInboxSource writes', () => {
	it('sends a flag or answer with its reviewed revision, and a note without one', async () => {
		const { tools: t, call } = tools(() => ({ data: { intentId: 'i-1', status: 'queued' } }));
		const source = phoneTrackerInboxSource(t);
		await source.write({ action: 'answer', id: 'cccccc3', text: 'Yes', revision: 'rev-9' });
		await source.write({ action: 'note', id: 'cccccc3', text: 'Hi', revision: null });
		expect(call.mock.calls[0]).toEqual([
			'tracker_answer',
			{ id: 'cccccc3', text: 'Yes', revision: 'rev-9' }
		]);
		expect(call.mock.calls[1]).toEqual(['tracker_note', { id: 'cccccc3', text: 'Hi' }]);
	});

	it('keeps a refusal code and its candidates from a write', async () => {
		const { tools: t } = tools(() => ({ code: 'staleReview', data: { candidates: ['x1'] } }));
		const reply = await phoneTrackerInboxSource(t).write({
			action: 'flag',
			id: 'cccccc3',
			text: 'Check',
			revision: 'old'
		});
		expect(reply).toMatchObject({ code: 'staleReview', candidates: ['x1'] });
	});

	it('reads the outbox states and forwards discard by intent ID', async () => {
		const { tools: t, call } = tools((name) =>
			name === 'tracker_write_status'
				? {
						data: {
							writes: [
								{ intentId: 'i-1', itemId: 'cccccc3', status: 'conflict', reason: 'attention' }
							]
						}
					}
				: { data: {} }
		);
		const source = phoneTrackerInboxSource(t);
		const writes = await source.writes();
		expect(writes.value).toEqual([
			{ intentId: 'i-1', itemId: 'cccccc3', status: 'conflict', reason: 'attention' }
		]);
		await source.discard('i-1');
		expect(call).toHaveBeenLastCalledWith('tracker_discard_write', { intentId: 'i-1' });
	});
});
