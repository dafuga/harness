import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	controllerFiles,
	classFiles,
	repositoryFiles,
	adapterFiles,
	validatorFiles,
	serializerFiles,
	policyFiles,
	seederFiles,
	utilFiles
} from '../../src/templates/development-tooling/packagePieces';

function keyLines(files: Array<{ path: string; contents: string }>) {
	return files.map(({ path, contents }) => ({
		path,
		lines: contents
			.split('\n')
			.filter((line) =>
				/^(export class|export async function|export function|test\(|\s*(async )?(index|run|find|save|connect|validate|serialize|canRead)\(|\s*return)/.test(
					line
				)
			)
	}));
}

test('Generates package piece source and test plans', () => {
	const cases = [
		{ name: 'controller', input: { name: 'user' }, output: keyLines(controllerFiles('user')) },
		{
			name: 'class',
			input: { folder: 'services', name: 'user', suffix: 'Service' },
			output: keyLines(classFiles('services', 'user', 'Service'))
		},
		{ name: 'repository', input: { name: 'user' }, output: keyLines(repositoryFiles('user')) },
		{ name: 'adapter', input: { name: 'user' }, output: keyLines(adapterFiles('user')) },
		{ name: 'validator', input: { name: 'user' }, output: keyLines(validatorFiles('user')) },
		{ name: 'serializer', input: { name: 'user' }, output: keyLines(serializerFiles('user')) },
		{ name: 'policy', input: { name: 'user' }, output: keyLines(policyFiles('user')) },
		{ name: 'seeder', input: { name: 'user' }, output: keyLines(seederFiles('user')) },
		{ name: 'utility', input: { name: 'user' }, output: keyLines(utilFiles('user')) }
	];

	expect(cases).toHaveLength(9);
	expect(cases[0].output).toEqual([
		{
			path: 'src/controllers/UserController.ts',
			lines: [
				'export class UserController {',
				'\tasync index(): Promise<Response> {',
				'\t\treturn Response.json({ ok: true });'
			]
		},
		{
			path: 'test/controllers/user-controller.test.ts',
			lines: ["test('UserController index returns ok', async () => {"]
		}
	]);
	recordExampleCases(
		{
			unitId: 'template.package-pieces',
			symbol:
				'controllerFiles,classFiles,repositoryFiles,adapterFiles,validatorFiles,serializerFiles,policyFiles,seederFiles,utilFiles',
			state: 'generates-package-piece-source-and-test-plans',
			evidence: 'examples-cases',
			file: 'generates-package-piece-source-and-test-plans.json'
		},
		cases
	);
});
