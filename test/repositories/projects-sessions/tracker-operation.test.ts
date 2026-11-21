import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import {
	TrackerOperationRepository,
	type TrackerOperation
} from '../../../src/repositories/projects-sessions/TrackerOperationRepository';

let database: DatabaseSync;
let journal: TrackerOperationRepository;

beforeEach(() => {
	database = new DatabaseSync(':memory:');
	database.exec(`
		CREATE TABLE items(
			id TEXT PRIMARY KEY, title TEXT, status TEXT, needs_daniel INTEGER DEFAULT 0,
			updated_at TEXT, clocks TEXT NOT NULL DEFAULT '{}'
		);
		CREATE TABLE item_notes(
			item_id TEXT NOT NULL, hlc TEXT NOT NULL, node TEXT, text TEXT NOT NULL,
			PRIMARY KEY(item_id, hlc)
		);
		CREATE TABLE ops(
			seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT NOT NULL UNIQUE,
			item_id TEXT NOT NULL, fields TEXT NOT NULL, hlc TEXT NOT NULL, node TEXT NOT NULL,
			received_at INTEGER, actor TEXT
		);
		CREATE TABLE fixture_claims (id TEXT PRIMARY KEY);
	`);
	journal = new TrackerOperationRepository(database, () => 2500);
});

afterEach(() => database.close());

function operation(ms: number, node: string, fields: TrackerOperation['fields']): TrackerOperation {
	const hlc = `${String(ms).padStart(15, '0')}-000000-${node}`;
	return { op_id: hlc, item_id: 'fixture-item', fields, hlc, node };
}

test('applyOps merges fields and ordered notes across a reconnect', () => {
	const newest = operation(2000, 'beta', { title: 'Newer', 'note+': 'Second' });
	const older = operation(1000, 'alpha', {
		title: 'Older',
		status: 'blocked',
		needs_daniel: true,
		future_field: { retained: true },
		'note+': 'First'
	});
	older.actor = ' fixture-actor ';
	expect(journal.applyOps([newest, older, newest])).toEqual({
		operations: [newest, older],
		itemIds: ['fixture-item']
	});
	expect(database.prepare('SELECT * FROM items').get()).toEqual({
		id: 'fixture-item',
		title: 'Newer',
		status: 'blocked',
		needs_daniel: 1,
		updated_at: new Date(2000).toISOString(),
		clocks: JSON.stringify({
			title: newest.hlc,
			notes_log: newest.hlc,
			status: older.hlc,
			needs_daniel: older.hlc
		})
	});
	expect(database.prepare('SELECT node, text FROM item_notes ORDER BY hlc').all()).toEqual([
		{ node: 'alpha', text: 'First' },
		{ node: 'beta', text: 'Second' }
	]);
	expect(
		database.prepare('SELECT fields, actor, received_at FROM ops WHERE op_id=?').get(older.op_id)
	).toEqual({
		fields: JSON.stringify(older.fields),
		actor: 'fixture-actor',
		received_at: 2500
	});
	expect(journal.applyOps([older, newest])).toEqual({ operations: [], itemIds: [] });
	expect(database.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'ops'").get()).toEqual({
		seq: 2
	});
});

test('applyOps orders same-time changes by node and leaves note history intact', () => {
	const beta = operation(1000, 'beta', { title: 'Beta', 'note+': 'Beta' });
	const alpha = operation(1000, 'alpha', { title: 'Alpha', 'note+': 'Alpha' });
	journal.applyOps([beta, alpha]);
	expect(database.prepare('SELECT title FROM items').get()).toEqual({ title: 'Beta' });
	expect(database.prepare('SELECT text FROM item_notes ORDER BY hlc').all()).toEqual([
		{ text: 'Alpha' },
		{ text: 'Beta' }
	]);
});

test('applyOps rolls back an incomplete batch and any coupled receipt', () => {
	const first = operation(1000, 'alpha', { title: 'First', 'note+': 'First' });
	const broken = operation(2000, 'alpha', { title: { invalid: 'not a scalar' } });
	expect(() => journal.applyOps([first, broken])).toThrow();
	expect(() =>
		journal.applyOps([first], () => {
			database.exec("INSERT INTO fixture_claims VALUES ('source-record')");
			throw new Error('receipt refused');
		})
	).toThrow('receipt refused');
	for (const table of ['ops', 'items', 'item_notes', 'fixture_claims']) {
		expect(database.prepare(`SELECT count(*) AS total FROM ${table}`).get()).toEqual({ total: 0 });
	}
	expect(
		journal.applyOps([first], () => {
			database.exec("INSERT INTO fixture_claims VALUES ('source-record')");
		}).itemIds
	).toEqual(['fixture-item']);
	expect(database.prepare('SELECT id FROM fixture_claims').get()).toEqual({ id: 'source-record' });
});
