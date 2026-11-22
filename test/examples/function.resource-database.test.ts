import { test } from 'vitest';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { resourceDatabase } from '../../src/services/execution-runtimes/resource-queue-service/resourceDatabase';
import type { ResourceDatabase } from '../../src/services/execution-runtimes/resource-queue-service/resourceDatabase';

const SYMBOL = 'resourceDatabase';
const TABLES_SQL =
	"SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'resource_%' ORDER BY name";

function summarise(db: ResourceDatabase) {
	const version = db.query('PRAGMA user_version').get() as { user_version: number };
	const tables = db.query(TABLES_SQL).all() as { name: string }[];
	return { userVersion: version.user_version, tables: tables.map((table) => table.name) };
}

function openError(home: string): string {
	try {
		resourceDatabase(home);
		return 'opened';
	} catch (error) {
		return (error as Error).message;
	}
}

test('Creates the queue schema in a new home folder', () =>
	withTempDir('resource-database-new', (directory) => {
		const home = join(directory, 'queue-home');
		const db = resourceDatabase(home);
		const summary = summarise(db);
		db.close();
		expect(summary).toEqual({ userVersion: 1, tables: ['resource_jobs', 'resource_state'] });
		recordExampleCases(
			{
				unitId: 'function.resource-database',
				symbol: SYMBOL,
				state: 'creates-the-queue-schema-in-a-new-home-folder',
				evidence: 'examples-cases',
				file: 'creates-the-queue-schema-in-a-new-home-folder.json'
			},
			[{ name: 'new home folder gets schema version one', input: { home: 'queue-home' }, output: summary }]
		);
	}));

test('Reopens an existing queue without losing jobs', () =>
	withTempDir('resource-database-reopen', (directory) => {
		const home = join(directory, 'queue-home');
		const first = resourceDatabase(home);
		first.query('INSERT INTO resource_jobs (id, data) VALUES (?, ?)').run('job-a', '{"n":1}');
		first.close();
		const second = resourceDatabase(home);
		const jobs = second.query('SELECT id, data FROM resource_jobs ORDER BY sequence').all();
		second.close();
		expect(jobs).toEqual([{ id: 'job-a', data: '{"n":1}' }]);
		recordExampleCases(
			{
				unitId: 'function.resource-database',
				symbol: SYMBOL,
				state: 'reopens-an-existing-queue-without-losing-jobs',
				evidence: 'examples-cases',
				file: 'reopens-an-existing-queue-without-losing-jobs.json'
			},
			[{ name: 'job written before close is read after reopen', input: { id: 'job-a' }, output: jobs }]
		);
	}));

test('Rejects a queue schema version it does not support', () =>
	withTempDir('resource-database-schema', (directory) => {
		const home = join(directory, 'queue-home');
		const future = resourceDatabase(home);
		future.exec('PRAGMA user_version=2');
		future.close();
		const message = openError(home);
		expect(message).toBe('Unsupported resource queue schema');
		recordExampleCases(
			{
				unitId: 'function.resource-database',
				symbol: SYMBOL,
				state: 'rejects-a-queue-schema-version-it-does-not-support',
				evidence: 'examples-cases',
				file: 'rejects-a-queue-schema-version-it-does-not-support.json'
			},
			[{ name: 'database with user_version 2 is refused', input: { home: 'queue-home', userVersion: 2 }, error: message }]
		);
	}));
