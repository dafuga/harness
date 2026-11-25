import { test } from 'vitest';
import type { HarnessCapture, HarnessScenario } from '../../src/models/explorer-ui/Harness.types';
import type { CoverageStanding } from '../../src/models/explorer-ui/ExplorerEvidence.types';
import {
	captureUnbound,
	coverageWorst,
	explorerState,
	reasonText,
	scenarioFor
} from '../../src/utils/explorer-ui/explorerState';
import type { Judged, Told } from '../../src/utils/explorer-ui/explorerState';
import { capture, declared, record, result, sha, unit } from '../explorerFixture';
import { clipSlots, clips, failedSecond, videoJudge } from '../explorerVideoCoverageFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type {
	Case,
	State,
	Selection,
	Recorded,
	Judging
} from './reports.function.explorer-state.test.types';

const unitId = 'reports.function.explorer-state';
const commit = sha('a');
const other = { buildId: 'build-2', revision: sha('c') };
const otherReason = 'is of a build of ccccccc, not of aaaaaaa';
const unbuiltReason = 'names no build, so it is bound to no commit';
const file = 'packages/reports/src/utils/a.ts';

const base = { unitId, evidence: 'examples-cases' };
/** One trace per symbol: the cases of that named symbol, recorded under one state. */
function recording(symbol: string, state: string, cases: Case[]): void {
	recordExampleCases({ ...base, symbol, state, file: `${state}.json` }, cases);
}

/** A capture with no recorded build, as a trace or an unstamped screenshot is. */
const unstamped = (extra: Partial<HarnessCapture> = {}) =>
	({ ...capture(extra), server: undefined }) as HarnessCapture;

const registry = [
	unit('page.functions', 'page'),
	unit('page.function', 'page', { dependencies: [{ unit: 'function.route', via: 'import' }] }),
	unit('function.route', 'function')
];
const catalog: State = { id: 'catalog', coverage: 'required', units: ['page.functions'] };
const entity: State = { id: 'entity', coverage: 'required', units: ['page.function'] };
const shared: State = { id: 'shared', coverage: 'required' };
const screens = declared({
	id: 'explorer',
	title: 'Explorer',
	units: ['page.functions', 'page.function', 'function.route'],
	states: [catalog, entity, shared],
	evidence: [{ id: 'screens', kind: 'screenshot', states: ['catalog'], viewports: ['desktop'] }]
});

function selections(rows: Selection[]): Case[] {
	const cases = rows.map(([name, target, units]) => ({
		name,
		input: { unit: target, units: units ?? [] },
		output: scenarioFor(screens, target, units)
	}));
	const ids = cases.map((item) => item.output.states.map((state) => state.id));
	expect(ids).toEqual(rows.map((row) => row[3]));
	return cases;
}

const every = ['catalog', 'entity', 'shared'];

test('a page is shown by the states that name it and by the state that names no unit', () => {
	const cases = selections([
		['catalog page', 'page.functions', registry, ['catalog', 'shared']],
		['entity page', 'page.function', registry, ['entity', 'shared']]
	]);
	recording('scenarioFor', 'explorer-state-page-states', cases);
});

test('a function is shown by the page that uses it, and by every state when none does', () => {
	const cases = selections([
		['function used by a page', 'function.route', registry, ['entity']],
		['function no unit uses', 'function.orphan', registry, every],
		['function without a registry', 'function.route', undefined, every]
	]);
	recording('scenarioFor', 'explorer-state-function-states', cases);
});

test('the worst standing wins in the fixed order, and inapplicable is never worst', () => {
	const rows: Array<[string, CoverageStanding[], CoverageStanding]> = [
		['failure outranks the others', ['passed', 'incomplete', 'failed', 'stale'], 'failed'],
		['stale outranks missing', ['missing', 'stale'], 'stale'],
		['missing outranks incomplete', ['incomplete', 'missing', 'passed'], 'missing'],
		['incomplete outranks passed', ['passed', 'incomplete'], 'incomplete'],
		['inapplicable ignored beside passed', ['inapplicable', 'passed'], 'passed'],
		['only inapplicable is inapplicable', ['inapplicable'], 'inapplicable'],
		['no standing is inapplicable', [], 'inapplicable']
	];
	const cases = rows.map(([name, s]) => ({ name, input: s, output: coverageWorst(s) }));
	expect(cases.map((item) => item.output)).toEqual(rows.map((row) => row[2]));
	recording('coverageWorst', 'explorer-state-worst-standing', cases);
});

test('a reason drops a located phrase and turns any other file path into a file', () => {
	const rows: Array<[string, string, string]> = [
		['located phrase dropped', `The report changed in ${file}`, 'The report changed'],
		['other path becomes a file', `See ${file} for details`, 'See a file for details'],
		['file name with no folder kept', 'See explorerState.ts', 'See explorerState.ts'],
		['text with no path kept', 'No capture of Explorer.', 'No capture of Explorer.'],
		['empty reason stays empty', '', '']
	];
	const cases = rows.map(([name, input]) => ({ name, input, output: reasonText(input) }));
	expect(cases.map((item) => item.output)).toEqual(rows.map((row) => row[2]));
	recording('reasonText', 'explorer-state-reason-text', cases);
});

test('a capture is unbound by another build, or by no build where one is needed', () => {
	const actual = unstamped({ kind: 'trace', provenance: 'actual-capture' });
	const rows: Array<[string, HarnessCapture, string | null]> = [
		['capture of its commit is bound', capture(), null],
		['another build names both revisions', capture({ server: other }), otherReason],
		['screenshot with no build', unstamped(), unbuiltReason],
		['trace with no build or provenance', unstamped({ kind: 'trace' }), null],
		['actual-capture trace, no build', actual, unbuiltReason],
		['trace stamped with another build', capture({ kind: 'trace', server: other }), otherReason]
	];
	const cases = rows.map(([name, cap]) => ({
		name,
		input: { capture: cap, commit },
		output: captureUnbound(cap, commit)
	}));
	expect(cases.map((item) => item.output)).toEqual(rows.map((row) => row[2]));
	recording('captureUnbound', 'explorer-state-capture-binding', cases);
});

const pending: State = { id: 'pending', coverage: 'required' };
const skipped: State = { id: 'skipped', coverage: 'inapplicable', reason: 'Never shown.' };
const partial: State = { id: 'partial', coverage: 'partial', reason: 'Only desktop is kept.' };
const coverage = declared({
	id: 'explorer',
	title: 'Explorer',
	units: ['page.functions'],
	states: [catalog, pending, skipped, partial],
	evidence: [{ id: 'screens', kind: 'screenshot', states: ['catalog'], viewports: ['desktop'] }]
});
function judge(states: Recorded): Judged {
	const scenario = result([], { states });
	return { declared: coverage, result: scenario, record: record([scenario]), bound: commit };
}

/** Judges each row's state against the absent fallback and checks standing and reasons. */
function judging(state: string, absent: Told, rows: Judging[]): void {
	const cases = rows.map(([name, judged, declaredState]) => ({
		name,
		input: { judged, declared: declaredState, absent },
		output: explorerState(judged, declaredState, absent)
	}));
	const got = cases.map(({ output }) => [output.standing, output.reasons]);
	expect(got).toEqual(rows.map((row) => [row[3], row[4] ?? []]));
	recording('explorerState', state, cases);
}

const at = 'The capture of Explorer: catalog at desktop';
const lacks = ['Explorer: catalog has no result in the record.'];
const undecided = ['Explorer: partial is declared and not covered. Only desktop is kept.'];
const partialCatalog = ['Explorer: catalog was recorded as partial, not as covered.'];
const noEvidence = ['Explorer: pending declares no evidence to record.'];
const stale = [`${at} ${otherReason}.`];
const rejected = [`${at} was rejected.`];
const unstored = [`${at} is not stored: no bytes.`];
const noCapture = ['No capture of Explorer: catalog at desktop.'];

test('a state without a judged result takes its fallback, never its discarded reason', () => {
	const partialRecord = judge([{ id: 'catalog', coverage: 'partial', captures: [] }]);
	const noEvidenceRecord = judge([{ id: 'pending', coverage: 'required', captures: [] }]);
	judging(
		'explorer-state-fallbacks',
		['missing', 'discarded'],
		[
			['no judged result takes absent', null, catalog, 'missing'],
			['inapplicable is exempt', null, skipped, 'inapplicable'],
			['record lacks the state', judge([]), catalog, 'missing', lacks],
			['undecided declaration is incomplete', judge([]), partial, 'incomplete', undecided],
			['recorded as partial, not covered', partialRecord, catalog, 'incomplete', partialCatalog],
			['no evidence to record', noEvidenceRecord, pending, 'incomplete', noEvidence]
		]
	);
});

test('a required state passes only with passed, stored, bound captures in every slot', () => {
	const withCaptures = (captures: HarnessCapture[]) =>
		judge([{ id: 'catalog', coverage: 'required', captures }]);
	const gapped = capture({ media: null, gap: 'no bytes' });
	judging(
		'explorer-state-slot-binding',
		['incomplete', ''],
		[
			['bound passed capture', withCaptures([capture()]), catalog, 'passed'],
			['other build is stale', withCaptures([capture({ server: other })]), catalog, 'stale', stale],
			[
				'rejected capture',
				withCaptures([capture({ status: 'failed' })]),
				catalog,
				'failed',
				rejected
			],
			['unstored capture', withCaptures([gapped]), catalog, 'missing', unstored],
			['no capture for a slot', withCaptures([]), catalog, 'incomplete', noCapture],
			['each clip has its own capture', videoJudge(clips), catalog, 'passed'],
			['missing second clip', videoJudge([clips[0]]), catalog, 'incomplete', noCapture],
			['rejected second clip', videoJudge([clips[0], failedSecond]), catalog, 'failed', rejected]
		]
	);
	expect(clipSlots(videoJudge(clips))).toEqual(['use-first', 'use-second']);
});
