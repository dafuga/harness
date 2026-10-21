import type {
	ExplorerScenarioCoverage,
	ExplorerStateCoverage
} from '../../../models/explorer-ui/Explorer.types';
import type {
	HarnessRecord,
	HarnessRevision,
	HarnessScenario
} from '../../../models/explorer-ui/Harness.types';
import { coverageWorst, scenarioFor, type Judged, type Told } from '../explorerState';
import { explorerState } from './explorerState';

type Result = HarnessRecord['scenarios'][number];

const short = (commit: string) => commit.slice(0, 7);

/**
 * Whether a commit affects a unit, by the impact that applies to the record: the comparison of
 * that record itself, else the impact against the first parent when that is the record's base.
 * Null when neither is there: what is not recorded cannot show that a unit was left alone.
 */
export function coverageAffected(
	detail: HarnessRevision,
	record: HarnessRecord,
	unit: string
): boolean | null {
	const own = detail.comparison?.record === record.id ? detail.comparison : null;
	const first = detail.sourceImpact?.base === record.source.base ? detail.sourceImpact : null;
	const units = (own ?? first)?.units;
	if (!units) return null;
	return [units.direct, units.indirect, units.added].some((list) => list.includes(unit));
}

/** Whether a result stands for the commit: passed here, or a reference bound to its origin. */
function lineage(judged: Judged, commit: string, affected: boolean | null): Told | null {
	const { declared, result } = judged;
	const title = declared.title;
	if (result.status === 'failed') return ['failed', `${title} failed.`];
	if (!result.inherited) {
		if (result.status !== 'passed')
			return ['stale', `${title} is a reference that names no origin.`];
		return result.testedRevision === commit
			? null
			: ['stale', `${title} was tested at ${short(result.testedRevision)}, not here.`];
	}
	const { origin } = result;
	if (result.status !== 'referenced' || !origin.record || result.testedRevision !== origin.commit) {
		return ['stale', `${title} is inherited, and its origin is not the record it names.`];
	}
	if (affected === null) {
		return [
			'stale',
			`${title} is inherited from ${short(origin.commit)}, and the history does not record what changed since.`
		];
	}
	return affected
		? ['stale', `${title} was inherited from ${short(origin.commit)}, but this commit affects it.`]
		: null;
}

/**
 * Each declared check of a scenario with its status where it ran: in this record, or, for an
 * inherited result, in the record it came from. Checks that did not run again here are not
 * asked of this record; an origin whose checks the history does not keep proves none of them.
 */
function tests(declared: HarnessScenario, record: HarnessRecord | null, result?: Result) {
	const inherited = result?.inherited === true;
	const ran = inherited ? result?.originTests : record?.tests;
	const list = declared.tests.map((test) => {
		const found = ran?.find((item) => item.id === `${declared.id}:${test.id}`);
		return {
			id: test.id,
			status: found?.status ?? null,
			...(found?.browserErrors ? { browserErrors: found.browserErrors } : {})
		};
	});
	const undeclared: Told[] =
		declared.tests.length === 0 ? [['incomplete', `${declared.title} declares no test.`]] : [];
	if (!record) return { list, told: undeclared };
	if (!ran) {
		const unkept = `${declared.title} is inherited, and the history does not record the checks its origin ran.`;
		return { list, told: [...undeclared, ['incomplete', unkept] as Told] };
	}
	const where = inherited ? 'the record it was inherited from' : 'this record';
	return { list, told: [...undeclared, ...list.flatMap((test) => ranAs(declared, test, where))] };
}

/** What is wrong with one declared check where it ran: it is not there, or it did not pass. */
function ranAs(
	declared: HarnessScenario,
	test: { id: string; status: string | null },
	where: string
): Told[] {
	const named = `${declared.id}:${test.id}`;
	if (test.status === null) return [['incomplete', `Test ${named} is not in ${where}.`]];
	return test.status === 'passed'
		? []
		: [['failed', `Test ${named} is ${test.status}, not passed.`]];
}

/** What stands in the way of a scenario before its states are looked at. */
function scenario(judged: Judged | null, declared: HarnessScenario, own: Told | null): Told[] {
	const required = declared.states.some((item) => item.coverage === 'required');
	return [
		...(declared.evidence
			? []
			: ([['incomplete', `${declared.title} declares no evidence.`]] as Told[])),
		...(required
			? []
			: ([['incomplete', `${declared.title} declares no state that must be covered.`]] as Told[])),
		...(judged
			? []
			: ([['incomplete', `${declared.title} has no result in the record.`]] as Told[])),
		...(own ? [own] : [])
	];
}

/**
 * One scenario that covers a unit, judged against a record, state by state. It stands only when
 * it declares a test, evidence and a state that must be covered; every declared test passed where
 * it ran, in this record or in the origin of an inherited result; its result passed at this commit, or is a reference whose origin is named
 * and which a recorded impact shows unaffected; and every required state was recorded as covered
 * with a passed, stored capture of each declared evidence, kind and viewport, of the commit that
 * produced the result. Without a record, `absent` says how every state stands. Nothing that is
 * undeclared, unrecorded or unknown counts as covered.
 */
export function explorerCoverage(
	detail: HarnessRevision,
	record: HarnessRecord | null,
	unit: string,
	absent: Told = ['missing', 'No verification record is attached to this commit.']
) {
	return (whole: HarnessScenario): ExplorerScenarioCoverage => {
		// A unit is judged by the states that show it, not by every state of the scenario.
		const declared = scenarioFor(whole, unit, detail.registry.units);
		if (!record) {
			const states = declared.states.map((item) => explorerState(null, item, [absent[0], '']));
			return summed(declared, null, {
				told: [absent],
				ran: tests(declared, null).list,
				states
			});
		}
		const result = record.scenarios.find((item) => item.id === declared.id);
		const judged = result ? bind(declared, result, record) : null;
		const own = judged ? standsFor(detail, judged, unit) : null;
		const ran = tests(declared, record, result);
		// A scenario that does not stand itself is not judged state by state: each takes its standing.
		const fallback: Told = [own?.[0] ?? 'incomplete', ''];
		const states = declared.states.map((item) =>
			explorerState(own ? null : judged, item, fallback)
		);
		const told = [...scenario(judged, declared, own), ...ran.told];
		return summed(declared, judged, { told, ran: ran.list, states });
	};
}

/** A scenario with everything that was found about it, and the worst of that as its standing. */
function summed(
	declared: HarnessScenario,
	judged: Judged | null,
	found: { told: Told[]; ran: ExplorerScenarioCoverage['tests']; states: ExplorerStateCoverage[] }
): ExplorerScenarioCoverage {
	const { told, states } = found;
	const standings = [...told.map(([standing]) => standing), ...states.map((item) => item.standing)];
	return {
		scenario: declared.id,
		title: declared.title,
		kind: declared.kind,
		standing: coverageWorst(standings),
		reasons: told.map(([, text]) => text),
		tests: found.ran,
		inheritedFrom: judged?.result.inherited ? judged.result.origin.commit : null,
		states
	};
}

/** Whether the result of a scenario stands for the commit of its record, for one unit. */
function standsFor(detail: HarnessRevision, judged: Judged, unit: string): Told | null {
	const { record } = judged;
	return lineage(judged, record.source.commit, coverageAffected(detail, record, unit));
}

/** A result with its record and the commit its captures must be of: its origin when inherited. */
function bind(declared: HarnessScenario, result: Result, record: HarnessRecord): Judged {
	const bound = result.inherited ? result.origin.commit : record.source.commit;
	return { declared, result, record, bound };
}
