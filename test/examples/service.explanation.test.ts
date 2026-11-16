import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	ExplanationService,
	describe
} from '../../src/services/development-tooling/ExplanationService';

type Required = Parameters<ExplanationService['report']>[0][number];
type Reason = Parameters<ExplanationService['report']>[1][number];

const unit = 'service.explanation';
const file = 'src/services/development-tooling/ExplanationService.ts';
const longAttempt =
	'Replaced the reversed copy with an index walk, keeping the same order and one less array.';

function reason({
	symbol = 'ExplanationService.report',
	change = 'modified',
	from,
	to,
	behavior,
	attempt = 'Merged two loops into one pass; the code was not shorter.'
}: {
	symbol?: string;
	change?: Reason['change'];
	from: string | null;
	to: string | null;
	behavior: string;
	attempt?: string;
}): Reason {
	return {
		unit,
		symbol,
		file,
		change,
		from,
		to,
		behavior,
		simplification: { attempt, outcome: 'not-improved' },
		performance: { attempt: 'Nothing applies.', outcome: 'not-applicable' },
		recordedAt: '2026-11-14T16:05:42.901Z'
	};
}

const describeReason = reason({
	symbol: 'describe',
	change: 'added',
	from: null,
	to: '7d2e9b04c1f6a853',
	behavior: 'Adds the describe function that names a requirement change in one line.'
});
const firstStep = reason({
	from: '5e7a2c91b0d4f836',
	to: '0c8d41e7f9a2b356',
	behavior: 'Marks a requirement stale when a reason starts at its from but does not reach its to.'
});
const secondStep = reason({
	from: '0c8d41e7f9a2b356',
	to: 'b3f0a8d6e2c17495',
	behavior: 'Lists a long reason under failures only when the report declares a writing version.',
	attempt: longAttempt
});
const modifiedRequirement: Required = {
	unit,
	symbol: 'ExplanationService.report',
	file,
	change: 'modified',
	from: '5e7a2c91b0d4f836',
	to: 'b3f0a8d6e2c17495'
};
const addedRequirement: Required = {
	unit,
	symbol: 'describe',
	file,
	change: 'added',
	from: null,
	to: '7d2e9b04c1f6a853'
};

test('Explains a change through its chain of reasons', () => {
	const requirements = [modifiedRequirement, addedRequirement];
	const explanations = [describeReason, firstStep, secondStep];
	const report = new ExplanationService().report(requirements, explanations, null);

	expect(report.required.map((status) => status.state)).toEqual(['explained', 'explained']);
	expect(report.entries).toHaveLength(3);
	expect(report.failures).toEqual([]);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'ExplanationService.report',
			state: 'explains-a-change-through-its-chain-of-reasons',
			evidence: 'examples-cases',
			file: 'explains-a-change-through-its-chain-of-reasons.json'
		},
		[
			{
				name: 'modified symbol chained through two steps and added symbol explained',
				input: { required: requirements, explanations, writing: null },
				output: {
					states: report.required.map((status) => status.state),
					entries: report.entries.map((entry) => `${entry.from}->${entry.to}`),
					failures: report.failures
				}
			}
		]
	);
});

test('Reports a change without a reason as missing', () => {
	const report = new ExplanationService().report([addedRequirement], []);
	const [status] = report.required;

	expect(status.state).toBe('missing');
	expect(report.failures).toEqual([
		'service.explanation: describe in src/services/development-tooling/ExplanationService.ts was added without a reason'
	]);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'ExplanationService.report',
			state: 'reports-a-change-without-a-reason-as-missing',
			evidence: 'examples-cases',
			file: 'reports-a-change-without-a-reason-as-missing.json'
		},
		[
			{
				name: 'added symbol with no recorded reason is missing',
				input: { required: [addedRequirement], explanations: [] },
				output: { state: status.state, failures: report.failures }
			}
		]
	);
});

test('Reports a change whose reason stops short as stale', () => {
	const report = new ExplanationService().report([modifiedRequirement], [firstStep]);
	const [status] = report.required;

	expect(status.state).toBe('stale');
	expect(report.failures).toHaveLength(1);
	expect(report.failures[0]).toMatch(/after its reason was written$/);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'ExplanationService.report',
			state: 'reports-a-change-whose-reason-stops-short-as-stale',
			evidence: 'examples-cases',
			file: 'reports-a-change-whose-reason-stops-short-as-stale.json'
		},
		[
			{
				name: 'modified symbol whose reason stops before its to is stale',
				input: { required: [modifiedRequirement], explanations: [firstStep] },
				output: { state: status.state, failures: report.failures }
			}
		]
	);
});

test('Fails an overlong reason only when a writing version is declared', () => {
	const service = new ExplanationService();
	const requirements = [modifiedRequirement];
	const explanations = [firstStep, secondStep];
	const declared = service.report(requirements, explanations, 2);
	const undeclared = service.report(requirements, explanations, null);

	expect(declared.overlong).toEqual(requirements);
	expect(declared.failures).toHaveLength(1);
	expect(declared.failures[0]).toContain('simplification attempt has 16 words; the limit is 15.');
	expect(undeclared.failures).toEqual([]);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'ExplanationService.report',
			state: 'fails-an-overlong-reason-only-when-a-writing-version-is-decl',
			evidence: 'examples-cases',
			file: 'fails-an-overlong-reason-only-when-a-writing-version-is-decl.json'
		},
		[
			{
				name: 'sixteen-word attempt fails under version 2 when a version is declared',
				input: { required: requirements, explanations, writing: 2, attempt: longAttempt },
				output: { overlong: declared.overlong, failures: declared.failures }
			},
			{
				name: 'same reason without a declared version lists no writing problem',
				input: { required: requirements, explanations, writing: null },
				output: { overlong: undeclared.overlong, failures: undeclared.failures }
			}
		]
	);
});

test('Describes a stale requirement in one line', () => {
	const line = describe({ ...modifiedRequirement, state: 'stale' });

	expect(line).toBe(
		'service.explanation: ExplanationService.report in src/services/development-tooling/ExplanationService.ts was modified after its reason was written'
	);
	recordExampleCases(
		{
			unitId: unit,
			symbol: 'describe',
			state: 'describes-a-stale-requirement-in-one-line',
			evidence: 'examples-cases',
			file: 'describes-a-stale-requirement-in-one-line.json'
		},
		[
			{
				name: 'stale modified symbol names its change and the written-reason ending',
				input: { ...modifiedRequirement, state: 'stale' },
				output: line
			}
		]
	);
});
