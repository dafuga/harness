import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import {
	createSqliteAdapter,
	type SqliteAdapter
} from '../../src/adapters/development-tooling/SqliteAdapter';

const definition = {
	table: 'notes',
	fields: {
		id: { type: 'string' },
		displayName: { type: 'string' },
		enabled: { type: 'boolean' },
		payload: { type: 'json' },
		optional: { type: 'string', nullable: true }
	}
} as const;
const row = {
	id: 'first',
	displayName: "name '); DROP TABLE notes;--",
	enabled: false,
	payload: { labels: ['one'] },
	optional: null
};
let db: DatabaseSync;
let adapter: SqliteAdapter;
beforeEach(() => {
	db = new DatabaseSync(':memory:');
	adapter = createSqliteAdapter(db, [definition]);
	adapter.createTables();
});
afterEach(() => db.close());

test('the Node driver round trips string keys, snake columns, JSON, booleans and null filters', async () => {
	expect(await adapter.create('notes', row)).toEqual(row);
	expect(await adapter.find('notes', 'first')).toEqual(row);
	expect(await adapter.findBy('notes', { enabled: false, optional: null })).toEqual([row]);
	expect(await adapter.find('notes', 'absent')).toBeNull();
	expect(await adapter.update('notes', 'first', {})).toEqual(row);
	expect(await adapter.update('notes', 'first', { displayName: 'Renamed' })).toMatchObject({
		displayName: 'Renamed'
	});
	expect(await adapter.update('notes', 'absent', { displayName: 'Gone' })).toBeNull();
	expect(await adapter.delete('notes', 'first')).toBe(true);
	expect(await adapter.delete('notes', 'first')).toBe(false);
});

test('only declared tables and fields are queried and incompatible values are rejected', async () => {
	await expect(adapter.find('notes; DROP TABLE notes', 'first')).rejects.toThrow('No SQLite model');
	await expect(adapter.create('notes', { ...row, unexpected: 'x' })).rejects.toThrow(
		'Unknown SQLite field'
	);
	await expect(adapter.findBy('notes', { "id' OR 1=1": 'x' })).rejects.toThrow(
		'Unknown SQLite field'
	);
	await expect(adapter.create('notes', { ...row, enabled: 'false' })).rejects.toThrow(
		'Invalid SQLite boolean'
	);
	await expect(adapter.update('notes', 'first', { id: 'moved' })).rejects.toThrow('primary key');
	adapter.assertModels();
});

test('failed and nested transactions roll back, and async callbacks never start', () => {
	expect(() =>
		adapter.transaction(() => {
			adapter.insert('notes', row);
			adapter.transaction(() => adapter.insert('notes', { ...row, id: 'second' }));
			throw new Error('rollback');
		})
	).toThrow('rollback');
	expect(adapter.query('SELECT * FROM notes')).toEqual([]);
	let started = false;
	expect(() =>
		adapter.transaction(async () => {
			started = true;
		})
	).toThrow('synchronous');
	expect(started).toBe(false);
	adapter.transaction(() => adapter.insert('notes', row));
	expect(adapter.query('SELECT id FROM notes')).toEqual([{ id: 'first' }]);
});

test('schema coverage rejects unmodeled tables, missing columns and colliding field mappings', () => {
	db.exec('CREATE TABLE sqlitex (id TEXT PRIMARY KEY)');
	expect(() => adapter.assertModels()).toThrow('No SQLite model for table: sqlitex');
	db.exec('DROP TABLE sqlitex');
	db.exec('CREATE TABLE orphan (id TEXT PRIMARY KEY)');
	expect(() => adapter.assertModels()).toThrow('No SQLite model for table: orphan');
	db.exec('DROP TABLE orphan; ALTER TABLE notes ADD COLUMN drift TEXT');
	expect(() => adapter.assertModels()).toThrow('columns do not match');
	expect(() => createSqliteAdapter(db, [{ ...definition, table: 'bad;table' }])).toThrow(
		'Invalid SQLite identifier'
	);
	expect(() => createSqliteAdapter(db, [definition, definition])).toThrow('Duplicate SQLite model');
	expect(() =>
		createSqliteAdapter(db, [
			{
				table: 'duplicates',
				fields: {
					id: { type: 'string' },
					displayName: { type: 'string' },
					display_name: { type: 'string' }
				}
			}
		])
	).toThrow('Duplicate SQLite column');
});
