import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { coverageAffected, explorerCoverage } from '../../src/utils/explorerCoverage';
import type { HarnessRecord, HarnessRevision } from '../../src/models/explorer-ui/Harness.types';
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

type Cases = Parameters<typeof recordExampleCases>[1];
type Comparison = NonNullable<HarnessRevision['comparison']>;
const unitId = 'page.titles';
const subject = 'reports.function.explorer-coverage';
const page = unit(unitId, 'page');
const captured = (state: string, symbol: string, cases: Cases) =>
	recordExampleCases(
		{ unitId: subject, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const lists = (direct: string[] = []) => ({ direct, indirect: [], added: [], removed: [] });
const comparison = (extra: Partial<Comparison> = {}): Comparison => ({
	base: sha('b'),
	record: 'r1',
	units: lists(),
	scenarios: [],
	uncertain: [],
	...extra
});
const affected = (extra: Partial<HarnessRevision>, rec: HarnessRecord = record([])) =>
	coverageAffected(revision([page], [], [rec], extra), rec, unitId);
const standingOf = (value: unknown) => (value as { standing: string }).standing;

/** The name of what a call threw, or a note that it returned; the call is made once. */
function thrownName(call: () => unknown): string {
	try {
		call();
	} catch (error) {
		return (error as Error).constructor.name;
	}
	return 'nothing thrown';
}

/** A record whose one result is inherited from origin commit b, with captures of that commit. */
const inherited = () =>
	record([
		result(
			complete().map((item) => ({ ...item, server: { buildId: 'build-0', revision: sha('b') } })),
			{
				status: 'referenced',
				inherited: true,
				originTests: [{ id: 'titles-page:page', status: 'passed' }],
				testedRevision: sha('b'),
				origin: { record: 'r0', commit: sha('b') }
			}
		)
	]);

test('A comparison of the judging record decides impact ahead of first-parent source impact', () => {
	const cases: Cases = [
		{
			name: 'own comparison lists the unit; source impact omits it',
			input: 'comparison r1 lists page.titles',
			output: affected({
				comparison: comparison({ units: lists([unitId]) }),
				sourceImpact: impacted(sha('b'))
			})
		},
		{
			name: 'own comparison omits the unit; source impact lists it',
			input: 'comparison r1 omits page.titles',
			output: affected({
				comparison: comparison(),
				sourceImpact: impacted(sha('b'), [unitId])
			})
		},
		{
			name: "another record's comparison is ignored, so source impact decides",
			input: 'comparison r9 omits page.titles',
			output: affected({
				comparison: comparison({ record: 'r9' }),
				sourceImpact: impacted(sha('b'), [unitId])
			})
		}
	];
	expect(cases.map((item) => item.output)).toEqual([true, false, true]);
	captured('impact-prefers-record-comparison', 'coverageAffected', cases);
});

test('Source impact applies only on the record base, and a missing unit list yields null', () => {
	const unlisted = { ...comparison(), units: undefined } as unknown as Comparison;
	const brokenRecord = { ...record([]), source: undefined } as unknown as HarnessRecord;
	const thrown = thrownName(() => affected({ sourceImpact: null }, brokenRecord));
	const cases: Cases = [
		{
			name: 'source impact on the record base lists the unit',
			input: 'source base equals record base',
			output: affected({ sourceImpact: impacted(sha('b'), [unitId]) })
		},
		{
			name: 'source impact on another base is not applied',
			input: 'source base differs from record base',
			output: affected({ sourceImpact: impacted(sha('c'), [unitId]) })
		},
		{
			name: 'no comparison and no source impact',
			input: 'neither present',
			output: affected({ comparison: null, sourceImpact: null })
		},
		{
			name: 'own comparison without unit lists',
			input: 'comparison r1 with units missing',
			output: affected({ comparison: unlisted, sourceImpact: impacted(sha('b'), [unitId]) })
		},
		{ name: 'record without a source', input: 'record.source is undefined', error: thrown }
	];
	expect(cases.slice(0, 4).map((item) => item.output)).toEqual([true, null, null, null]);
	expect(thrown).toBe('TypeError');
	captured('source-impact-needs-record-base', 'coverageAffected', cases);
});

test('A unit with every check passed and no impact is covered at its commit', () => {
	const judged = record([result(complete())]);
	const detail = revision([page], [], [judged], { sourceImpact: impacted(sha('b')) });
	const whole = explorerCoverage(detail, judged, unitId)(declared());
	expect(whole).toMatchObject({
		scenario: 'titles-page',
		standing: 'passed',
		reasons: [],
		tests: [{ id: 'page', status: 'passed' }],
		inheritedFrom: null
	});
	const origin = inherited();
	const impact = { sourceImpact: impacted(sha('b')) };
	const kept = explorerCoverage(revision([page], [], [origin], impact), origin, unitId)(declared());
	expect(kept).toMatchObject({ standing: 'passed', inheritedFrom: sha('b') });
	captured('recorded-unaffected-unit-passes', 'explorerCoverage', [
		{ name: 'complete record, unit unaffected', input: 'titles-page', output: whole },
		{ name: 'inherited record, unit unaffected', input: 'titles-page', output: kept }
	]);
});

test('Without a record every declared state is missing and the standing is missing', () => {
	const whole = explorerCoverage(revision([page], [], [], {}), null, unitId)(declared());
	expect(whole).toMatchObject({ standing: 'missing', inheritedFrom: null });
	expect(whole.states.map((state) => state.standing)).toEqual(['missing']);
	expect(whole.tests).toEqual([{ id: 'page', status: null }]);
	captured('no-record-marks-states-missing', 'explorerCoverage', [
		{ name: 'no record for the commit', input: 'record null', output: whole }
	]);
});

test('A failed, absent or undeclared check, or an unrecorded state, blocks a pass', () => {
	const failed = { id: 'titles-page:page', kind: 'e2e', target: 'page', durationMs: 1 };
	const judge = (rec: HarnessRecord, scenario = declared()) =>
		explorerCoverage(revision([page], [], [rec], {}), rec, unitId)(scenario);
	const cases: Cases = [
		{
			name: 'declared test failed',
			input: 'titles-page:page failed',
			output: judge(record([result(complete())], { tests: [{ ...failed, status: 'failed' }] }))
		},
		{
			name: 'declared test not recorded',
			input: 'no titles-page:page',
			output: judge(record([result(complete())], { tests: [] }))
		},
		{
			name: 'required state not recorded',
			input: 'states []',
			output: judge(record([result(complete(), { states: [] })]))
		},
		{
			name: 'scenario declares no test',
			input: 'tests []',
			output: judge(record([result(complete())]), declared({ tests: [] }))
		},
		{
			name: 'scenario has no result in the record',
			input: 'other-page',
			output: judge(record([result(complete())]), declared({ id: 'other-page' }))
		}
	];
	const standings = cases.map((item) => standingOf(item.output));
	expect(standings).toEqual(['failed', 'incomplete', 'incomplete', 'incomplete', 'incomplete']);
	captured('failed-or-unrecorded-checks-block-pass', 'explorerCoverage', cases);
});

test('An inherited result stands only when a recorded impact leaves the unit alone', () => {
	const origin = inherited();
	const judge = (impact: ReturnType<typeof impacted> | null) =>
		explorerCoverage(
			revision([page], [], [origin], { sourceImpact: impact }),
			origin,
			unitId
		)(declared());
	const cases: Cases = [
		{
			name: 'impact lists the unit at the origin base',
			input: 'impacted(b, [page.titles])',
			output: judge(impacted(sha('b'), [unitId]))
		},
		{ name: 'no impact recorded', input: 'sourceImpact null', output: judge(null) },
		{
			name: 'impact leaves the unit alone',
			input: 'impacted(b, [])',
			output: judge(impacted(sha('b')))
		}
	];
	expect(cases.map((item) => standingOf(item.output))).toEqual(['stale', 'stale', 'passed']);
	captured('inherited-result-stands-only-unaffected', 'explorerCoverage', cases);
});
