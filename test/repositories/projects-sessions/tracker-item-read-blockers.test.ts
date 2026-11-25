import { afterEach, beforeEach, expect, test } from 'vitest';
import { insertItem, NOW, trackerReadFixture } from './trackerItemReadFixture';

let fixture: ReturnType<typeof trackerReadFixture>;
const HOUR = 3_600_000;

function clock(msAgo: number): string {
	return `${String(NOW - msAgo).padStart(15, '0')}-000000-fixture`;
}

beforeEach(() => {
	fixture = trackerReadFixture();
	const { database } = fixture;
	database.exec("DELETE FROM items WHERE status = 'blocked' OR needs_daniel = 1");
	insertItem(database, {
		id: 'blk001',
		title: 'Slack QA assistant',
		status: 'blocked',
		owner: 'BuildFlexity: Slack QA',
		agent: 'buildflexity',
		blocked_reason: 'GitHub credential with Issues write is absent',
		clocks: JSON.stringify({ status: clock(30 * HOUR) })
	});
	insertItem(database, {
		id: 'blk002',
		title: 'Slack QA duplicate',
		status: 'blocked',
		agent: 'buildflexity',
		blocked_reason: 'github credential with issues write is absent!',
		clocks: JSON.stringify({ status: clock(2 * HOUR) })
	});
	insertItem(database, {
		id: 'blk003',
		title: 'Sync server',
		status: 'blocked',
		owner: 'sync worker',
		parent: 'fx4c15',
		blocked_reason: 'unit tests fail in the workers runtime',
		needs_daniel: 0,
		clocks: JSON.stringify({ status: clock(HOUR) })
	});
	insertItem(database, {
		id: 'blk004',
		title: 'Depends on sync',
		status: 'blocked',
		blocked_reason: 'waiting on done01 to land',
		clocks: JSON.stringify({ status: clock(HOUR) })
	});
	insertItem(database, { id: 'done01', title: 'Landed', status: 'done' });
	insertItem(database, {
		id: 'ask001',
		title: 'Pick a design',
		needs_daniel: 1,
		question: 'Which option should we pick?',
		clocks: JSON.stringify({ needs_daniel: clock(5 * HOUR) })
	});
});

function seedBlockerNotes() {
	const { database } = fixture;
	const note = database.prepare('INSERT INTO item_notes (item_id, hlc, text) VALUES (?, ?, ?)');
	insertItem(database, { id: 'new001', title: 'Note-only credential', status: 'in_progress' });
	note.run('new001', clock(2 * HOUR), 'BLOCKED: missing credential for the sandbox');
	note.run('new001', clock(HOUR), 'watchdog launch-queue-stuck: launch has been queued');
	insertItem(database, {
		id: 'new002',
		title: 'Legacy note-only wait',
		status: 'in_progress',
		notes: 'Awaits approval from Daniel'
	});
	insertItem(database, { id: 'new003', title: 'Recovered', status: 'in_progress' });
	note.run('new003', clock(HOUR), 'BLOCKED: missing credential');
	note.run('new003', clock(0), 'Access restored and work resumed');
	insertItem(database, {
		id: 'new004',
		title: 'Already flagged',
		status: 'in_progress',
		needs_daniel: 1,
		question: 'Which option should we pick?',
		notes: 'BLOCKED: cannot run tests'
	});
	insertItem(database, {
		id: 'new005',
		title: 'Ordinary progress',
		status: 'in_progress',
		notes: 'Fixed a test that awaits a promise'
	});
	insertItem(database, {
		id: 'new006',
		title: 'Missing access',
		status: 'in_progress',
		notes: 'Missing credential for API access'
	});
	insertItem(database, {
		id: 'new007',
		title: 'Parked',
		status: 'in_progress',
		parked_until: new Date(NOW + HOUR).toISOString(),
		notes: 'BLOCKED: waiting on a reply'
	});
}

afterEach(() => fixture.database.close());

test('types, routes, ages and groups every blocked item and Daniel ask', () => {
	const inbox = fixture.repository.blockers(NOW);
	expect(inbox.groups.map(({ type }) => type)).toEqual([
		'credential_access',
		'daniel_decision',
		'waiting_on_item',
		'technical'
	]);
	const technical = inbox.groups.find(({ type }) => type === 'technical')?.items[0];
	expect(technical).toMatchObject({ id: 'blk003', route: 'orchestrator', route_to: 'fx4c15' });
	const ask = inbox.groups[1].items[0];
	expect(ask).toMatchObject({ id: 'ask001', kind: 'flag', age_minutes: 300, escalated: true });
});

test('dedupes the same blocker under the oldest item and flags unescalated Daniel blockers', () => {
	const [credential] = fixture.repository.blockers(NOW).groups[0].items;
	expect(credential).toMatchObject({
		id: 'blk001',
		duplicates: ['blk002'],
		age_minutes: 1800,
		needs_escalation: true,
		stale: true
	});
	expect(credential.recheck).toContain('30h');
});

test('rechecks a blocker whose dependency is done', () => {
	const waiting = fixture.repository.blockers(NOW).groups[2].items[0];
	expect(waiting).toMatchObject({ id: 'blk004', waits_on: 'done01', dependency_status: 'done' });
	expect(waiting.recheck).toContain('is done');
});

test('counts what still needs escalation and what is stale', () => {
	seedBlockerNotes();
	const inbox = fixture.repository.blockers(NOW);
	const notes = inbox.groups.flatMap(({ items }) => items).filter(({ kind }) => kind === 'note');
	expect(notes.map(({ id }) => id).sort()).toEqual(['new001', 'new002', 'new006']);
	expect(notes.find(({ id }) => id === 'new001')).toMatchObject({
		action: 'BLOCKED: missing credential for the sandbox',
		type: 'credential_access',
		age_minutes: 120,
		escalated: false,
		needs_escalation: true
	});
	expect(inbox.total).toBe(7);
});
