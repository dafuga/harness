import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const migrationUrl = new URL('../../db/migrations/0001-auth-ephemeral-state.sql', import.meta.url);
const tables = [
	'auth_challenges',
	'auth_sessions',
	'auth_github_states',
	'auth_github_grants',
	'auth_native_exchanges'
];
const environments = ['local', 'staging', 'production'];

function tableCase(
	sql: string,
	table: string
): { name: string; input: string; output: { present: boolean } } {
	const present = new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`).test(sql);
	expect(present).toBe(true);
	return { name: `creates ${table}`, input: table, output: { present } };
}

test('Declares the five ephemeral auth tables', () => {
	const sql = readFileSync(migrationUrl, 'utf8');
	const cases: Array<{ name: string; input: unknown; output: unknown }> = tables.map((table) =>
		tableCase(sql, table)
	);
	const environmentCheck = `CHECK (environment IN ('local', 'staging', 'production'))`;
	expect(sql.includes(environmentCheck)).toBe(true);
	cases.push({
		name: 'restricts environment to local, staging and production',
		input: 'environment',
		output: { allowed: environments }
	});

	recordExampleCases(
		{
			unitId: 'hub.migration.0001-auth-ephemeral-state',
			symbol: 'migration SQL file',
			state: 'declares-the-five-ephemeral-auth-tables',
			evidence: 'examples-cases',
			file: 'declares-the-five-ephemeral-auth-tables.json'
		},
		cases
	);
});
