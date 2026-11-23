import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { modelFiles } from '../../src/templates/development-tooling/model';
import type { ModelInput } from '../../src/templates/development-tooling/model.types';

const input: ModelInput = { name: 'user', fields: [], adapter: 'postgres' };

test('Generates a Postgres model scaffold', () => {
	const files = modelFiles(input);
	expect(files.map((file) => file.path)).toEqual([
		'src/models/User.types.ts',
		'src/models/User.ts',
		'src/models/adapters/postgres.ts',
		'db/migrations/create_users.sql',
		'test/models/user.test.ts'
	]);
	expect(files[1]?.contents).toContain("const tableName = 'users';");
	expect(files[3]?.contents).toContain('CREATE TABLE IF NOT EXISTS users');
	recordExampleCases(
		{
			unitId: 'template.model',
			symbol: 'modelFiles',
			state: 'generates-a-postgres-model-scaffold',
			evidence: 'examples-cases',
			file: 'generates-a-postgres-model-scaffold.json'
		},
		[
			{
				name: 'user model includes types, class, adapter, migration, and test',
				input,
				output: files.map(({ path, contents }) => ({
					path,
					keyLines: contents
						.split('\n')
						.filter((line) =>
							/^(export interface UserAttributes|export class User|const tableName|CREATE TABLE|-- reversible|export function createPostgresAdapter|test\()/.test(
								line
							)
						)
				}))
			}
		]
	);
});
