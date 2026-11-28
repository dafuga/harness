import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRecurringRepository } from '../../../src/repositories/projects-sessions/TrackerRecurringRepository';
import { TrackerRunReadRepository } from '../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

let database: DatabaseSync;
let store: TrackerPersistenceService;
let api: TrackerLocalApiService;
let now: number;

beforeEach(() => {
	now = Date.UTC(2026, 10, 21, 12);
	database = new DatabaseSync(':memory:');
	store = new TrackerPersistenceService(database, 'fixture-mac', { now: () => now });
	const recurring = new TrackerRecurringRepository(store);
	api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
		now: () => now,
		planLaunch: (fields) => fields,
		runs: new TrackerRunReadRepository(database, store.node),
		recurring: { role: 'hub', history: (id, limit) => recurring.history(id, limit) }
	});
});

afterEach(() => database.close());

function request(path: string, method = 'GET', payload?: object | string, actor = 'fixture-actor') {
	return api.handle(
		new Request(`http://127.0.0.1:7700${path}`, {
			method,
			headers: { 'x-tracker-as': actor },
			body: typeof payload === 'string' ? payload : JSON.stringify(payload)
		})
	);
}

async function expectOlderActiveRun(id: string) {
	database.prepare("INSERT INTO runs VALUES (2, ?, 50, 'running', 'sol', NULL, NULL)").run(id);
	const recent = await request('/runs?limit=1');
	expect(await recent.json()).toMatchObject([{ id: 1, node: 'fixture-peer' }]);
	const withActive = await request('/runs?limit=1&include_active=1');
	expect(await withActive.json()).toMatchObject([
		{ id: 1, node: 'fixture-peer' },
		{ id: 2, node: 'fixture-mac' }
	]);
}

test('reports persisted run history and selects a model through the native item API', async () => {
	const { id } = await (
		await request('/items', 'POST', { title: 'Fixture model selection' })
	).json();
	database.exec(`
		CREATE TABLE runs(id INTEGER, item_id TEXT, queued_at INTEGER, state TEXT, rung TEXT, outcome TEXT, ended_at INTEGER);
		CREATE TABLE remote_runs(node TEXT, id INTEGER, item_id TEXT, queued_at INTEGER,
			state TEXT, rung TEXT, outcome TEXT, ended_at INTEGER);
	`);
	database.prepare("INSERT INTO runs VALUES (1, ?, 100, 'finished', 'sol', 'done', 300)").run(id);
	database
		.prepare(
			"INSERT INTO remote_runs VALUES ('fixture-peer', 1, ?, 200, 'finished', 'sol', 'blocked', 400)"
		)
		.run(id);
	const occurrence = '2026-11-21T12:00:00.000Z';
	database
		.prepare(
			"INSERT INTO occurrences(item_id, occurrence, status, fired_at) VALUES (?, ?, 'pending', ?)"
		)
		.run(id, occurrence, Date.parse(occurrence));
	const history = await request(`/items/${id.slice(0, 6)}/history?limit=1`);
	expect(await history.json()).toEqual([
		{ occurrence, status: 'pending', fired_at: occurrence, result_at: null, note: null, by: null }
	]);
	const runs = await request(`/runs?item=${id.slice(0, 6)}`);
	expect(await runs.json()).toMatchObject([
		{ id: 1, node: 'fixture-mac' },
		{ id: 1, node: 'fixture-peer' }
	]);
	await expectOlderActiveRun(id);
	const report = await request('/models/report');
	expect(await report.json()).toMatchObject({
		ladder: ['haiku', 'sonnet', 'terra', 'sol', 'opus'],
		rows: expect.arrayContaining([
			expect.objectContaining({ rung: 'sol', kind: '*', runs: 2, done: 1, blocked: 1 })
		])
	});
	// Codex resets 27 Nov 2026 10:39 Lisbon: Claude only before, the Sol default after.
	for (const [at, rung, cli] of [
		['2026-11-27T10:38:59Z', 'sonnet', 'claude'],
		['2026-11-27T10:39:00Z', 'sol', 'codex']
	]) {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(Date.parse(at));
		const pick = await request(`/items/${id.slice(0, 6)}/pick`);
		vi.useRealTimers();
		expect(await pick.json()).toMatchObject({ item_id: id, rung, cli, auto: false });
	}
	expect(store.maxSeq()).toBe(1);
});
