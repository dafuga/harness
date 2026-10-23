import type { Named, ExplorerRevisions } from './explorerEvidence.types';
import type {
	ExplorerCapture,
	ExplorerEvidence,
	ExplorerScenarioCoverage,
	ExplorerScope,
	ExplorerSide
} from '../../models/explorer-ui/Explorer.types';
import type {
	HarnessRecord,
	HarnessRevision,
	HarnessScenario,
	HarnessUnit
} from '../../models/explorer-ui/Harness.types';
import { focusedCaptures, focusedScenario } from '../explorer-evidence/focusedCaptures';
import { captureProvenance } from '../reports-media/captureProvenance';
import { scenarioFor } from './explorerState';
import { verdictCoverage, verdictRecord } from './explorer-verdict/explorerVerdict';

const short = (commit: string) => commit.slice(0, 7);
const first = 'This is the first commit of its history: there is no parent to compare with.';
const unusable = 'No capture of this commit can be used: each is rejected, stale or not stored.';
/** The scenarios that cover a unit, each with the states that show that unit. */
const covering = (detail: HarnessRevision | null, unit: string) =>
	(detail?.registry.scenarios ?? [])
		.filter((item) => item.units.includes(unit))
		.map((item) => scenarioFor(item, unit, detail?.registry.units));

/**
 * The captures the record holds for the scenarios that cover a unit. One is usable only when the
 * coverage of its state found it passed, stored and bound to the commit that produced it; it is
 * current only when that commit is the commit of this side, so inherited proof is never current.
 */
function captures(record: HarnessRecord, coverage: ExplorerScenarioCoverage[]): ExplorerCapture[] {
	const proven = new Set(
		coverage.flatMap((item) =>
			item.states.flatMap((state) =>
				state.slots.filter((slot) => slot.standing === 'passed').map((slot) => slot.capture)
			)
		)
	);
	return coverage.flatMap((item) => {
		const result = record.scenarios.find((found) => found.id === item.scenario);
		if (!result) return [];
		// Only the states that show the unit: another screen of the scenario is not its capture.
		const shows = new Set(item.states.map((state) => state.state));
		const own = result.states.filter((state) => shows.has(state.id));
		return own.flatMap((state) =>
			state.captures.map((capture): ExplorerCapture => {
				const usable = proven.has(capture);
				return {
					scenario: item.scenario,
					state: state.id,
					capture,
					standing: captureProvenance(record, result, capture).standing,
					usable,
					current: usable && !result.inherited,
					inheritedFrom: result.inherited ? result.origin.commit : null
				};
			})
		);
	});
}

/** Why a stored revision shows nothing for a unit, before its captures are looked at. */
function unrecorded(detail: HarnessRevision, record: HarnessRecord | null, unit: string) {
	if (!detail.registry.available) {
		return detail.registry.gap ?? 'No unit registry is stored at this revision.';
	}
	if (!record) {
		return detail.records.length === 0
			? 'No verification record is attached to this commit.'
			: 'No record of this commit could be validated.';
	}
	return covering(detail, unit).length > 0 ? null : 'No scenario covers this unit at this commit.';
}

/**
 * One side: the stored revision of exactly this commit, the one record that judges it, the
 * coverage of each scenario and the captures of the unit. A revision of another commit is
 * refused, so nothing stands in for it.
 */
function side(
	commit: string,
	detail: HarnessRevision | null | undefined,
	unit: Named
): ExplorerSide {
	if (!detail || detail.commit !== commit) {
		const gap = `Revision ${short(commit)} is not available here; no other revision is shown in its place.`;
		return { commit, detail: null, record: null, captures: [], coverage: [], gap };
	}
	const record = verdictRecord(detail);
	const coverage = verdictCoverage(unit, detail);
	const gap = unrecorded(detail, record, unit.id);
	const found = [
		...focusedCaptures(detail, unit.id),
		...(gap === null && record ? captures(record, coverage) : [])
	];
	const none =
		found.length === 0 ? 'The record of this commit holds no capture for this unit.' : null;
	const usable = found.some((item) => item.usable);
	return {
		commit,
		detail,
		record,
		captures: found,
		coverage,
		gap: usable ? null : (gap ?? none ?? unusable)
	};
}

/** The entries of both lists, each id once: those of the first, then what only the second has. */
function united<Item extends Named>(now: Item[], was: Item[]): Item[] {
	return [...now, ...was.filter((item) => !now.some((found) => found.id === item.id))];
}

/** A scenario as both sides declare it, so a state or a viewport one side dropped stays. */
function merged(now: HarnessScenario, was: HarnessScenario | undefined): HarnessScenario {
	if (!was) return now;
	return {
		...now,
		states: united(now.states, was.states),
		viewports: united(now.viewports, was.viewports),
		evidence: united(now.evidence ?? [], was.evidence ?? [])
	};
}

/** Why one scenario is not the same run on both sides: its viewport sizes or its tests differ. */
function redefined(now: HarnessScenario, was: HarnessScenario): string[] {
	const sizes = now.viewports.flatMap((viewport) => {
		const before = was.viewports.find((item) => item.id === viewport.id);
		const same = !before || (before.width === viewport.width && before.height === viewport.height);
		const [old, next] = [before, viewport].map((item) => `${item?.width}×${item?.height}`);
		return same
			? []
			: [`${now.title}: viewport ${viewport.id} is ${old} before and ${next} after.`];
	});
	const tests = JSON.stringify(now.tests) === JSON.stringify(was.tests);
	return tests ? sizes : [...sizes, `${now.title} runs other tests after than before.`];
}

/** Why the two sides are not like for like; empty when they are, as far as the history records. */
function incomparable(before: ExplorerSide, after: ExplorerSide, unit: string): string[] {
	const profiles = [before.record?.profile, after.record?.profile];
	const differ = profiles[0] && profiles[1] && profiles[0] !== profiles[1];
	const earlier = covering(before.detail, unit);
	const scenarios = covering(after.detail, unit).flatMap((now) => {
		const was = earlier.find((item) => item.id === now.id);
		return was ? redefined(now, was) : [];
	});
	const profile = `The two sides were recorded under different profiles (${profiles.join(' and ')}).`;
	return differ ? [profile, ...scenarios] : scenarios;
}

/**
 * What an entity is shown with. At a branch tip it is the tip alone: there is no before, and
 * only a capture of the tip's own build is current. At a selected commit the after is that
 * commit and the before is its first parent, each read from the one record that judges it; a
 * commit without a parent says so. The scenarios, states and viewports of both sides are united,
 * so what the commit removed can still be seen on the side that had it, and what makes the two
 * sides not like for like is listed. Captures that are rejected, of another build, not stored or
 * of a result that does not stand stay listed and unusable.
 */
export function explorerEvidence(
	scope: ExplorerScope,
	revisions: ExplorerRevisions,
	unit: Pick<HarnessUnit, 'id'>
): ExplorerEvidence {
	const after = side(scope.commit, revisions.head, unit);
	const compared = scope.mode === 'commit' && scope.parent !== null;
	const before = compared ? side(scope.parent as string, revisions.parent, unit) : null;
	const earlier = covering(before?.detail ?? null, unit.id);
	const now = covering(after.detail, unit.id).map((item) =>
		merged(
			item,
			earlier.find((found) => found.id === item.id)
		)
	);
	return {
		mode: scope.mode,
		scenarios: [...focusedScenario([after, before], unit.id), ...united(now, earlier)],
		after,
		before,
		initial: scope.mode === 'commit' && scope.parent === null ? first : null,
		incomparable: before ? incomparable(before, after, unit.id) : []
	};
}

export type { ExplorerRevisions } from './explorerEvidence.types';
