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
	store = new TrackerPersistenceService(database, 'fixture-mac', {
		now: () => now
	});
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

test('commits item and notes under the actor, serves the overview feed and returns tombstones', async () => {
	const created = await request('/items', 'POST', {
		title: 'Fixture bridge rollout',
		due: 'today',
		auto: true
	});
	expect(created.status).toBe(201);
	const { id, auto } = await created.json();
	expect(id).toMatch(/^[0-9a-z]{10}$/);
	expect(auto).toMatch(/^fixture-mac@2026-11-21T12:00:00(?:\.000)?Z#[0-9a-z-]+$/);
	const prefix = id.slice(0, 6);
	const noted = await request(`/items/${prefix}/progress`, 'POST', { text: 'Synthetic note' });
	expect(noted.status).toBe(200);
	expect(await noted.json()).toMatchObject({
		title: 'Fixture bridge rollout',
		status: 'in_progress',
		notes_log: [{ node: 'fixture-mac', text: 'Synthetic note' }]
	});
	expect(store.opsSince(0, 10).map((op) => op.actor)).toEqual(['fixture-actor', 'fixture-actor']);
	const overview = await request('/items?status=all&limit=-1');
	expect(await overview.json()).toMatchObject([{ id, status: 'in_progress' }]);
	const priority = await request('/items/' + id + '/priority', 'POST', { priority: 'urgent' });
	expect(await priority.json()).toMatchObject({ priority: 'urgent' });
	expect(await (await request('/items')).json()).toMatchObject([{ priority: 'urgent' }]);
	const digest = await request('/digest?format=text');
	expect(digest.headers.get('content-type')).toBe('text/plain; charset=utf-8');
	expect(await digest.text()).toMatch(/Fixture bridge rollout.*priority urgent/);
	const firstChase = await request(`/items/${prefix}/chase`, 'POST', { note: 'Asked for status' });
	expect(firstChase.status).toBe(200);
	expect(await firstChase.json()).toMatchObject({
		id,
		chased_count: 1,
		chased_by: 'fixture-actor',
		chased_reason: 'Asked for status'
	});
	await request(`/items/${prefix}/chase`, 'POST');
	await request(`/items/${prefix}/done`, 'POST');
	expect(await (await request('/items?chased=1')).json()).toMatchObject([
		{ id, status: 'done', chased_count: 2, chased_at: '2026-11-21T12:00:00.000Z' }
	]);
	expect(await (await request('/digest?format=text')).text()).toContain('Chased (7d) (1)');
	const removed = await request(`/items/${prefix}`, 'DELETE');
	expect(removed.status).toBe(200);
	expect(await removed.json()).toMatchObject({ id, deleted: true });
	expect((await request(`/items/${prefix}`)).status).toBe(404);
});

test('rejects duplicate and malformed inputs without changing the journal', async () => {
	const { id } = await (
		await request('/items', 'POST', { title: 'Unique fixture handoff' })
	).json();
	const duplicate = await request('/items', 'POST', { title: 'Unique fixture handoff' });
	expect(duplicate.status).toBe(409);
	expect(await duplicate.json()).toMatchObject({ code: 'open_duplicate', matches: [{ id }] });
	const check = await request('/check?text=Unique+fixture+handoff');
	expect(await check.json()).toMatchObject({ ignored: [], open: [{ id }] });
	const malformed = await request(`/items/${id}`, 'PATCH', '{');
	expect(malformed.status).toBe(400);
	expect(await malformed.json()).toEqual({ error: 'invalid JSON body' });
	expect((await request(`/items/${id}/launch`, 'POST')).status).toBe(404);
	expect(store.maxSeq()).toBe(1);
});

test('blocks, unblocks and reopens an item with durable notes', async () => {
	const { id } = await (
		await request('/items', 'POST', { title: 'Synthetic bridge review' })
	).json();
	const mark = (verb: string, body?: object) => request(`/items/${id}/${verb}`, 'POST', body);
	expect((await mark('unblock')).status).toBe(409);
	expect(await (await mark('block', { reason: 'Waiting for fixture' })).json()).toMatchObject({
		status: 'blocked',
		needs_daniel: false
	});
	await mark('flag', { question: 'Which fixture?' });
	expect(await (await mark('unblock', { note: 'Available' })).json()).toMatchObject({
		status: 'in_progress',
		needs_daniel: true,
		notes_log: [{ text: 'blocked: Waiting for fixture' }, { text: 'unblocked: Available' }]
	});
	expect((await mark('done')).status).toBe(409);
	expect(await (await mark('done', { force: true })).json()).toMatchObject({
		status: 'done',
		needs_daniel: true
	});
	expect(await (await mark('unflag')).json()).toMatchObject({ needs_daniel: false });
	expect(await (await mark('reopen')).json()).toMatchObject({ status: 'open' });
	await verifyProjectFollowUp();
});

async function verifyProjectFollowUp() {
	const project = await request('/items', 'POST', {
		title: 'Elan proposal ready for review',
		project: 'elan',
		next_step: 'Choose the pilot scope'
	});
	expect(project.status).toBe(201);
	const idea = await project.json();
	expect(idea).toMatchObject({ next_step: 'Choose the pilot scope', needs_daniel: true });
	const followUp = (verb: string, body?: object, actor?: string) =>
		request(`/items/${idea.id}/${verb}`, 'POST', body, actor);
	expect(
		await (await followUp('done', { next_step: 'Approve the pilot scope' })).json()
	).toMatchObject({ status: 'done', needs_daniel: true, next_step: 'Approve the pilot scope' });
	expect(await (await request('/check?text=Elan+proposal+ready+for+review')).json()).toMatchObject({
		open: [{ id: idea.id, status: 'done', needs_daniel: true }]
	});
	expect(
		await (await followUp('answer', { answer: 'Discussed without deciding' })).json()
	).toMatchObject({
		next_step: 'Approve the pilot scope',
		answer: 'Discussed without deciding',
		needs_daniel: true
	});
	expect((await followUp('unflag')).status).toBe(409);
	expect((await followUp('move-on')).status).toBe(403);
	expect((await followUp('park', { until: '2026-11-22' })).status).toBe(403);
	expect((await followUp('park', { until: '2026-11-20' }, 'Daniel')).status).toBe(400);
	expect(await (await followUp('park', { until: '2026-11-22' }, 'Daniel')).json()).toMatchObject({
		status: 'done',
		needs_daniel: true
	});
	expect(await (await request('/items?flagged=1')).json()).toEqual([]);
	expect(await (await request('/digest?format=text')).text()).toContain('Parked until');
	now += 24 * 60 * 60 * 1000;
	expect(await (await request('/items?flagged=1')).json()).toMatchObject([{ id: idea.id }]);
	expect(await (await request('/digest')).json()).toMatchObject({
		needs_daniel: [
			{
				id: idea.id,
				project: 'elan',
				next_step: 'Approve the pilot scope',
				waiting_minutes: 1440
			}
		]
	});
	expect(await (await followUp('move-on', undefined, 'Daniel')).json()).toMatchObject({
		status: 'done',
		needs_daniel: false
	});
	expect(await (await request('/items?flagged=1')).json()).toEqual([]);
}

test('reports persisted run history and selects a model through the native item API', async () => {
	const { id } = await (
		await request('/items', 'POST', { title: 'Fixture model selection' })
	).json();
	database.exec(`
		CREATE TABLE runs(id INTEGER, item_id TEXT, queued_at INTEGER, state TEXT, rung TEXT, outcome TEXT);
		CREATE TABLE remote_runs(node TEXT, id INTEGER, item_id TEXT, queued_at INTEGER,
			state TEXT, rung TEXT, outcome TEXT);
	`);
	database.prepare("INSERT INTO runs VALUES (1, ?, 100, 'finished', 'sol', 'done')").run(id);
	database
		.prepare(
			"INSERT INTO remote_runs VALUES ('fixture-peer', 1, ?, 200, 'finished', 'sol', 'blocked')"
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
