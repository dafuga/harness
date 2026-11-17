import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { fileName, typeScriptStem, fileNameFinding, isPascalCase, isCamelCase, isKebabCase, escapeRegExp } from '../../src/audit/development-tooling/namePatterns';

const state = (title: string): string => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function record(symbol: string, stateId: string, cases: Array<{ name: string; input: unknown; output: unknown }>): void {
	recordExampleCases({
		unitId: 'audit.name-patterns',
		symbol,
		state: stateId,
		evidence: 'examples-cases',
		file: `${stateId}.json`
	}, cases);
}

test('Extracts file names and TypeScript stems', () => {
	const title = 'Extracts file names and TypeScript stems';
	const stateId = state(title);
	const paths = ['src/audit/namePatterns.ts', 'src/models/Customer.types.ts', 'src/file.json'];
	const names = paths.map((path) => ({ name: path, input: path, output: fileName(path) }));
	const stems = paths.map((path) => ({ name: path, input: path, output: typeScriptStem(path) }));
	expect(names[0]?.output).toBe('namePatterns.ts');
	expect(stems[1]?.output).toBe('Customer.types');
	record('fileName', stateId, names);
	record('typeScriptStem', stateId, stems);
});

test('Builds a finding from the repository relative path', () => {
	const title = 'Builds a finding from the repository relative path';
	const stateId = state(title);
	const file = {
		absolutePath: '/workspace/app/src/models/user-profile.ts',
		relativePath: 'src/models/user-profile.ts',
		extension: '.ts',
		contents: 'export interface UserProfile {}',
		lines: ['export interface UserProfile {}'],
		structuralLines: ['export interface UserProfile {}'],
		limits: {
			maxFileLines: 220, maxFunctionLines: 55, maxClassLines: 120, maxMethodLines: 35,
			maxNestingDepth: 4, maxParameters: 4, maxComplexity: 10, maxClassesPerFile: 1
		},
		size: 32
	};
	const message = 'Model files should be named <PascalName>.ts or <PascalName>.types.ts.';
	const output = fileNameFinding(file, message);
	expect(output).toEqual({ path: file.relativePath, rule: 'file-name-pattern', message });
	record('fileNameFinding', stateId, [{ name: 'model path finding', input: { file, message }, output }]);
});

test('Checks Pascal camel and kebab case candidates', () => {
	const title = 'Checks Pascal camel and kebab case candidates';
	const stateId = state(title);
	const pascal = ['CustomerProfile', 'userProfile'];
	const camel = ['formatBytes', 'UserSession'];
	const kebab = ['seed-users', 'UserProfile'];
	const pascalCases = pascal.map((value) => ({ name: value, input: value, output: isPascalCase(value) }));
	const camelCases = camel.map((value) => ({ name: value, input: value, output: isCamelCase(value) }));
	const kebabCases = kebab.map((value) => ({ name: value, input: value, output: isKebabCase(value) }));
	expect(pascalCases[0]?.output).toBe(true);
	expect(camelCases[1]?.output).toBe(false);
	expect(kebabCases[0]?.output).toBe(true);
	record('isPascalCase', stateId, pascalCases);
	record('isCamelCase', stateId, camelCases);
	record('isKebabCase', stateId, kebabCases);
});

test('Escapes regular expression characters in names', () => {
	const title = 'Escapes regular expression characters in names';
	const stateId = state(title);
	const values = ['$store', 'createD1Adapter'];
	const cases = values.map((value) => ({ name: value, input: value, output: escapeRegExp(value) }));
	expect(cases[0]?.output).toBe('\\$store');
	record('escapeRegExp', stateId, cases);
});
