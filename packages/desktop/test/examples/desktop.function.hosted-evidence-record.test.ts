import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedEvidenceRecord } from '../../src/utils/verification-evidence/hostedEvidenceRecord';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const diagnostic = {
	test: 'renders the example record',
	file: 'test/examples/desktop.function.hosted-evidence-record.test.ts',
	project: 'desktop',
	retry: 0,
	errors: [{ type: 'console', message: 'expected example warning', page: '/' }],
	expected: [{ type: 'console', message: 'expected example warning', reason: 'documented example' }]
};
const capture = {
	evidence: 'examples-output',
	kind: 'output',
	state: 'accepts-minimal-hosted-records-and-refuses-invalid-nested-data',
	status: 'passed',
	path: 'examples/output.txt',
	sha256: digest,
	mediaType: 'text/plain',
	capturedAt: '2026-11-19T12:00:00Z',
	media: 'examples-output.txt'
};

/** A minimal hosted record whose every field matches the declared schema. */
function record() {
	return {
		id: 'desktop.function.hosted-evidence-record',
		status: 'passed',
		valid: true,
		problems: [],
		failures: [],
		source: { commit: sha, base: null },
		profile: 'ci',
		startedAt: '2026-11-19T12:00:00Z',
		finishedAt: '2026-11-19T12:00:02Z',
		tests: [
			{
				id: 'examples',
				kind: 'unit',
				target: 'test/examples/desktop.function.hosted-evidence-record.test.ts',
				status: 'passed',
				durationMs: 1200,
				browserErrors: [diagnostic]
			}
		],
		scenarios: [
			{
				id: 'browser-error-evidence',
				status: 'passed',
				testedRevision: sha,
				inherited: false,
				origin: { record: 'record-1', commit: sha },
				states: [
					{
						id: 'accepts-minimal-hosted-records-and-refuses-invalid-nested-data',
						coverage: 'required',
						captures: [capture]
					}
				]
			}
		],
		measurements: [
			{
				unit: 'desktop.function.hosted-evidence-record',
				metric: 'source-bytes',
				unitOfMeasure: 'bytes',
				value: 1605,
				workload: null,
				profile: null
			}
		],
		budgets: { findings: [] }
	};
}

/** Each candidate changes one nested or root field so that the declared shape refuses it. */
function refusedRecords(): Array<{ name: string; value: unknown }> {
	const base = record();
	const test = base.tests[0];
	const scenario = base.scenarios[0];
	return [
		{ name: 'undeclared root key', value: { ...record(), extra: true } },
		{
			name: 'uppercase source commit',
			value: { ...record(), source: { commit: 'A'.repeat(40), base: null } }
		},
		{
			name: 'infinite measurement value',
			value: { ...record(), measurements: [{ ...base.measurements[0], value: Infinity }] }
		},
		{ name: 'undeclared test key', value: { ...record(), tests: [{ ...test, extra: true }] } },
		{ name: 'unknown test status', value: { ...record(), tests: [{ ...test, status: 'ok' }] } },
		{
			name: 'diagnostic with unknown error type',
			value: {
				...record(),
				tests: [
					{
						...test,
						browserErrors: [
							{ ...diagnostic, errors: [{ ...diagnostic.errors[0], type: 'warning' }] }
						]
					}
				]
			}
		},
		{
			name: 'capture with malformed digest',
			value: {
				...record(),
				scenarios: [
					{
						...scenario,
						states: [{ ...scenario.states[0], captures: [{ ...capture, sha256: 'not-a-digest' }] }]
					}
				]
			}
		},
		{ name: 'identifier over 300 characters', value: { ...record(), id: 'x'.repeat(301) } },
		{ name: 'missing required identifier', value: { ...record(), id: undefined } }
	];
}

/** Reduces a parse result to its success flag, issue codes and first issue path. */
function traceOf(result: ReturnType<typeof hostedEvidenceRecord.safeParse>) {
	if (result.success) return { success: true, issues: [] as string[], path: null };
	return {
		success: false,
		issues: result.error.issues.map((issue) => issue.code),
		path: result.error.issues[0]?.path.join('.') ?? null
	};
}

test('accepts minimal hosted records and refuses invalid nested data', () => {
	const base = record();
	const accepted = hostedEvidenceRecord.safeParse(base);
	// The schema is shape-only: a well-formed record that contradicts itself is still accepted.
	const contradictory = { ...record(), failures: ['examples'] };
	const contradictoryResult = hostedEvidenceRecord.safeParse(contradictory);
	const results = refusedRecords().map(({ name, value }) => ({
		name,
		value,
		result: hostedEvidenceRecord.safeParse(value)
	}));

	expect(accepted.success).toBe(true);
	expect(contradictoryResult.success).toBe(true);
	for (const { result } of results) expect(result.success).toBe(false);

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-evidence-record',
			symbol: 'hostedEvidenceRecord',
			state: 'accepts-minimal-hosted-records-and-refuses-invalid-nested-data',
			evidence: 'examples-cases',
			file: 'accepts-minimal-hosted-records-and-refuses-invalid-nested-data.json'
		},
		[
			{ name: 'minimal truthful hosted record', input: base, output: traceOf(accepted) },
			{
				name: 'well-formed but contradictory record',
				input: contradictory,
				output: traceOf(contradictoryResult)
			},
			...results.map(({ name, value, result }) => ({
				name,
				input: value,
				output: traceOf(result)
			}))
		]
	);
});
