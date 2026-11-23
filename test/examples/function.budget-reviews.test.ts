import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { budgetReviews } from '../../src/cli/program/history-index-service/budgetReviews';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type {
	BudgetReview,
	EmittedLimits,
	FrozenLimits
} from '../../src/utils/verification-evidence/budgetReviews';
import {
	frozenLimits,
	emittedLimits
} from '../../src/utils/verification-evidence/revision-registry/frozenLimits';

const baseline = {
	type: 'baseline' as const,
	unit: 'function.budget-reviews',
	record: { id: 'record-1', commit: 'commit-1', tree: 'tree-1' },
	reviewer: 'Priya Natarajan',
	reason: 'Limits frozen when the unit was first established.',
	at: '2026-10-03T16:42:10.118Z',
	metrics: { 'source-bytes': 18432, complexity: 37, dependencies: 6 },
	performance: []
};

const frozen = {
	metrics: {
		'source-bytes': 18432,
		complexity: 37,
		dependencies: 6,
		'artifact-bytes:process': 2411520
	},
	unmeasured: { 'source-bytes': 'Not measured: src/parser/grammar.ts was not read.' },
	performance: []
};

const processUnit = {
	schemaVersion: 1,
	id: 'tool.budget-report',
	kind: 'function',
	title: 'Budget report command',
	responsibility: 'Prints reviewed budget findings.',
	responsibilityOrigin: 'declared' as const,
	status: 'active' as const,
	owns: { source: ['src/tools/budget-report/main.ts'], symbols: ['main'] },
	contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
	dependencies: [],
	runtime: {
		kind: 'process',
		entry: 'dist/bin/budget-report',
		targets: [
			{ kind: 'process', entry: 'dist/bin/budget-report' },
			{ kind: 'process', entry: 'dist/bin/budget-report' },
			{ kind: 'module', entry: 'src/tools/budget-report/main.ts' }
		]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
} satisfies ComponentManifest;

test('Combines ledger reviews and removes repeated events', () => {
	const approval = {
		type: 'approval' as const,
		unit: 'function.budget-reviews',
		record: { id: 'record-2', commit: 'commit-2', tree: 'tree-2' },
		reviewer: 'Tomas Berg',
		reason: 'Reviewed source growth.',
		at: '2026-11-10T09:31:47.602Z',
		before: { 'source-bytes': 18432, complexity: 37, dependencies: 6 },
		after: { 'source-bytes': 19104, complexity: 39, dependencies: 6 },
		performance: []
	};
	const actual = budgetReviews([
		[approval, baseline],
		[baseline, approval]
	]);
	const expected: BudgetReview[] = [
		{
			type: 'baseline' as const,
			commit: 'commit-1',
			record: 'record-1',
			reviewer: 'Priya Natarajan',
			reason: 'Limits frozen when the unit was first established.',
			at: baseline.at,
			after: baseline.metrics
		},
		{
			type: 'approval' as const,
			commit: 'commit-2',
			record: 'record-2',
			reviewer: 'Tomas Berg',
			reason: 'Reviewed source growth.',
			at: approval.at,
			before: approval.before,
			after: approval.after
		}
	];
	expect(actual.get('function.budget-reviews')).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'function.budget-reviews',
			symbol: 'budgetReviews',
			state: 'combines-ledger-reviews-and-removes-repeated-events',
			evidence: 'examples-cases',
			file: 'combines-ledger-reviews-and-removes-repeated-events.json'
		},
		[
			{
				name: 'duplicate baseline and approval across revisions',
				input: [
					[approval, baseline],
					[baseline, approval]
				],
				output: expected
			}
		]
	);
});

test('Selects source limits and their unmeasured reasons', () => {
	const actual = frozenLimits(frozen);
	const expected: FrozenLimits = {
		metrics: { 'source-bytes': 18432, complexity: 37, dependencies: 6 },
		unmeasured: { 'source-bytes': 'Not measured: src/parser/grammar.ts was not read.' }
	};
	expect(actual).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'function.budget-reviews',
			symbol: 'frozenLimits',
			state: 'selects-source-limits-and-their-unmeasured-reasons',
			evidence: 'examples-cases',
			file: 'selects-source-limits-and-their-unmeasured-reasons.json'
		},
		[
			{
				name: 'source metrics are retained and emitted metrics omitted',
				input: frozen,
				output: expected
			}
		]
	);
});

test('Selects emitted limits for distinct executable targets', () => {
	const emittedBaseline = {
		metrics: { 'artifact-bytes:process': 2411520 },
		performance: []
	};
	const actual = emittedLimits(processUnit, emittedBaseline);
	const expected: EmittedLimits = { limits: { process: 2411520 } };
	expect(actual).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'function.budget-reviews',
			symbol: 'emittedLimits',
			state: 'selects-emitted-limits-for-distinct-executable-targets',
			evidence: 'examples-cases',
			file: 'selects-emitted-limits-for-distinct-executable-targets.json'
		},
		[
			{
				name: 'duplicate process targets produce one reviewed limit',
				input: { unit: processUnit, baseline: emittedBaseline },
				output: expected
			}
		]
	);
});
