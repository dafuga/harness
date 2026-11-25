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
	const inbox = fixture.repository.blockers(NOW);
	expect(inbox).toMatchObject({ total: 4, unescalated: 1, stale: 1 });
});
