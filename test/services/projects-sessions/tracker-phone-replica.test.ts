import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../../support/measureWorkload';

import { hub, phoneWrite, updatedAt } from './trackerPhoneFixture';

function checkSnapshot(first: unknown) {
	expect(first).toMatchObject({
		kind: 'snapshot',
		snapshotId: expect.any(String),
		cursor: expect.any(String),
		continuation: null,
		hubTime: updatedAt,
		partial: true,
		rows: [
			{
				id: 'fixture001',
				title: 'Review task',
				project: 'harness',
				status: 'open',
				stage: 'idea',
				updatedAt,
				dueAt: null,
				notes: [{ id: expect.any(String), author: 'fixture', at: updatedAt, text: '[redacted]' }],
				flag: null,
				runs: [
					{
						id: '7',
						origin: 'fixture',
						state: 'running',
						outcome: null,
						queuedAt: 1,
						startedAt: 2,
						endedAt: null
					}
				]
			}
		]
	});
}

test('bootstraps a redacted snapshot and sends a replayable delta for a run without an item edit', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', {
			title: 'Review task',
			status: 'open',
			agent: 'harness',
			needs_daniel: true,
			question: 'Review this',
			'note+': 'api_key=synthetic-example-secret'
		});
		fixture.item('fixture002', { title: 'Private item', status: 'open', sensitive: true });
		fixture.db.exec(`
			CREATE TABLE runs(id INTEGER, item_id TEXT, state TEXT, outcome TEXT,
				queued_at INTEGER, started_at INTEGER, ended_at INTEGER, session_id TEXT);
			INSERT INTO runs VALUES (7, 'fixture001', 'running', NULL, 1, 2, NULL, 'host-only');
		`);
		const response = await fixture.pull();
		expect(response.status).toBe(200);
		const first = await response.json();
		checkSnapshot(first);
		expect(JSON.stringify(first)).not.toMatch(
			/Private item|synthetic-example|host-only|Review this/
		);
		const choices = [{ label: 'Use existing', recommended: true }, { label: 'Start fresh' }];
		expect(
			(await fixture.release('fixture001', { question: 'Review this', options: choices })).status
		).toBe(200);
		const release = await (await fixture.pull('&cursor=' + first.cursor)).json();
		expect(release.operations).toMatchObject([
			{
				id: 'fixture001',
				row: { flag: { state: 'open', at: updatedAt, question: 'Review this', options: choices } }
			}
		]);
		fixture.db.exec("UPDATE runs SET state = 'finished', outcome = 'done', ended_at = 3");
		const request = '&cursor=' + release.cursor;
		const delta = await (await fixture.pull(request)).json();
		expect(delta).toMatchObject({
			kind: 'delta',
			requestCursor: release.cursor,
			cursor: expect.any(String),
			hasMore: false,
			operations: [
				{ id: 'fixture001', row: { runs: [{ state: 'finished', outcome: 'done', endedAt: 3 }] } }
			]
		});
		fixture.restart();
		expect(await (await fixture.pull(request)).json()).toEqual(delta);
		const planningCursor = await checkPlanningDelta(fixture, delta.cursor);
		fixture.item('fixture001', { deleted: true });
		const removed = await (await fixture.pull('&cursor=' + planningCursor)).json();
		expect(removed.operations).toEqual([{ id: 'fixture001', row: null }]);
		const caughtUp = await (await fixture.pull('&cursor=' + removed.cursor)).json();
		expect(caughtUp).toMatchObject({ operations: [], cursor: removed.cursor, hasMore: false });
	} finally {
		fixture.db.close();
	}
});

async function checkPlanningDelta(fixture: ReturnType<typeof hub>, cursor: string) {
	fixture.item('fixture001', {
		planning_artifact_detail: '{"summary":"Designs are ready"}',
		planning_promotion_detail: JSON.stringify({ by: 'Fixture Planner', at: updatedAt })
	});
	const changed = await (await fixture.pull('&cursor=' + cursor)).json();
	expect(changed.operations).toMatchObject([
		{
			id: 'fixture001',
			row: {
				stage: 'detail',
				planning: {
					artifacts: { detail: { summary: 'Designs are ready' } },
					promotions: [{ stage: 'detail', by: 'Fixture Planner', at: updatedAt }]
				}
			}
		}
	]);
	return changed.cursor as string;
}

test('rejects another scope cursor, malformed scope and replica reads from a spoke', async () => {
	const central = hub();
	const spoke = hub('spoke');
	try {
		const snapshot = await (await central.pull()).json();
		expect(snapshot).toMatchObject({ kind: 'snapshot', rows: [], cursor: expect.any(String) });
		const url = 'http://localhost/phone-replica/v1?scope=';
		const other = await central
			.restart()
			.items.handle(new Request(url + 'b'.repeat(64) + '&cursor=' + snapshot.cursor));
		expect(await other.json()).toEqual({ kind: 'reset', reason: 'cursor' });
		const invalid = await central.restart().items.handle(new Request(url + 'invalid'));
		expect(invalid.status).toBe(400);
		expect((await spoke.pull()).status).toBe(404);
	} finally {
		central.db.close();
		spoke.db.close();
	}
});

test('pages a fixed snapshot and discards it if an item is withdrawn', async () => {
	const fixture = hub();
	try {
		for (let index = 0; index < 110; index++) {
			const itemId = 'fixture' + String(index).padStart(3, '0');
			fixture.item(itemId, { title: 'Fixture item ' + index, status: 'open' });
		}
		const first = await (await fixture.pull()).json();
		expect(first.rows).toHaveLength(100);
		expect(first.cursor).toBeNull();
		expect(first.continuation).toEqual(expect.any(String));
		fixture.item('fixture100', { status: 'done' });
		const final = await (await fixture.pull('&continuation=' + first.continuation)).json();
		expect(final.rows).toHaveLength(10);
		expect(final.rows[0]).toMatchObject({ id: 'fixture100', status: 'open' });
		expect(final.snapshotId).toBe(first.snapshotId);
		const changed = await (await fixture.pull('&cursor=' + final.cursor)).json();
		expect(changed.operations).toMatchObject([{ id: 'fixture100', row: { status: 'done' } }]);
		fixture.item('fixture105', { sensitive: true });
		expect(await (await fixture.pull('&continuation=' + first.continuation)).json()).toEqual({
			kind: 'reset',
			reason: 'snapshot'
		});
	} finally {
		fixture.db.close();
	}
});

const intentId = (position: number) => '00000000-0000-4000-8000-00000000000' + position;

test('commits scoped phone notes and answers with durable receipts and flag comparisons', () =>
	measureWorkload('service.projects-sessions-tracker-phone-replica', 'queued-writes', async () => {
		const fixture = hub();
		try {
			fixture.item('fixture001', { title: 'Review task', status: 'open' });
			const note = { intentId: intentId(1), action: 'note', text: 'From the phone' };
			expect((await fixture.write(note, '')).status).toBe(403);
			expect((await fixture.write(note, phoneWrite.token, 'other-phone')).status).toBe(403);
			const saved = { intentId: note.intentId, status: 'accepted' };
			expect(await (await fixture.write(note)).json()).toEqual(saved);
			fixture.restart();
			expect(await (await fixture.write(note)).json()).toEqual(saved);
			const before = await (await fixture.pull()).json();
			expect(before.rows[0].notes).toMatchObject([{ text: note.text }]);
			const flag = {
				intentId: intentId(2),
				action: 'flag',
				text: 'First question',
				revision: before.rows[0].attentionRevision
			};
			expect(await (await fixture.write(flag)).json()).toMatchObject({ status: 'accepted' });
			const flagged = await (await fixture.pull('&cursor=' + before.cursor)).json();
			const answer = {
				intentId: intentId(3),
				action: 'answer',
				text: 'An answer',
				revision: flagged.operations[0].row.attentionRevision
			};
			fixture.item(
				'fixture001',
				{ needs_daniel: 1, resolved: 0, question: 'New question' },
				'Chief of Staff'
			);
			expect(await (await fixture.write(answer)).json()).toMatchObject({
				status: 'conflict',
				reason: 'attention'
			});
			const current = await (await fixture.pull()).json();
			expect(current.rows[0].flag).toMatchObject({ state: 'open', question: 'New question' });
			expect(
				await (
					await fixture.write({
						...answer,
						intentId: intentId(4),
						revision: current.rows[0].attentionRevision
					})
				).json()
			).toMatchObject({ status: 'accepted' });
			const resolved = await (await fixture.pull()).json();
			expect(resolved.rows[0].flag).toMatchObject({ state: 'resolved', question: 'New question' });
		} finally {
			fixture.db.close();
		}
	}));
