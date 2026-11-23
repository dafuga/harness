import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { openSqlite } from '../../src/adapters/development-tooling/openSqlite';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Opens a supplied path with writable access by default', async () => {
	await withTempDir('adapter-open-sqlite-', (directory) => {
		const path = join(directory, 'state.sqlite');
		const database = openSqlite(path);
		try {
			database.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, status TEXT NOT NULL)');
			const inserted = database
				.prepare('INSERT INTO records (id, status) VALUES (?, ?)')
				.run(1, 'ready');
			const row = database.prepare('SELECT id, status FROM records').get() as
				| { id: number; status: string }
				| undefined;
			const output = {
				createdAtSuppliedPath: existsSync(path),
				insertedRows: Number(inserted.changes),
				row: row ? { id: row.id, status: row.status } : null
			};
			recordExampleCases(
				{
					unitId: 'adapter.open-sqlite',
					symbol: 'openSqlite',
					state: 'opens-a-supplied-path-with-writable-access-by-default',
					evidence: 'examples-cases',
					file: 'opens-a-supplied-path-with-writable-access-by-default.json'
				},
				[
					{
						name: 'omitting readOnly creates and writes at the supplied path',
						input: { path },
						output
					}
				]
			);
			expect(output).toEqual({
				createdAtSuppliedPath: true,
				insertedRows: 1,
				row: { id: 1, status: 'ready' }
			});
		} finally {
			database.close();
		}
	});
});

test('Opens an existing database with read-only access', async () => {
	await withTempDir('adapter-open-sqlite-', (directory) => {
		const path = join(directory, 'existing.sqlite');
		const writable = openSqlite(path);
		try {
			writable.exec('CREATE TABLE records (id INTEGER PRIMARY KEY, status TEXT NOT NULL)');
			writable.prepare('INSERT INTO records (id, status) VALUES (?, ?)').run(1, 'stored');
		} finally {
			writable.close();
		}

		const database = openSqlite(path, true);
		try {
			const row = database.prepare('SELECT id, status FROM records').get() as
				| { id: number; status: string }
				| undefined;
			let writeError: { name: string; message: string } | null = null;
			try {
				database.prepare('INSERT INTO records (id, status) VALUES (?, ?)').run(2, 'blocked');
			} catch (error) {
				writeError =
					error instanceof Error
						? { name: error.name, message: error.message }
						: { name: typeof error, message: String(error) };
			}
			const output = {
				row: row ? { id: row.id, status: row.status } : null,
				writeError
			};
			recordExampleCases(
				{
					unitId: 'adapter.open-sqlite',
					symbol: 'openSqlite',
					state: 'opens-an-existing-database-with-read-only-access',
					evidence: 'examples-cases',
					file: 'opens-an-existing-database-with-read-only-access.json'
				},
				[
					{
						name: 'explicit readOnly reads existing data and rejects a write',
						input: { path, readOnly: true },
						output
					}
				]
			);
			expect(output).toEqual({
				row: { id: 1, status: 'stored' },
				writeError: expect.objectContaining({ name: expect.any(String) })
			});
		} finally {
			database.close();
		}
	});
});

test('Propagates an SQLite constructor error', async () => {
	await withTempDir('adapter-open-sqlite-', (directory) => {
		const path = join(directory, 'missing-parent', 'state.sqlite');
		let didThrow = false;
		let caught: unknown;
		let opened: ReturnType<typeof openSqlite> | undefined;
		try {
			opened = openSqlite(path);
		} catch (error) {
			didThrow = true;
			caught = error;
		} finally {
			opened?.close();
		}
		const error =
			caught instanceof Error
				? { name: caught.name, message: caught.message }
				: { name: typeof caught, message: String(caught) };
		const example = didThrow
			? {
					name: 'the selected SQLite constructor refuses a missing parent directory',
					input: { path },
					error
				}
			: {
					name: 'the selected SQLite constructor refuses a missing parent directory',
					input: { path },
					output: { opened: true }
				};
		recordExampleCases(
			{
				unitId: 'adapter.open-sqlite',
				symbol: 'openSqlite',
				state: 'propagates-an-sqlite-constructor-error',
				evidence: 'examples-cases',
				file: 'propagates-an-sqlite-constructor-error.json'
			},
			[example]
		);
		expect(didThrow).toBe(true);
		expect(caught).toBeInstanceOf(Error);
	});
});
