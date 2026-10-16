import { expect, test } from 'vitest';
import type { HarnessRecord, HarnessRevision } from '../../src/models/Harness.types';
import { explorerVerdict, verdictCoverage } from '../../src/utils/explorerVerdict';
import {
	complete,
	declared,
	impacted,
	record,
	result,
	revision,
	sha,
	unit
} from '../explorerFixture';

const page = unit('page.titles', 'page');
const proven = (records: HarnessRecord[], extra: Partial<HarnessRevision> = {}) =>
	explorerVerdict(page, revision([page], [declared()], records, extra));
const reasons = (records: HarnessRecord[], extra: Partial<HarnessRevision> = {}) =>
	proven(records, extra).reasons.join(' | ');

test('a scenario that declares no test or no evidence for a required state is not complete', () => {
	const judged = (extra: Parameters<typeof declared>[0]) =>
		explorerVerdict(page, revision([page], [declared(extra)], [record([result(complete())])]));
	expect(judged({ tests: [] })).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	expect(judged({ evidence: undefined })).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
	expect(judged({ evidence: [] }).reasons.join(' ')).toContain('declares no evidence');
	// A headless scenario has no viewport to fall back on: nothing declared is nothing proven.
	const headless = declared({ kind: 'headless', viewports: [], evidence: undefined });
	const detail = revision([page], [headless], [record([result([])])]);
	expect(explorerVerdict(page, detail).passed).toBe(false);
});

test('a capture of another kind, without its build, or of a state not recorded as required fails', () => {
	const wrongKind = complete().map((item) => ({ ...item, kind: 'output' }));
	expect(proven([record([result(wrongKind)])])).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
	const unstamped = complete().map((item) => ({ ...item, server: undefined }));
	expect(proven([record([result(unstamped)])])).toMatchObject({
		passed: false,
		label: 'Evidence stale'
	});
	expect(reasons([record([result(unstamped)])])).toContain('names no build');
	const demoted = result(complete(), {
		states: [{ id: 'empty', coverage: 'missing', reason: 'Skipped.', captures: complete() }]
	});
	expect(proven([record([demoted])])).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
});

test('a fresh result of another revision is stale, and inherited proof needs its origin', () => {
	const elsewhere = result(complete(), { testedRevision: sha('b') });
	expect(proven([record([elsewhere])])).toMatchObject({ passed: false, label: 'Evidence stale' });
	const orphan = result(complete(), {
		status: 'referenced',
		inherited: true,
		originTests: [{ id: 'titles-page:page', status: 'passed' }],
		testedRevision: sha('b'),
		origin: { record: '', commit: sha('b') }
	});
	expect(proven([record([orphan])])).toMatchObject({ passed: false, label: 'Evidence stale' });
});

const origin = { record: 'r0', commit: sha('b') };
const older = () =>
	complete().map((item) => ({ ...item, server: { buildId: 'build-0', revision: sha('b') } }));
const inherited = (extra: Parameters<typeof result>[1] = {}) =>
	record([
		result(older(), {
			status: 'referenced',
			inherited: true,
			originTests: [{ id: 'titles-page:page', status: 'passed' }],
			testedRevision: sha('b'),
			origin,
			...extra
		})
	]);

test('a result must say it passed here, or be a reference that says where it came from', () => {
	const mislabelled = record([result(complete(), { status: 'referenced' })]);
	expect(proven([mislabelled]).passed).toBe(false);
	const claimed = record([
		result(older(), {
			inherited: true,
			originTests: [{ id: 'titles-page:page', status: 'passed' }],
			testedRevision: sha('b'),
			origin
		})
	]);
	expect(proven([claimed], { sourceImpact: impacted(sha('b')) }).passed).toBe(false);
});

test('a scenario with no state that must be covered proves nothing', () => {
	const judged = (states: Array<{ id: string; coverage: string }>) =>
		explorerVerdict(
			page,
			revision([page], [declared({ states })], [record([result(complete(), { states: [] })])])
		);
	expect(judged([])).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	expect(judged([{ id: 'offline', coverage: 'inapplicable' }]).passed).toBe(false);
	expect(judged([]).reasons.join(' ')).toContain('no state that must be covered');
});

test('every declared test of the scenario must be in the record and passed; another test is not it', () => {
	const unrelated = [
		{
			id: 'other.test.ts',
			kind: 'unit',
			target: 'other.test.ts',
			status: 'passed' as const,
			durationMs: 1
		}
	];
	const absent = record([result(complete())], { tests: unrelated });
	expect(proven([absent])).toMatchObject({ passed: false, label: 'Coverage incomplete' });
	expect(proven([absent]).reasons.join(' ')).toContain('titles-page:page');
	const failed = [
		...unrelated,
		{ ...unrelated[0], id: 'titles-page:page', status: 'failed' as const }
	];
	expect(proven([record([result(complete())], { tests: failed })])).toMatchObject({
		passed: false,
		label: 'Verification failed'
	});
});

test('inheritance is not shown unaffected by an impact that is missing or of another base', () => {
	expect(proven([inherited()])).toMatchObject({ passed: false, label: 'Evidence stale' });
	expect(proven([inherited()]).reasons.join(' ')).toContain('does not record what changed');
	expect(proven([inherited()], { sourceImpact: impacted(sha('c')) }).passed).toBe(false);
	expect(proven([inherited()], { sourceImpact: impacted(sha('b')) }).passed).toBe(true);
	// The comparison of the judging record itself is the impact that applies to it.
	const own = {
		base: sha('9'),
		record: 'r1',
		units: impacted(null).units,
		scenarios: [],
		uncertain: []
	};
	expect(proven([inherited()], { comparison: own }).passed).toBe(true);
	const hit = { ...own, units: { ...own.units, indirect: ['page.titles'] } };
	expect(proven([inherited()], { comparison: hit }).passed).toBe(false);
});

test('inherited captures must be those of the commit the result names as its origin', () => {
	const known = { sourceImpact: impacted(sha('b')) };
	expect(proven([inherited({ testedRevision: sha('c') })], known).passed).toBe(false);
	expect(proven([inherited({ origin: { record: 'r0', commit: sha('a') } })], known).passed).toBe(
		false
	);
	const foreign = record([
		result(complete(), {
			status: 'referenced',
			inherited: true,
			originTests: [{ id: 'titles-page:page', status: 'passed' }],
			testedRevision: sha('b'),
			origin
		})
	]);
	expect(proven([foreign], known)).toMatchObject({ passed: false, label: 'Evidence stale' });
});

test('each state and each capture it must have is told in a typed way, not in words to be read', () => {
	const states = [
		{ id: 'empty', coverage: 'required' },
		{ id: 'error', coverage: 'missing', reason: 'Not captured yet.' },
		{ id: 'offline', coverage: 'inapplicable' }
	];
	const detail = revision([page], [declared({ states })], [record([result([complete()[0]])])]);
	const [covered] = verdictCoverage(page, detail);
	expect(covered).toMatchObject({
		scenario: 'titles-page',
		kind: 'ui',
		standing: 'incomplete',
		inheritedFrom: null
	});
	expect(covered.tests).toEqual([{ id: 'page', status: 'passed' }]);
	expect(covered.states.map((state) => [state.state, state.declared, state.standing])).toEqual([
		['empty', 'required', 'incomplete'],
		['error', 'missing', 'incomplete'],
		['offline', 'inapplicable', 'inapplicable']
	]);
	expect(
		covered.states[0].slots.map((slot) => [
			slot.viewport,
			slot.kind,
			slot.standing,
			Boolean(slot.capture)
		])
	).toEqual([
		['desktop', 'screenshot', 'passed', true],
		['mobile', 'screenshot', 'incomplete', false]
	]);
	const whole = revision([page], [declared()], [record([result(complete())])]);
	expect(verdictCoverage(page, whole)[0]).toMatchObject({ standing: 'passed', reasons: [] });
	// Without a record every declared state is missing its proof; none is assumed.
	const [bare] = verdictCoverage(page, revision([page], [declared()], []));
	expect(bare).toMatchObject({ standing: 'missing', tests: [{ id: 'page', status: null }] });
	expect(bare.states.map((state) => state.standing)).toEqual(['missing']);
});
