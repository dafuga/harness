import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const unitId = 'hub.migration.0003-auth-grant-generations';
const migrationUrl = new URL('../../db/migrations/0003-auth-grant-generations.sql', import.meta.url);

// Minimal stand-ins for the tables the migration alters; only their existence matters here.
const baseSchema = `
CREATE TABLE auth_github_grants (id TEXT PRIMARY KEY, access_token TEXT);
CREATE TABLE auth_github_states (id TEXT PRIMARY KEY);
INSERT INTO auth_github_grants (id, access_token) VALUES ('grant-1', 'example-token');
`;
const grantsOnlySchema = 'CREATE TABLE auth_github_grants (id TEXT PRIMARY KEY, access_token TEXT);';

function runMigration(db: DatabaseSync): void {
	db.exec(readFileSync(migrationUrl, 'utf8'));
}

function withDatabase<T>(setup: string, run: (db: DatabaseSync) => T): T {
	const dir = mkdtempSync(join(tmpdir(), 'hub-migration-0003-'));
	const db = new DatabaseSync(join(dir, 'hub.db'));
	try {
		db.exec(setup);
		return run(db);
	} finally {
		db.close();
		rmSync(dir, { recursive: true, force: true });
	}
}

function columnNames(db: DatabaseSync, table: string): string[] {
	const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	return rows.map((row) => row.name);
}

function captureError(run: () => void): { name: string; message: string } {
	let error: unknown;
	try {
		run();
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return { name: actual.name, message: actual.message };
}

test('Adds generation columns with defaults', () => {
	const summary = withDatabase(baseSchema, (db) => {
		runMigration(db);
		db.exec("INSERT INTO auth_github_states (id) VALUES ('state-1')");
		return {
			grantColumns: columnNames(db, 'auth_github_grants'),
			stateColumns: columnNames(db, 'auth_github_states'),
			grant: db
				.prepare('SELECT generation, revoked_at, refreshing_until FROM auth_github_grants WHERE id = ?')
				.get('grant-1'),
			state: db.prepare('SELECT grant_generation FROM auth_github_states WHERE id = ?').get('state-1')
		};
	});

	expect(summary.grantColumns).toEqual(['id', 'access_token', 'generation', 'revoked_at', 'refreshing_until']);
	expect(summary.stateColumns).toEqual(['id', 'grant_generation']);
	expect(summary.grant).toEqual({ generation: 1, revoked_at: null, refreshing_until: null });
	expect(summary.state).toEqual({ grant_generation: 0 });

	recordExampleCases(
		{
			unitId,
			symbol: 'runMigration',
			state: 'adds-generation-columns-with-defaults',
			evidence: 'examples-cases',
			file: 'adds-generation-columns-with-defaults.json'
		},
		[
			{
				name: 'grant row after migration keeps id and gets generation 1',
				input: { table: 'auth_github_grants', grantId: 'grant-1' },
				output: { columns: summary.grantColumns, row: summary.grant }
			},
			{
				name: 'state row after migration gets grant_generation 0',
				input: { table: 'auth_github_states', stateId: 'state-1' },
				output: { columns: summary.stateColumns, row: summary.state }
			}
		]
	);
});

test('Rejects a second run with a duplicate column error', () => {
	const error = withDatabase(baseSchema, (db) => {
		runMigration(db);
		return captureError(() => runMigration(db));
	});

	expect(error.name).toBe('Error');
	expect(error.message).toMatch(/duplicate column name: generation/);

	recordExampleCases(
		{
			unitId,
			symbol: 'runMigration',
			state: 'rejects-a-second-run-with-a-duplicate-column-error',
			evidence: 'examples-cases',
			file: 'rejects-a-second-run-with-a-duplicate-column-error.json'
		},
		[
			{
				name: 'second run of the full file after a successful first run',
				input: { runs: 2 },
				error
			}
		]
	);
});

test('Rejects the file when auth_github_states is missing', () => {
	const error = withDatabase(grantsOnlySchema, (db) => captureError(() => runMigration(db)));

	expect(error.message).toMatch(/no such table: auth_github_states/);

	recordExampleCases(
		{
			unitId,
			symbol: 'runMigration',
			state: 'rejects-the-file-when-auth-github-states-is-missing',
			evidence: 'examples-cases',
			file: 'rejects-the-file-when-auth-github-states-is-missing.json'
		},
		[
			{
				name: 'run against a database that only has auth_github_grants',
				input: { tables: ['auth_github_grants'] },
				error
			}
		]
	);
});
