import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { auditScaffoldTypeScriptNaming } from '../../src/audit/development-tooling/scaffoldNamingRules';

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

function auditFile(relativePath: string, structuralLines: string[]) {
	return {
		absolutePath: `/workspace/app/${relativePath}`,
		relativePath,
		extension: '.ts',
		contents: structuralLines.join('\n'),
		lines: structuralLines,
		structuralLines,
		limits,
		size: structuralLines.join('\n').length
	};
}

test('Finds scaffold naming violations and accepts a valid utility', () => {
	const inputs = [
		{
			name: 'rejects a kebab-case model filename',
			file: auditFile('src/models/user-profile.ts', [
				'export class UserProfile {',
				'\tname: string;',
				'}'
			])
		},
		{
			name: 'finds utility filename and export mismatches',
			file: auditFile('src/utils/format-date.ts', [
				'export function parseDate(value: string): Date {',
				'\treturn new Date(value);',
				'}'
			])
		},
		{
			name: 'accepts matching utility filename and export',
			file: auditFile('src/utils/formatDate.ts', [
				'export function formatDate(value: string): string {',
				'\treturn value;',
				'}'
			])
		}
	];
	const cases = inputs.map(({ name, file }) => {
		const output = auditScaffoldTypeScriptNaming(file);
		return {
			name,
			input: { relativePath: file.relativePath, structuralLines: file.structuralLines },
			output
		};
	});
	expect(cases[0]?.output).toEqual([
		{
			path: 'src/models/user-profile.ts',
			rule: 'file-name-pattern',
			message: 'Model files should be named <PascalName>.ts or <PascalName>.types.ts.'
		}
	]);
	expect(cases[1]?.output).toHaveLength(2);
	expect(cases[2]?.output).toEqual([]);
	recordExampleCases(
		{
			unitId: 'audit.scaffold-naming-rules',
			symbol: 'auditScaffoldTypeScriptNaming',
			state: 'finds-scaffold-naming-violations-and-accepts-a-valid-utility',
			evidence: 'examples-cases',
			file: 'finds-scaffold-naming-violations-and-accepts-a-valid-utility.json'
		},
		cases
	);
});

test('Throws TypeError for an inherited model adapter stem', () => {
	const file = auditFile('src/models/adapters/constructor.ts', []);
	expect(() => auditScaffoldTypeScriptNaming(file)).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: 'audit.scaffold-naming-rules',
			symbol: 'auditScaffoldTypeScriptNaming',
			state: 'throws-typeerror-for-an-inherited-model-adapter-stem',
			evidence: 'examples-cases',
			file: 'throws-typeerror-for-an-inherited-model-adapter-stem.json'
		},
		[
			{
				name: 'constructor is inherited from Object.prototype',
				input: { relativePath: file.relativePath, structuralLines: file.structuralLines },
				error: 'TypeError'
			}
		]
	);
});
