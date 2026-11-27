// @harness-uid u_trkinbox10
import { describe, expect, it } from 'vitest';
import {
	confirmedWrite,
	countBuckets,
	filterRows,
	itemBucket,
	writeGate,
	writeView
} from '../../src/lib/development-tooling/tracker-inbox/trackerInbox';
import { overviewFailureMessage } from '../../src/lib/development-tooling/tracker-inbox/trackerInboxMessages';
import type {
	InboxDetail,
	InboxHeader,
	InboxRow,
	InboxWrite
} from '../../src/models/development-tooling/TrackerInbox.types';

const header: InboxHeader = {
	id: 'faeksfgmwp',
	title: 'Decision inbox',
	project: 'Harness',
	status: 'in_progress',
	updatedAt: null,
	dueAt: null
};

function detail(overrides: Partial<InboxDetail> = {}): InboxDetail {
	return {
		header,
		notes: [],
		flag: { state: 'open', at: null, question: 'Approve the merge?' },
		runs: [],
		revision: 'rev-1',
		...overrides
	};
}

describe('itemBucket', () => {
	it('puts an open flag in Needs you ahead of every status', () => {
		expect(itemBucket('blocked', true)).toBe('needs-you');
		expect(itemBucket('done', true)).toBe('needs-you');
	});

	it('maps statuses to the remaining buckets', () => {
		expect(itemBucket('blocked', false)).toBe('blocked');
		expect(itemBucket('in_progress', false)).toBe('active');
		expect(itemBucket('done', false)).toBe('done');
		expect(itemBucket('ignored', false)).toBe('done');
		expect(itemBucket('open', false)).toBe('quiet');
	});
});

describe('filterRows and countBuckets', () => {
	const rows: InboxRow[] = [
		{ header: { ...header, id: 'a' }, bucket: 'needs-you' },
		{ header: { ...header, id: 'b' }, bucket: 'active' },
		{ header: { ...header, id: 'c' }, bucket: 'needs-you' }
	];

	it('counts every bucket and the total', () => {
		expect(countBuckets(rows)).toEqual({
			all: 3,
			'needs-you': 2,
			blocked: 0,
			active: 1,
			quiet: 0,
			done: 0,
			reminders: 0
		});
	});

	it('keeps source order and filters by bucket', () => {
		expect(filterRows(rows, 'needs-you').map((row) => row.header.id)).toEqual(['a', 'c']);
		expect(filterRows(rows, 'all')).toHaveLength(3);
	});
});

describe('overviewFailureMessage', () => {
	it('says why the list could not be read on each surface', () => {
		const unlinked = 'No Tracker copy is on this phone yet. Connect to your computer to sync it.';
		expect(overviewFailureMessage('denied', 'mac')).toBe(
			'Tracker could not be reached on this Mac.'
		);
		expect(overviewFailureMessage('denied', 'phone')).toBe(unlinked);
		expect(overviewFailureMessage('noReplica', 'phone')).toBe(unlinked);
		expect(overviewFailureMessage(undefined, 'phone')).toBe(
			'The Tracker copy on this phone could not be read.'
		);
	});
});

describe('writeView', () => {
	const base = { intentId: 'i1', itemId: 'faeksfgmwp' };
	const entry = (over: Partial<InboxWrite>): InboxWrite => ({
		...base,
		status: 'queued',
		reason: '',
		...over
	});

	it('shows a queued write as pending and an accepted one as acknowledged', () => {
		expect(writeView(entry({})).state).toBe('pending');
		expect(writeView(entry({ status: 'accepted' })).state).toBe('acknowledged');
	});

	it('marks a changed flag as a conflict that needs a fresh review', () => {
		const view = writeView(entry({ status: 'conflict', reason: 'attention' }));
		expect(view.state).toBe('conflict');
		expect(view.discardable).toBe(true);
		expect(view.label).toContain('Review it again');
	});

	it('marks other refusals as rejected and says when the item is gone', () => {
		expect(writeView(entry({ status: 'conflict', reason: 'duplicate' })).state).toBe('rejected');
		const gone = writeView(entry({ status: 'conflict', reason: 'item' }));
		expect(gone.state).toBe('rejected');
		expect(gone.label).toContain('no longer on this phone');
	});
});

describe('writeGate', () => {
	const reviewed = { revision: 'rev-1' };

	it('lets a note through without a review', () => {
		expect(writeGate('note', detail(), null)).toEqual({ allowed: true });
	});

	it('requires a review before a flag or answer', () => {
		expect(writeGate('answer', detail(), null)).toEqual({ allowed: false, reason: 'unreviewed' });
		expect(writeGate('flag', detail({ flag: null }), null)).toEqual({
			allowed: false,
			reason: 'unreviewed'
		});
	});

	it('blocks an answer when the flag changed after the review', () => {
		expect(writeGate('answer', detail({ revision: 'rev-2' }), reviewed)).toEqual({
			allowed: false,
			reason: 'changed'
		});
	});

	it('blocks an answer to a flag that is already answered', () => {
		const answered = detail({ flag: { state: 'answered', at: null, question: 'Q' } });
		expect(writeGate('answer', answered, reviewed)).toEqual({ allowed: false, reason: 'answered' });
	});

	it('refuses an answer with no flag and a flag on an item that already has one open', () => {
		expect(writeGate('answer', detail({ flag: null }), reviewed)).toEqual({
			allowed: false,
			reason: 'no-flag'
		});
		expect(writeGate('flag', detail(), reviewed)).toEqual({
			allowed: false,
			reason: 'already-open'
		});
	});

	it('allows a flag or answer only on the revision the user reviewed', () => {
		expect(writeGate('answer', detail(), reviewed)).toEqual({ allowed: true });
		expect(writeGate('flag', detail({ flag: null }), reviewed)).toEqual({ allowed: true });
	});
});

describe('confirmedWrite', () => {
	const draft = { action: 'answer' as const, id: 'faeksfgmwp', text: '  Yes  ', revision: 'rev-1' };

	it('builds nothing without an explicit confirmation', () => {
		expect(confirmedWrite(draft, false)).toBeNull();
	});

	it('trims the text and carries the reviewed revision for a flag or answer', () => {
		expect(confirmedWrite(draft, true)).toEqual({
			action: 'answer',
			id: 'faeksfgmwp',
			text: 'Yes',
			revision: 'rev-1'
		});
	});

	it('drops the revision for a note and refuses empty or oversized text', () => {
		expect(confirmedWrite({ ...draft, action: 'note' }, true)?.revision).toBeNull();
		expect(confirmedWrite({ ...draft, text: '   ' }, true)).toBeNull();
		expect(confirmedWrite({ ...draft, text: 'é'.repeat(257) }, true)).toBeNull();
		expect(confirmedWrite({ ...draft, text: 'é'.repeat(256) }, true)).not.toBeNull();
	});
});
