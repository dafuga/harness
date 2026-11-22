import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { BenchmarkDefinitionValidator, benchmarkDefinitionSchema } from '../../src/cli/program/benchmark-service/benchmark-definition/BenchmarkDefinitionValidator';

const csvDefinition = {
	version: 1,
	name: 'csv-quoted-newlines',
	task: 'Make the CSV parser accept quoted fields that contain newlines.',
	contract: 'Existing parser tests pass and the quoted-newline fixture parses into expected rows.',
	allowedFiles: ['src/csv/parser.ts', 'test/csv/parser.test.ts'],
	checks: [{ id: 'unit-tests', command: 'pnpm vitest run test/csv' }],
	candidates: [{ id: 'claude-sonnet-high', runner: 'claude', model: 'claude-sonnet-5-5', effort: 'high' }]
};

function capturedError(input: unknown): { name: string; message: string } {
	let error: unknown;
	try {
		new BenchmarkDefinitionValidator().validate(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return { name: actual.name, message: actual.message };
}

test('Normalizes a valid benchmark definition with defaults', () => {
	const output = new BenchmarkDefinitionValidator().validate(csvDefinition);
	expect(output).toEqual(benchmarkDefinitionSchema.parse(csvDefinition));
	expect(output.budget).toEqual({ repetitions: 3, timeoutMs: 900000, repairs: 2 });
	recordExampleCases(
		{ unitId: 'validator.benchmark-definition', symbol: 'BenchmarkDefinitionValidator.validate', state: 'normalizes-a-valid-benchmark-definition-with-defaults', evidence: 'examples-cases', file: 'normalizes-a-valid-benchmark-definition-with-defaults.json' },
		[{ name: 'normalizes CSV benchmark defaults', input: csvDefinition, output }]
	);
});

test('Rejects duplicate identifiers and invalid definitions', () => {
	const duplicateFiles = { ...csvDefinition, allowedFiles: ['src/csv/parser.ts', 'src/csv/parser.ts'] };
	const duplicateChecks = { ...csvDefinition, checks: [{ id: 'same', command: 'pnpm test' }, { id: 'same', command: 'pnpm typecheck' }] };
	const invalidCodex = { ...csvDefinition, candidates: [{ id: 'codex-max', runner: 'codex', model: 'gpt-5-codex', effort: 'max' }] };
	const cases = [
		{ name: 'duplicate allowed file paths', input: duplicateFiles, error: capturedError(duplicateFiles) },
		{ name: 'duplicate check identifiers', input: duplicateChecks, error: capturedError(duplicateChecks) },
		{ name: 'Codex candidate with unsupported effort', input: invalidCodex, error: capturedError(invalidCodex) }
	];
	expect(cases[0]?.error.message).toBe('Duplicate benchmark identifiers or paths.');
	expect(cases[2]?.error.name).toBe('ZodError');
	recordExampleCases(
		{ unitId: 'validator.benchmark-definition', symbol: 'BenchmarkDefinitionValidator.validate', state: 'rejects-duplicate-identifiers-and-invalid-definitions', evidence: 'examples-cases', file: 'rejects-duplicate-identifiers-and-invalid-definitions.json' },
		cases
	);
});
