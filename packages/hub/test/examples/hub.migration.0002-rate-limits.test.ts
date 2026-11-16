import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const migrationUrl = new URL('../../db/migrations/0002-rate-limits.sql', import.meta.url);

function readMigrationSql(): string {
	return readFileSync(migrationUrl, 'utf8');
}

function findLine(sql: string, prefix: string): string | undefined {
	return sql
		.split('\n')
		.map((line) => line.trim())
		.find((line) => line.startsWith(prefix));
}

function tableColumns(createTable: string): string[] {
	const body = createTable.match(/\((.*)\)/)?.[1] ?? '';
	return body.split(', ');
}

test('Creates the rate limit table, expiry index and rollback', () => {
	const sql = readMigrationSql();
	const createTable = findLine(sql, 'CREATE TABLE');
	const createIndex = findLine(sql, 'CREATE INDEX');
	const rollback = findLine(sql, '-- rollback:');

	expect(createTable).toBe(
		'CREATE TABLE IF NOT EXISTS hub_rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);'
	);
	expect(createIndex).toBe(
		'CREATE INDEX IF NOT EXISTS hub_rate_limits_expiry ON hub_rate_limits(expires_at);'
	);
	expect(rollback).toBe('-- rollback: DROP TABLE IF EXISTS hub_rate_limits;');

	const columns = tableColumns(createTable ?? '');
	expect(columns).toEqual([
		'id TEXT PRIMARY KEY',
		'count INTEGER NOT NULL',
		'expires_at INTEGER NOT NULL'
	]);

	recordExampleCases(
		{
			unitId: 'hub.migration.0002-rate-limits',
			symbol: 'readMigrationSql',
			state: 'creates-the-rate-limit-table-expiry-index-and-rollback',
			evidence: 'examples-cases',
			file: 'creates-the-rate-limit-table-expiry-index-and-rollback.json'
		},
		[
			{
				name: 'table statement creates hub_rate_limits',
				input: 'migrations/0002-rate-limits.sql',
				output: { table: 'hub_rate_limits', columns }
			},
			{
				name: 'index statement covers expires_at',
				input: 'migrations/0002-rate-limits.sql',
				output: { index: 'hub_rate_limits_expiry', table: 'hub_rate_limits', column: 'expires_at' }
			},
			{
				name: 'rollback statement drops the table',
				input: 'migrations/0002-rate-limits.sql',
				output: { rollback: 'DROP TABLE IF EXISTS hub_rate_limits' }
			}
		]
	);
});
