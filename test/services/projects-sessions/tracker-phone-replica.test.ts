import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';

const now = Date.parse('2026-11-23T12:00:00.000Z');
const scope = 'a'.repeat(64);
const updatedAt = new Date(now).toISOString();

function hub(role: 'hub' | 'spoke' = 'hub') {
	const db = new DatabaseSync(':memory:');
	const runtime = () =>
		new TrackerNativeRuntimeService(db, {
			node: 'fixture',
			role,
			now: () => now,
			storage: { databaseId: () => 'fixture-db' }
		});
	let instance = runtime();
	const pull = (query = '') =>
		instance.items.handle(new Request('http://localhost/phone-replica/v1?scope=' + scope + query));
	return {
		db,
		pull,
		restart: () => (instance = runtime()),
		item: (itemId: string, fields: Parameters<typeof instance.store.appendLocal>[0]['fields']) =>
			instance.store.appendLocal({ itemId, fields, actor: 'fixture' })
	};
}

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
				updatedAt,
				dueAt: null,
				notes: [{ id: expect.any(String), author: 'fixture', at: updatedAt, text: '[redacted]' }],
				flag: { state: 'open', at: updatedAt, question: 'Review this' },
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
		expect(JSON.stringify(first)).not.toMatch(/Private item|synthetic-example|host-only/);
		fixture.db.exec("UPDATE runs SET state = 'finished', outcome = 'done', ended_at = 3");
		const request = '&cursor=' + first.cursor;
		const delta = await (await fixture.pull(request)).json();
		expect(delta).toMatchObject({
			kind: 'delta',
			requestCursor: first.cursor,
			cursor: expect.any(String),
			hasMore: false,
			operations: [
				{ id: 'fixture001', row: { runs: [{ state: 'finished', outcome: 'done', endedAt: 3 }] } }
			]
		});
		fixture.restart();
		expect(await (await fixture.pull(request)).json()).toEqual(delta);
		fixture.item('fixture001', { deleted: true });
		const removed = await (await fixture.pull('&cursor=' + delta.cursor)).json();
		expect(removed.operations).toEqual([{ id: 'fixture001', row: null }]);
		const caughtUp = await (await fixture.pull('&cursor=' + removed.cursor)).json();
		expect(caughtUp).toMatchObject({ operations: [], cursor: removed.cursor, hasMore: false });
	} finally {
		fixture.db.close();
	}
});

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
