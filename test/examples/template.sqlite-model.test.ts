import { test } from 'vitest';
import type { Field } from '../../src/core/development-tooling/fields/fields';
import { sqliteModelDefinition } from '../../src/templates/development-tooling/sqliteModel';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Generates a sqlite definition with mapped fields and timestamps', () => {
	const input: { table: string; fields: Field[] } = {
		table: 'project_members',
		fields: [
			{
				name: 'profile',
				type: 'json',
				column: 'profile_json',
				tsType: 'Record<string, unknown>',
				sqlType: 'TEXT'
			},
			{ name: 'active', type: 'boolean', column: 'is_active', tsType: 'boolean', sqlType: 'INTEGER' },
			{ name: 'score', type: 'number', column: 'score_value', tsType: 'number', sqlType: 'INTEGER' },
			{ name: 'displayName', type: 'text', column: 'display_name', tsType: 'string', sqlType: 'TEXT' }
		]
	};
	const output = sqliteModelDefinition(input.table, input.fields);

	expect(output).toContain("table: 'project_members'");
	expect(output).toContain("profile: { type: 'json', column: 'profile_json' }");
	expect(output).toContain("displayName: { type: 'string', column: 'display_name' }");
	expect(output).toContain("createdAt: { type: 'string', default: 'timestamp' }");
	recordExampleCases(
		{
			unitId: 'template.sqlite-model',
			symbol: 'sqliteModelDefinition',
			state: 'generates-a-sqlite-definition-with-mapped-fields-and-timesta',
			evidence: 'examples-cases',
			file: 'generates-a-sqlite-definition-with-mapped-fields-and-timesta.json'
		},
		[{ name: 'maps supported field types and supplies id and timestamp fields', input, output }]
	);
});
