import type { AuditFile } from './audit.naming-rules.test.types';
import { test } from 'vitest';
import {
	auditSqlNaming,
	auditTypeScriptNaming
} from '../../src/audit/development-tooling/namingRules';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const limits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};

function auditFile(relativePath: string, contents: string, extension: string): AuditFile {
	const lines = contents.split('\n');
	return {
		absolutePath: `/workspace/project/${relativePath}`,
		relativePath,
		extension,
		contents,
		lines,
		structuralLines: lines,
		limits,
		size: contents.length
	};
}

const typeScriptFindings = [
	[
		{
			path: 'src/utils/getUser.ts',
			rule: 'function-name-pattern',
			message: 'Function "Bad_Name" should use camelCase.'
		}
	],
	[],
	[
		{
			path: 'src/utils/fetchUser.ts',
			rule: 'function-name-pattern',
			message: 'Utility files should export "fetchUser".'
		}
	],
	[]
];

const sqlFindings = [
	[
		{
			path: 'db/migrations/2026-11-15-Add_users.sql',
			rule: 'file-name-pattern',
			message: 'Migration files should use lowercase kebab-case or snake_case names.'
		}
	],
	[],
	[]
];

test('Finds invalid TypeScript names and skips type companions', () => {
	const examples = [
		{
			name: 'invalid function beside a valid utility export',
			file: auditFile(
				'src/utils/getUser.ts',
				'export function getUser() {}\nexport function Bad_Name() {}',
				'.ts'
			)
		},
		{
			name: 'valid camelCase utility export',
			file: auditFile('src/utils/getUser.ts', 'export function getUser() {}', '.ts')
		},
		{
			name: 'utility file without its expected export',
			file: auditFile('src/utils/fetchUser.ts', 'export const loadUsers = () => [];', '.ts')
		},
		{
			name: 'type companion containing a runtime function declaration',
			file: auditFile('src/utils/getUser.types.ts', 'export function Bad_Name() {}', '.ts')
		}
	].map(({ name, file }) => ({ name, input: file, output: auditTypeScriptNaming(file) }));

	expect(examples.map(({ output }) => output)).toEqual(typeScriptFindings);
	recordExampleCases(
		{
			unitId: 'audit.naming-rules',
			symbol: 'auditTypeScriptNaming',
			state: 'finds-invalid-typescript-names-and-skips-type-companions',
			evidence: 'examples-cases',
			file: 'finds-invalid-typescript-names-and-skips-type-companions.json'
		},
		examples
	);
});

test('Checks migration names only in the migrations folder', () => {
	const examples = [
		{
			name: 'uppercase and underscore in a migration filename',
			file: auditFile(
				'db/migrations/2026-11-15-Add_users.sql',
				'CREATE TABLE users (id INTEGER);',
				'.sql'
			)
		},
		{
			name: 'lowercase snake_case migration filename',
			file: auditFile(
				'db/migrations/2026-11-15-add_users.sql',
				'CREATE TABLE users (id INTEGER);',
				'.sql'
			)
		},
		{
			name: 'similarly named SQL file outside the migration folder',
			file: auditFile(
				'src/db/migrations/2026-11-15-Add_users.sql',
				'CREATE TABLE users (id INTEGER);',
				'.sql'
			)
		}
	].map(({ name, file }) => ({ name, input: file, output: auditSqlNaming(file) }));

	expect(examples.map(({ output }) => output)).toEqual(sqlFindings);
	recordExampleCases(
		{
			unitId: 'audit.naming-rules',
			symbol: 'auditSqlNaming',
			state: 'checks-migration-names-only-in-the-migrations-folder',
			evidence: 'examples-cases',
			file: 'checks-migration-names-only-in-the-migrations-folder.json'
		},
		examples
	);
});
