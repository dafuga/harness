import type {
	CoverageStanding,
	ExplorerScenarioCoverage,
	ExplorerVerdict
} from '../../models/Explorer.types.ts';
import type { HarnessRecord, HarnessRevision, HarnessUnit } from '../../models/Harness.types.ts';
import { explorerCoverage } from './explorerCoverage';
import { coverageWorst, reasonText } from '../explorerState';

type Kind = CoverageStanding | 'unusable';

type Reason = [Kind, string];

/** The worst kind of reason names the verdict; the order is from worst to least. */
const labels: Array<[Kind, string]> = [
	['unusable', 'Evidence unusable'],
	['failed', 'Verification failed'],
	['stale', 'Evidence stale'],
	['missing', 'Evidence missing'],
	['incomplete', 'Coverage incomplete']
];

/** Gates a record must state; those of scenarios and budgets are judged for each unit below. */
const required = ['tests', 'scenarios'];

const scoped = ['scenarios', 'budgets'];

const settled = ['passed', 'unavailable'];

/**
 * The one record that judges a revision: the newest one of exactly its commit that could be
 * validated. The badge, the measurements and the evidence of a revision all read this record.
 */
export function verdictRecord(detail: HarnessRevision): HarnessRecord | null {
	const usable = detail.records.filter(
		(record) => record.valid && record.source.commit === detail.commit
	);
	return usable.sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))[0] ?? null;
}

/** Why a revision has no record to judge by. */
function unjudged(detail: HarnessRevision): Reason {
	if (!detail.registry.available) {
		return ['missing', detail.registry.gap ?? 'No unit registry is stored at this revision.'];
	}
	if (detail.records.length === 0) {
		return ['missing', 'No verification record is attached to this commit.'];
	}
	const problems = detail.records.flatMap((record) => record.problems);
	return ['unusable', `No record of this commit could be validated: ${problems.join('; ')}`];
}

/** What a record must state before anything in it is believed: its gates, and those it needs. */
function gates(record: HarnessRecord): Reason[] {
	if (!record.gates)
		return [['unusable', 'The record states no gates, so nothing in it is judged.']];
	const stated = record.gates;
	const absent = required
		.filter((name) => !(name in stated))
		.map((name): Reason => ['unusable', `The record states no ${name} gate.`]);
	const failed = Object.entries(stated)
		.filter(([name, status]) => status !== 'passed' && !scoped.includes(name))
		.map(([name]): Reason => ['failed', `The ${name} gate of the record failed.`]);
	return [...absent, ...failed];
}

/** Direct failures affect every unit; inherited checks are judged within their owning scenario. */
function tests(record: HarnessRecord, coverage: ExplorerScenarioCoverage[]): Reason[] {
	const inherited = coverage.some(
		(item) => item.inheritedFrom && item.tests.some((test) => test.status !== null)
	);
	if (record.tests.length === 0 && !inherited) return [['incomplete', 'The record ran no test.']];
	const open = record.tests.filter((test) => test.status !== 'passed');
	// A check of a scenario has a logical name; a test file is counted, and located elsewhere.
	const files = open.filter((test) => test.id.includes('/')).length;
	const counted: Reason[] =
		files > 0
			? [['failed', `${files} ${files === 1 ? 'test' : 'tests'} of the record did not pass.`]]
			: [];
	const named = open
		.filter((test) => !test.id.includes('/'))
		.map((test): Reason => ['failed', `Test ${test.id} is ${test.status}, not passed.`]);
	return [...named, ...counted];
}

/** The findings of the record about the limits of this unit that are not settled. */
function budgets(record: HarnessRecord, unit: string): Reason[] {
	return record.budgets.findings
		.filter((finding) => finding.unit === unit && !settled.includes(finding.status))
		.map((finding): Reason => {
			const detail = finding.detail ? ` (${finding.detail})` : '';
			return ['failed', `The limit of ${finding.metric} is ${finding.status}${detail}.`];
		});
}

/** What the record itself says failed about this unit: its failures that begin with the unit. */
function failures(record: HarnessRecord, unit: string): Reason[] {
	return record.failures
		.filter((failure) => failure.startsWith(`${unit}: `))
		.map((failure): Reason => ['failed', failure]);
}

/** Each scenario that is not proven, as a reason of its worst kind with all it says. */
function unproven(coverage: ExplorerScenarioCoverage[]): Reason[] {
	return coverage
		.filter((item) => item.standing !== 'passed')
		.flatMap((item) =>
			[...item.reasons, ...item.states.flatMap((state) => state.reasons)].map(
				(text): Reason => [item.standing, text]
			)
		);
}

function judge(reasons: Reason[]): ExplorerVerdict {
	const worst = labels.find(([kind]) => reasons.some(([found]) => found === kind));
	return {
		passed: !worst,
		label: worst ? worst[1] : 'Full coverage passed',
		reasons: [...new Set(reasons.map(([, text]) => reasonText(text)))].filter(Boolean)
	};
}

/**
 * Each scenario that covers a unit at a revision, judged state by state against the record that
 * judges the revision. Without a registry there is none; without a usable record every declared
 * state is missing its proof. This is what a reader is shown under a verdict, as typed standings.
 */
export function verdictCoverage(
	unit: Pick<HarnessUnit, 'id'>,
	detail: HarnessRevision
): ExplorerScenarioCoverage[] {
	if (!detail.registry.available) return [];
	const record = verdictRecord(detail);
	const absent = record ? undefined : unjudged(detail);
	const standing = absent?.[0] === 'unusable' ? 'missing' : (absent?.[0] ?? 'missing');
	return detail.registry.scenarios
		.filter((item) => item.units.includes(unit.id))
		.map(explorerCoverage(detail, record, unit.id, [standing, absent?.[1] ?? '']));
}

/**
 * Whether a unit is proven at a revision. It is only when the newest usable record of that
 * commit states its gates and passed them, holds fresh or inherited checks that passed where they
 * ran, at least one scenario covers the unit, every such scenario stands as explorerCoverage requires, the record says no
 * failure of the unit, and no limit of the unit is open. Anything missing, stale, failed, undeclared or unknown is not proven; nothing is
 * a share. No kind of unit is exempt: what no scenario covers is not proven by tests alone,
 * because the history does not record which tests cover which unit.
 */
export function explorerVerdict(unit: HarnessUnit, detail: HarnessRevision): ExplorerVerdict {
	const record = verdictRecord(detail);
	if (!detail.registry.available || !record) return judge([unjudged(detail)]);
	const coverage = verdictCoverage(unit, detail);
	const uncovered: Reason[] =
		coverage.length === 0
			? [['incomplete', 'No scenario covers this unit; tests alone do not show how it behaves.']]
			: [];
	const proven = coverageWorst(coverage.map((item) => item.standing));
	const vacuous: Reason[] =
		coverage.length > 0 && proven === 'inapplicable'
			? [['incomplete', 'Nothing that covers this unit applies, so nothing proves it.']]
			: [];
	return judge([
		...gates(record),
		...tests(record, coverage),
		...uncovered,
		...vacuous,
		...unproven(coverage),
		...failures(record, unit.id),
		...budgets(record, unit.id)
	]);
}
