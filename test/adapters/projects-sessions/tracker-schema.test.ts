import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { TrackerSchemaAdapter } from '../../../src/adapters/projects-sessions/TrackerSchemaAdapter';

let database: DatabaseSync;
let schema: TrackerSchemaAdapter;
const early = '000000000001000-000000-alpha';
const later = '000000000002000-000000-beta';

beforeEach(() => {
	database = new DatabaseSync(':memory:');
	schema = new TrackerSchemaAdapter(database, {
		now: () => 2600,
		databaseId: () => 'fixture-db-id'
	});
});

afterEach(() => database.close());

test('initialize creates compatible tables and keeps the database identity on repeat', () => {
	expect(schema.initialize()).toEqual({ createdAt: 2600, dbId: 'fixture-db-id' });
	const tables = database
		.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
		.all();
	expect(tables.map(({ name }) => name)).toEqual([
		'agents',
		'deliveries',
		'item_notes',
		'items',
		'meta',
		'ops',
		'reminders',
		'sqlite_sequence'
	]);
	expect(schema.initialize()).toEqual({ createdAt: 2600, dbId: 'fixture-db-id' });
});

test('initialize upgrades an older store and replays only newly supported item fields', () => {
	seedOlderStore();
	seedOp('a', early, JSON.stringify({ title: 'Already projected title', repo: '/first' }));
	seedOp('b', later, JSON.stringify({ repo: '/second', adapter_closed: true, schedule_never: 1 }));
	expect(schema.initialize()).toEqual({ createdAt: 800, dbId: 'legacy-db-id' });
	expect(
		database
			.prepare('SELECT title, repo, adapter_closed, schedule_never, clocks, updated_at FROM items')
			.get()
	).toEqual({
		title: 'Original row title',
		repo: '/second',
		adapter_closed: '1',
		schedule_never: '1',
		clocks: JSON.stringify({
			title: early,
			repo: later,
			adapter_closed: later,
			schedule_never: later
		}),
		updated_at: 'stored-original-timestamp'
	});
	expect(database.prepare('SELECT op_id, actor FROM ops ORDER BY seq').all()).toEqual([
		{ op_id: 'a', actor: null },
		{ op_id: 'b', actor: null }
	]);
	expect(database.prepare("SELECT v FROM meta WHERE k='pushed_seq'").get()).toEqual({ v: '1' });
});

test('initialize restores the previous schema if operation replay fails', () => {
	seedOlderStore();
	seedOp('broken', later, '{invalid fixture');
	expect(() => schema.initialize()).toThrow();
	const names = database
		.prepare('PRAGMA table_info(ops)')
		.all()
		.map(({ name }) => name);
	expect(names).not.toContain('actor');
	expect(database.prepare("SELECT v FROM meta WHERE k='db_id'").get()).toEqual({
		v: 'legacy-db-id'
	});
	expect(database.prepare('SELECT op_id, fields FROM ops').get()).toEqual({
		op_id: 'broken',
		fields: '{invalid fixture'
	});
});

test('sync metadata preserves independent cursors across initialization', () => {
	schema.initialize();
	expect(schema.getMeta('pushed_seq')).toBeNull();
	schema.setMeta('pushed_seq', 14);
	schema.setMeta('peer_pushed_seq', '7');
	schema.setMeta('pushed_seq', 17);
	expect(schema.initialize()).toEqual({ createdAt: 2600, dbId: 'fixture-db-id' });
	expect(schema.getMeta('pushed_seq')).toBe('17');
	expect(schema.getMeta('peer_pushed_seq')).toBe('7');
});

function seedOlderStore(): void {
	database.exec(`
		CREATE TABLE items(id TEXT PRIMARY KEY, title TEXT, status TEXT, deleted INTEGER, updated_at TEXT, clocks TEXT);
		CREATE TABLE ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT UNIQUE, item_id TEXT, fields TEXT, hlc TEXT, node TEXT, received_at INTEGER);
		CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT);
		INSERT INTO meta VALUES ('db_id', 'legacy-db-id'), ('created_at', '800'), ('pushed_seq', '1');
	`);
	database
		.prepare(
			"INSERT INTO items VALUES ('f', 'Original row title', 'open', 0, 'stored-original-timestamp', ?)"
		)
		.run(JSON.stringify({ title: early }));
}

function seedOp(id: string, hlc: string, fields: string): void {
	database
		.prepare("INSERT INTO ops(op_id, item_id, fields, hlc, node) VALUES (?, 'f', ?, ?, 'fixture')")
		.run(id, fields, hlc);
}
