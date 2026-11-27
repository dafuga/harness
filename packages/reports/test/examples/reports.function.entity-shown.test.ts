import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entityShown } from '../../src/utils/explorer-ui/entityShown';
import { explorerEntities } from '../../src/utils/explorer-ui/explorerEntities';
import { record, revision } from '../entityFixture';
import { withFocused } from '../entityStates';
import { commits, ids } from '../entityUnits';
import type { Cases, Head, Shown, Entity } from './reports.function.entity-shown.test.types';

const unitId = 'reports.function.entity-shown';
const symbol = 'entityShown';
const tree = 'd'.repeat(40);

/** Records the single named symbol's cases for one state as a trace of inputs and results. */
function traceCases(state: string, cases: Cases): boolean {
	return recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

/** The shown revision as the Explorer holds it: its head, with no parent to compare against. */
const shownAt = (head: Head): Shown => ({ head, parent: null });

/** Rows, measures and the record id the Explorer draws; the full record is judged by its id. */
function shownOf(host: Shown, entity: Entity) {
	const shown = entityShown(host, entity);
	return { contract: shown.contract, measure: shown.measure, recordId: shown.record?.id ?? null };
}

const value = (rows: Array<{ label: string; value: string }>, label: string) =>
	rows.find((row) => row.label === label)?.value;
const entityOf = (head: Head, id: string): Entity =>
	explorerEntities(head).find((item) => item.id === id)!;

test('a function shows the record of its own commit with its contract and measured size', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const shown = shownOf(shownAt(head), entityOf(head, ids.filter));
	expect(value(shown.contract, 'Inputs')).toBe('orders, search text');
	expect(value(shown.contract, 'Output')).toBe('matching orders');
	expect(value(shown.measure.size, 'Source size')).toBe('800 B');
	expect(shown.recordId).toBe(record(commits.middle).id);
	traceCases('shown-record-of-own-commit', [
		{
			name: 'middle commit with its own passing record',
			input: { commit: commits.middle, unit: ids.filter, category: 'functions' },
			output: shown
		}
	]);
});

test('a commit with no record of its own has no verdict, not an earlier commit record', () => {
	const beside = revision(commits.tip, [record(commits.middle)]);
	const bare = revision(commits.tip, []);
	const cases = [beside, bare].map((head) => shownOf(shownAt(head), entityOf(head, ids.filter)));
	expect(cases.map((shown) => shown.recordId)).toEqual([null, null]);
	expect(value(cases[1].contract, 'Inputs')).toBe('orders, search text');
	traceCases('tip-without-own-record-has-no-verdict', [
		{
			name: 'tip with a record of the parent commit only',
			input: { commit: commits.tip, unit: ids.filter, records: 'parent' },
			output: cases[0]
		},
		{
			name: 'tip with no records at all',
			input: { commit: commits.tip, unit: ids.filter, records: 'none' },
			output: cases[1]
		}
	]);
});

test('a removed page keeps its last contract and is judged only by the shown commit', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const page = entityOf(head, ids.page);
	const removed = { ...page, change: 'removed' as const, lastAt: commits.first };
	const shown = shownOf(shownAt(head), removed);
	expect(value(shown.contract, 'Purpose')).toBe('Lists the orders of an account.');
	expect(shown.recordId).toBe(record(commits.middle).id);
	traceCases('removed-page-judged-by-shown-commit', [
		{
			name: 'removed page with its last commit before the shown one',
			input: { commit: commits.middle, unit: ids.page, change: 'removed' },
			output: shown
		}
	]);
});

test('the selected category chooses the contract rows of the same unit', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const filter = entityOf(head, ids.filter);
	const asFunction = shownOf(shownAt(head), filter);
	const asComponent = shownOf(shownAt(head), { ...filter, category: 'components' });
	const labels = (rows: Array<{ label: string }>) => rows.map(({ label }) => label);
	expect(labels(asFunction.contract)).toEqual(['Inputs', 'Output']);
	expect(labels(asComponent.contract)).toEqual(['Props']);
	expect(value(asComponent.contract, 'Props')).toBe('orders, search text');
	expect(asComponent.recordId).toBe(asFunction.recordId);
	traceCases('category-selects-contract-rows', [
		{
			name: 'function category shows inputs and output',
			input: { unit: ids.filter, category: 'functions' },
			output: asFunction
		},
		{
			name: 'component category shows props of the same unit',
			input: { unit: ids.filter, category: 'components' },
			output: asComponent
		}
	]);
});

const measurement = {
	unit: ids.page,
	metric: 'browser-navigation-ms',
	unitOfMeasure: 'ms',
	value: 12.5,
	workload: 'orders-page-desktop',
	profile: 'chromium',
	target: 'http' as const,
	testedRevision: commits.middle,
	artifacts: [],
	method: 'Chromium navigation duration of the original focused capture.'
};

/** A focused page revision whose observation was captured at the middle commit, under a given tree. */
function focusedHead(commit: string, headTree?: string): Head {
	const base = withFocused(revision(commits.middle, []));
	const green = {
		...base.regressions![0].green!,
		...(headTree ? { sourceTree: tree } : {}),
		measurements: [measurement]
	};
	return {
		...base,
		commit,
		...(headTree ? { sourceTree: headTree } : {}),
		regressions: [{ ...base.regressions![0], green }]
	};
}

test('focused figures count only for the same commit or an identical source tree', () => {
	const cases = [
		{ name: 'same commit as the observation', head: focusedHead(commits.middle) },
		{ name: 'identical source tree', head: focusedHead(commits.tip, tree) },
		{ name: 'changed source tree', head: focusedHead(commits.tip, 'e'.repeat(40)) }
	];
	const outputs = cases.map(({ head }) => shownOf(shownAt(head), entityOf(head, ids.page)));
	expect(outputs.map((shown) => shown.measure.performance.map((row) => row.value))).toEqual([
		['12.5 ms'],
		['12.5 ms'],
		[]
	]);
	expect(outputs.map((shown) => shown.recordId)).toEqual([null, null, null]);
	traceCases(
		'focused-figures-match-commit-or-tree',
		cases.map(({ name, head }, index) => ({
			name,
			input: { commit: head.commit, sourceTree: head.sourceTree ?? null },
			output: outputs[index]
		}))
	);
});
