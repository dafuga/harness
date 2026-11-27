// @harness-uid u_trkinbox12
import { describe, expect, it, vi } from 'vitest';
import {
	optionWrite,
	orderedOptions
} from '../../src/lib/development-tooling/tracker-inbox/trackerInbox';
import { parseDetail } from '../../src/lib/development-tooling/tracker-inbox/phoneTrackerInboxParse';
import { phoneTrackerInboxSource } from '../../src/lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';
import type { PhoneTrackerTools } from '../../src/models/development-tooling/PhoneTracker.types';
import type { InboxDetail } from '../../src/models/development-tooling/TrackerInbox.types';

const options = [
	{ label: 'Deploy', effect: 'Ship to production' },
	{ label: 'Hold', effect: 'Wait a day', recommended: true as const },
	{ label: 'Roll back', effect: '' }
];

const detail = (flag: Partial<NonNullable<InboxDetail['flag']>> = {}): InboxDetail => ({
	header: {
		id: 'abc123',
		title: 'Gate',
		project: 'Harness',
		status: 'open',
		updatedAt: null,
		dueAt: null
	},
	notes: [],
	runs: [],
	revision: 'rev-1',
	flag: { state: 'open', at: null, question: 'Deploy now?', options, ...flag }
});

describe('orderedOptions', () => {
	it('shows the recommended option first and keeps every original number', () => {
		expect(
			orderedOptions(detail().flag).map(({ number, option }) => [number, option.label])
		).toEqual([
			[2, 'Hold'],
			[1, 'Deploy'],
			[3, 'Roll back']
		]);
	});

	it('shows nothing for a resolved flag or an ask without options', () => {
		expect(orderedOptions(detail({ state: 'resolved' }).flag)).toEqual([]);
		expect(orderedOptions(detail({ options: undefined }).flag)).toEqual([]);
		expect(orderedOptions(null)).toEqual([]);
	});
});

describe('optionWrite', () => {
	it('builds an answer carrying the option number, its label and the reviewed revision', () => {
		expect(optionWrite(detail(), { revision: 'rev-1' }, 2)).toEqual({
			action: 'answer',
			id: 'abc123',
			text: 'Hold',
			revision: 'rev-1',
			option: 2
		});
	});

	it('refuses an unreviewed or changed item and an unknown number', () => {
		expect(optionWrite(detail(), null, 1)).toBeNull();
		expect(optionWrite(detail(), { revision: 'old' }, 1)).toBeNull();
		expect(optionWrite(detail(), { revision: 'rev-1' }, 9)).toBeNull();
	});
});

describe('phone replica reads and writes', () => {
	const row = { state: 'open', at: null, question: 'Deploy now?', confirm: 'deploy', options };

	it('parses options and the confirm kind, and drops unusable ones', () => {
		const parsed = parseDetail({
			item: detail().header,
			notes: [],
			runs: [],
			flag: row,
			attentionRevision: 'r'
		});
		expect(parsed?.flag?.confirm).toBe('deploy');
		expect(parsed?.flag?.options).toHaveLength(3);
		const one = parseDetail({
			item: detail().header,
			notes: [],
			runs: [],
			flag: { ...row, options: [options[0]], confirm: 'launch' }
		});
		expect(one?.flag?.options).toBeUndefined();
		expect(one?.flag?.confirm).toBeUndefined();
	});

	it('sends the option number with the answer through the native tool', async () => {
		const call = vi.fn(async () => ({
			source: 'local_tracker',
			lastSyncedAt: null,
			freshness: 'current',
			partial: false,
			data: { intentId: 'i1', status: 'queued' }
		}));
		const tools = { schemas: [], call, refresh: async () => {} } as unknown as PhoneTrackerTools;
		const write = optionWrite(detail(), { revision: 'rev-1' }, 2)!;
		const reply = await phoneTrackerInboxSource(tools).write(write);
		expect(reply.value).toEqual({ intentId: 'i1', status: 'queued' });
		expect(call).toHaveBeenCalledWith('tracker_answer', {
			id: 'abc123',
			text: 'Hold',
			revision: 'rev-1',
			option: 2
		});
	});
});
