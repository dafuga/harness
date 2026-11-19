import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entityRemoved } from '../../src/components/explorer-ui/entity-tests/entityRemoved';
import type {
	ExplorerCapture,
	ExplorerEvidence,
	ExplorerScenarioCoverage,
	ExplorerSide,
	ExplorerStateCoverage
} from '../../src/models/explorer-ui/Explorer.types';

type Cases = Parameters<typeof recordExampleCases>[1];

const unitId = 'reports.function.entity-removed';
const symbol = 'entityRemoved';
const record = (state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const ordersPage = 'Orders page over synthetic orders';
const checkout = 'Checkout over synthetic orders';
const commitA = '3f9c2a180ce54b0df3f6cadf02d1192568f6d7c6';
const commitB = '8b41d0720e252681deac809969b3faf8181dac30';

function stateOf(state: string): ExplorerStateCoverage {
	return { state, declared: 'required', standing: 'passed', reasons: [], slots: [] };
}

function scenarioOf(scenario: string, title: string, states: string[]): ExplorerScenarioCoverage {
	return {
		scenario,
		title,
		kind: 'ui',
		standing: 'passed',
		reasons: [],
		tests: [],
		inheritedFrom: null,
		states: states.map(stateOf)
	};
}

function side(
	commit: string,
	coverage: ExplorerScenarioCoverage[],
	captures: ExplorerCapture[] = []
): ExplorerSide {
	return { commit, detail: null, record: null, captures, coverage, gap: null };
}

function evidenceOf(before: ExplorerSide | null, after: ExplorerSide): ExplorerEvidence {
	return {
		mode: 'commit',
		scenarios: [],
		after,
		before,
		initial: before ? null : 'the first commit of the branch',
		incomparable: []
	};
}

/** The coverage a side declares, as scenario ids and state ids, for a case's input. */
const shape = (item: ExplorerSide | null) =>
	item?.coverage.map(({ scenario, states }) => ({
		scenario,
		states: states.map(({ state }) => state)
	})) ?? null;

/** One case: the two sides it was given, and the sentences the contract returns for them. */
function caseOf(name: string, before: ExplorerSide | null, after: ExplorerSide): Cases[number] {
	return {
		name,
		input: { before: shape(before), after: shape(after) },
		output: entityRemoved(evidenceOf(before, after))
	};
}

const orders = scenarioOf('orders-page', ordersPage, ['default', 'empty', 'denied']);
const pay = scenarioOf('checkout', checkout, ['pay', 'receipt']);

test('a dropped scenario or dropped states are told as gone, in coverage and state order', () => {
	const before = side(commitA, [orders, pay]);
	const trimmed = side(commitB, [scenarioOf('orders-page', ordersPage, ['default']), pay]);
	const dropsScenario = side(commitB, [orders]);
	const dropsBoth = side(commitB, [scenarioOf('orders-page', ordersPage, ['default'])]);
	const cases = [
		caseOf('two states of a kept scenario dropped', before, trimmed),
		caseOf('a whole scenario dropped with its states', before, dropsScenario),
		caseOf('a scenario and states dropped together', before, dropsBoth)
	];
	expect(cases.map(({ output }) => output)).toEqual([
		[`${ordersPage}: the state empty.`, `${ordersPage}: the state denied.`],
		[`${checkout}: the scenario, with its states pay, receipt.`],
		[
			`${ordersPage}: the state empty.`,
			`${ordersPage}: the state denied.`,
			`${checkout}: the scenario, with its states pay, receipt.`
		]
	]);
	record('removed-scenario-and-state', cases);
});

test('a state, scenario or capture the commit keeps or adds is never told as gone', () => {
	const kept = side(commitB, [orders, pay]);
	const captured: ExplorerCapture = {
		scenario: 'orders-page',
		state: 'default',
		standing: 'fresh',
		usable: true,
		current: true,
		inheritedFrom: null,
		capture: {
			evidence: 'examples-cases',
			kind: 'trace',
			state: 'default',
			status: 'passed',
			path: 'default.json',
			media: undefined,
			sha256: 'a'.repeat(64),
			mediaType: 'application/json',
			capturedAt: '2026-10-09T09:00:00.000Z'
		}
	};
	const added = side(commitB, [orders, pay, scenarioOf('filter', 'Filter', ['match'])]);
	const cases = [
		caseOf('same declarations on both sides', side(commitA, [orders, pay]), kept),
		caseOf('a scenario only the commit adds', side(commitA, [orders]), added),
		caseOf(
			'a capture on the selected commit is ignored',
			side(commitA, [orders]),
			side(commitB, [orders], [captured])
		)
	];
	for (const { output } of cases) expect(output).toEqual([]);
	record('present-entity-adds-nothing', cases);
});

test('a scenario is matched by its id, so a new id with the same title is a removal', () => {
	const before = side(commitA, [orders]);
	const renamed = side(commitB, [
		scenarioOf('orders-page-v2', ordersPage, ['default', 'empty', 'denied'])
	]);
	expect(entityRemoved(evidenceOf(before, renamed))).toEqual([
		`${ordersPage}: the scenario, with its states default, empty, denied.`
	]);
	record('scenario-matched-by-id', [
		caseOf('new id with the same title is a removal', before, renamed)
	]);
});

test('a first commit with no parent side has nothing removed', () => {
	const after = side(commitA, [orders, pay]);
	const cases = [caseOf('no parent side yields no removals', null, after)];
	expect(cases[0].output).toEqual([]);
	record('no-parent-revision', cases);
});
