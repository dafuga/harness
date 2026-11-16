import { test } from 'vitest';
import { sqlAdapter } from '../../src/audit/development-tooling/adapters/sql';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function sqlFile(relativePath: string, contents: string, maxFileLines = 220): AuditFile {
	const lines = contents.split('\n');
	return {
		absolutePath: `/fixture/${relativePath}`,
		relativePath,
		extension: '.sql',
		contents,
		lines,
		structuralLines: lines,
		limits: { ...harnessRuleLimits, maxFileLines },
		size: Buffer.byteLength(contents)
	};
}

const adapterMetadata = {
	id: 'sql',
	label: 'SQL',
	profiles: ['app', 'dapp'],
	extensions: ['.sql'],
	optionalTools: ['sqlfluff']
};

const sqlInputs = [
	{
		name: 'orders findings retain general, naming, and SQL rule order',
		file: sqlFile(
			'db/migrations/Bad Name.sql',
			'CREATE TABLE orders (id INT);\nDELETE FROM orders;\nINSERT INTO orders (id) VALUES (1);',
			2
		)
	},
	{
		name: 'commented dangerous and seed statements are ignored with rollback guidance',
		file: sqlFile(
			'db/migrations/2026-04-cleanup.sql',
			'SELECT 1; -- rollback guidance includes DROP TABLE old_orders;\nSELECT 1; -- INSERT INTO orders (id) VALUES (1);'
		)
	},
	{
		name: 'DDL words in comments still require migration reversibility guidance',
		file: sqlFile(
			'db/migrations/2026-04-add-active.sql',
			'-- ALTER TABLE orders ADD COLUMN active BOOLEAN;\nSELECT 1;'
		)
	},
	{
		name: 'seed and reversibility findings stay scoped to migration paths',
		file: sqlFile(
			'db/seeds/2026-04-initial-orders.sql',
			'ALTER TABLE orders ADD COLUMN active BOOLEAN;\nDELETE FROM orders;\nINSERT INTO orders (id) VALUES (1);'
		)
	}
];

const expectedFindings = [
	[
		{ path: 'db/migrations/Bad Name.sql', rule: 'small-file' },
		{ path: 'db/migrations/Bad Name.sql', rule: 'file-name-pattern' },
		{ path: 'db/migrations/Bad Name.sql', rule: 'sql-dangerous-migration' },
		{ path: 'db/migrations/Bad Name.sql', rule: 'sql-reversible-migration' },
		{ path: 'db/migrations/Bad Name.sql', rule: 'sql-seed-in-migration' }
	],
	[],
	[{ path: 'db/migrations/2026-04-add-active.sql', rule: 'sql-reversible-migration' }],
	[{ path: 'db/seeds/2026-04-initial-orders.sql', rule: 'sql-dangerous-migration' }]
];

test('Audits SQL findings and migration boundaries', () => {
	const examples = sqlInputs.map(({ name, file }) => ({
		name,
		input: file,
		output: sqlAdapter.audit(file).map(({ path, rule }) => ({ path, rule }))
	}));
	expect({
		id: sqlAdapter.id,
		label: sqlAdapter.label,
		profiles: sqlAdapter.profiles,
		extensions: sqlAdapter.extensions,
		optionalTools: sqlAdapter.optionalTools
	}).toEqual(adapterMetadata);
	expect(examples.map(({ output }) => output)).toEqual(expectedFindings);
	recordExampleCases(
		{
			unitId: 'audit.adapters-sql',
			symbol: 'audit',
			state: 'audits-sql-findings-and-migration-boundaries',
			evidence: 'examples-cases',
			file: 'audits-sql-findings-and-migration-boundaries.json'
		},
		examples
	);
});
