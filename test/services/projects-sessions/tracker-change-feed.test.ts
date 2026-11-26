import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { serveTrackerChanges } from '../../../src/services/projects-sessions/tracker-change-feed/serveTrackerChanges';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

function fixture() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-feed');
	database.exec(
		`CREATE TABLE runs(id INTEGER, state TEXT, outcome TEXT, session_name TEXT, started_at INTEGER, ended_at INTEGER, eta_at INTEGER, input_tokens INTEGER)`
	);
	return { database, store };
}

async function read(store: TrackerPersistenceService, query = '', signal?: AbortSignal) {
	const request = new Request(`http://127.0.0.1/changes${query}`, { signal });
	const response = await serveTrackerChanges(request, store);
	return (await response.json()) as { cursor: string; changed: boolean };
}

const add = (store: TrackerPersistenceService, title: string) =>
	store.appendLocal({ itemId: 'fixture1', fields: { title } });

describe('tracker change feed', () => {
	it('wakes a waiting client when an item is written', async () => {
		const { store } = fixture();
		const { cursor } = await read(store);
		const waiting = read(store, `?cursor=${cursor}&wait=20`);
		const started = Date.now();
		setTimeout(() => add(store, 'first'), 20);
		const next = await waiting;
		expect(next.changed).toBe(true);
		expect(next.cursor).not.toBe(cursor);
		expect(Date.now() - started).toBeLessThan(500);
	});

	it('wakes for a run state change, which is not journaled, but not for token counts', async () => {
		const { database, store } = fixture();
		database.exec("INSERT INTO runs(id, state) VALUES (1, 'queued')");
		const { cursor } = await read(store);
		database.exec('UPDATE runs SET input_tokens = 10');
		expect((await read(store, `?cursor=${cursor}&wait=1`)).changed).toBe(false);
		const waiting = read(store, `?cursor=${cursor}&wait=20`);
		database.exec("UPDATE runs SET state = 'running'");
		expect((await waiting).changed).toBe(true);
	});

	it('answers a returning client at once for what it missed', async () => {
		const { store } = fixture();
		const { cursor } = await read(store);
		add(store, 'written while away');
		const started = Date.now();
		expect((await read(store, `?cursor=${cursor}&wait=20`)).changed).toBe(true);
		expect(Date.now() - started).toBeLessThan(200);
	});

	it('ends a wait when the caller goes away', async () => {
		const { store } = fixture();
		const { cursor } = await read(store);
		const abort = new AbortController();
		const waiting = read(store, `?cursor=${cursor}&wait=20`, abort.signal);
		setTimeout(() => abort.abort(), 20);
		expect(await waiting).toEqual({ cursor, changed: false });
	});
});
