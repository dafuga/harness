import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ScenarioManifestValidator } from '../../src/validators/ScenarioManifestValidator';
import { videoScriptExports } from '../../src/validators/verification-evidence/scenario-manifest-validator/videoScriptExports';

const validator = new ScenarioManifestValidator();

const registryScenario = {
	schemaVersion: 1,
	id: 'unit-registry-ownership',
	title: 'Registry ownership admission and source qualification',
	kind: 'headless',
	units: ['validator.unit-registry', 'workflow.manage-units'],
	states: [
		{
			id: 'registry-ownership',
			title:
				'Existing ownership and identity matrix including duplicate IDs, canonical boundaries and public/type-only compatibility',
			coverage: 'required',
			units: ['validator.unit-registry', 'workflow.manage-units']
		}
	],
	viewports: [],
	tests: [
		{
			id: 'ownership',
			kind: 'unit',
			runner: 'command',
			target: 'bun test/verification-output.ts vitest test/services/unit-index.test.ts',
			cwd: '.',
			timeoutMs: 180000
		}
	],
	evidence: [
		{
			id: 'ownership-output',
			kind: 'output',
			states: ['registry-ownership'],
			viewports: [],
			required: true
		},
		{
			id: 'ownership-assertions',
			kind: 'assertions',
			states: ['registry-ownership'],
			viewports: [],
			required: true
		},
		{
			id: 'behavior-benchmarks',
			kind: 'benchmark',
			states: ['registry-ownership'],
			viewports: [],
			required: true
		}
	]
};

function summarize(result: { value?: { id: string }; errors: string[] }) {
	return {
		hasValue: result.value !== undefined,
		id: result.value?.id ?? null,
		errors: result.errors
	};
}

function captureError(run: () => unknown): { name: string; message: string } {
	let error: unknown;
	try {
		run();
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return { name: actual.name, message: actual.message };
}

test('Accepts a complete scenario whose id matches its file name', () => {
	const file = 'specification/scenarios/unit-registry-ownership.json';
	const result = validator.validate(registryScenario, file);
	expect(result.errors).toEqual([]);
	expect(result.value?.id).toBe('unit-registry-ownership');
	const output = summarize(result);

	recordExampleCases(
		{
			unitId: 'validator.scenario-manifest',
			symbol: 'validate',
			state: 'accepts-a-complete-scenario-whose-id-matches-its-file-name',
			evidence: 'examples-cases',
			file: 'accepts-a-complete-scenario-whose-id-matches-its-file-name.json'
		},
		[{ name: 'accepts the registry ownership scenario', input: { file }, output }]
	);
});

test('Reports an id that does not match its file name', () => {
	const file = 'specification/scenarios/renamed.json';
	const result = validator.validate(registryScenario, file);
	expect(result.errors).toEqual([
		'renamed: id "unit-registry-ownership" must match its file name'
	]);
	const output = summarize(result);

	recordExampleCases(
		{
			unitId: 'validator.scenario-manifest',
			symbol: 'validate',
			state: 'reports-an-id-that-does-not-match-its-file-name',
			evidence: 'examples-cases',
			file: 'reports-an-id-that-does-not-match-its-file-name.json'
		},
		[{ name: 'reports id mismatch against renamed file', input: { file }, output }]
	);
});

test('Rejects a scenario with an empty title', () => {
	const file = 'specification/scenarios/function-examples.json';
	const input = { ...registryScenario, id: 'function-examples', title: '' };
	const result = validator.validate(input, file);
	expect(result.value).toBeUndefined();
	expect(result.errors).toContain('function-examples: title must not be empty');
	const output = summarize(result);

	recordExampleCases(
		{
			unitId: 'validator.scenario-manifest',
			symbol: 'validate',
			state: 'rejects-a-scenario-with-an-empty-title',
			evidence: 'examples-cases',
			file: 'rejects-a-scenario-with-an-empty-title.json'
		},
		[{ name: 'rejects a function-examples scenario with an empty title', input: { file, title: '' }, output }]
	);
});

test('Rejects a missing or non-object value without a value', () => {
	const file = 'specification/scenarios/missing.json';
	const undefinedResult = validator.validate(undefined, file);
	const textResult = validator.validate('{"schemaVersion": 1', file);
	for (const result of [undefinedResult, textResult]) {
		expect(result.value).toBeUndefined();
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors.every((message) => message.startsWith('missing'))).toBe(true);
	}

	recordExampleCases(
		{
			unitId: 'validator.scenario-manifest',
			symbol: 'validate',
			state: 'rejects-a-missing-or-non-object-value-without-a-value',
			evidence: 'examples-cases',
			file: 'rejects-a-missing-or-non-object-value-without-a-value.json'
		},
		[
			{
				name: 'rejects an undefined value (file was not valid JSON)',
				input: { file, valueType: 'undefined' },
				output: summarize(undefinedResult)
			},
			{
				name: 'rejects a plain text value instead of a scenario object',
				input: { file, valueType: 'string' },
				output: summarize(textResult)
			}
		]
	);
});

test('Rejects a scenario with an unknown key', () => {
	const file = 'specification/scenarios/unit-registry-ownership.json';
	const input = { ...registryScenario, extra: true };
	const result = validator.validate(input, file);
	expect(result.value).toBeUndefined();
	expect(result.errors.length).toBeGreaterThan(0);
	const output = summarize(result);

	recordExampleCases(
		{
			unitId: 'validator.scenario-manifest',
			symbol: 'validate',
			state: 'rejects-a-scenario-with-an-unknown-key',
			evidence: 'examples-cases',
			file: 'rejects-a-scenario-with-an-unknown-key.json'
		},
		[{ name: 'rejects a registry scenario with an extra top-level key', input: { file, extraKey: 'extra' }, output }]
	);
});

test('Lists recording script exports and rejects invalid syntax', () => {
	const path = 'scripts/record-registry.ts';
	const code =
		'export function recordRegistry() {}\nexport const capture = async () => {};\nconst helper = () => 1;\n';
	const exports = Array.from(videoScriptExports(path, code)).sort();
	expect(exports).toEqual(['capture', 'recordRegistry']);

	const brokenPath = 'scripts/broken-record.ts';
	const brokenCode = 'export function (';
	const error = captureError(() => videoScriptExports(brokenPath, brokenCode));
	expect(error.name).toBe('ExpectedCliError');
	expect(error.message).toBe(`Invalid video recording script syntax: ${brokenPath}`);

	recordExampleCases(
		{
			unitId: 'validator.scenario-manifest',
			symbol: 'videoScriptExports',
			state: 'lists-recording-script-exports-and-rejects-invalid-syntax',
			evidence: 'examples-cases',
			file: 'lists-recording-script-exports-and-rejects-invalid-syntax.json'
		},
		[
			{
				name: 'lists the callable exports of a recording script',
				input: { path, code },
				output: { exports }
			},
			{
				name: 'rejects a recording script with invalid syntax',
				input: { path: brokenPath, code: brokenCode },
				error: error
			}
		]
	);
});
