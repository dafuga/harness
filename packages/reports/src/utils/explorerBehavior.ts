import type {
	ExplorerBehavior,
	ExplorerBehaviorRow,
	ExplorerCapture,
	ExplorerChange,
	ExplorerEvidence,
	ExplorerSide
} from '../models/Explorer.types';

/** The kinds of capture that record what a unit did; a benchmark is a measurement, not behaviour. */
export const behaviorKinds = ['output', 'assertions', 'trace'];
const nothing = 'Neither side recorded an output, assertions or a trace for this unit.';
const unread =
	'The recorded results differ in bytes; reading them says whether the behaviour does.';
const doubtful = 'A result of one side is rejected, stale or not stored, so it cannot be compared.';
const key = (item: ExplorerCapture) =>
	[item.scenario, item.state, item.capture.evidence, item.capture.kind].join('\n');
const results = (side: ExplorerSide | null) =>
	(side?.captures ?? []).filter((item) => behaviorKinds.includes(item.capture.kind));

/** Why two sides cannot be compared at all; null when they can. */
function incomparable(evidence: ExplorerEvidence, before: ExplorerSide): string | null {
	if (!evidence.after.record) return evidence.after.gap;
	if (!before.record) return before.gap;
	return evidence.incomparable[0] ?? null;
}

/** What happened to one result between the two sides; unknown whenever a side is in doubt. */
function changeOf(before: ExplorerCapture | undefined, after: ExplorerCapture | undefined) {
	if ([before, after].some((item) => item && !item.usable)) return 'unknown' as const;
	if (!before) return 'added' as const;
	if (!after) return 'removed' as const;
	return before.capture.sha256 === after.capture.sha256 ? 'unchanged' : 'differs';
}

/** Every result either side recorded: those of the after side first, then what only before has. */
function rows(before: ExplorerSide | null, after: ExplorerSide, compared: boolean) {
	const earlier = new Map(results(before).map((item) => [key(item), item]));
	const later = new Map(results(after).map((item) => [key(item), item]));
	const keys = [...later.keys(), ...[...earlier.keys()].filter((name) => !later.has(name))];
	return keys.map((name): ExplorerBehaviorRow => {
		const [was, is] = [earlier.get(name), later.get(name)];
		const shown = (is ?? was) as ExplorerCapture;
		return {
			scenario: shown.scenario,
			state: shown.state,
			evidence: shown.capture.evidence,
			kind: shown.capture.kind,
			before: was?.usable ? was.capture : null,
			after: is?.usable ? is.capture : null,
			change: compared ? changeOf(was, is) : 'unknown',
			differences: []
		};
	});
}

/** What the rows come to; the least certain of them decides. */
export function behaviorSummary(found: ExplorerBehaviorRow[]): [ExplorerChange, string | null] {
	const some = (change: ExplorerChange) => found.some((row) => row.change === change);
	if (found.length === 0) return ['unknown', nothing];
	if (some('unknown')) return ['unknown', doubtful];
	if (some('differs')) return ['differs', unread];
	return [found.every((row) => row.change === 'unchanged') ? 'unchanged' : 'changed', null];
}

/**
 * The end-to-end behaviour recorded for a unit, from what explorerEvidence selected. At a branch
 * tip and at a first commit it is one run and nothing is compared. At a selected commit the
 * results of both sides are united by scenario, state and evidence: equal bytes are unchanged,
 * one that appears or goes is a change, and different bytes only differ: explorerReading reads
 * both and says whether the behaviour changed. Behaviour is unknown, and
 * never unchanged, when a side has no usable record, the profiles differ, a result is rejected,
 * stale or not stored, or neither side recorded any.
 */
export function explorerBehavior(evidence: ExplorerEvidence): ExplorerBehavior {
	const { before, after, mode } = evidence;
	const outcome = (side: ExplorerSide | null, id: string) =>
		side?.record?.scenarios.find((item) => item.id === id)?.status ?? null;
	const scenarios = evidence.scenarios.map(({ id, title }) => ({
		id,
		title,
		before: outcome(before, id),
		after: outcome(after, id)
	}));
	if (!before) {
		const single = rows(null, after, false);
		return { mode, rows: single, summary: 'not-compared', reason: evidence.initial, scenarios };
	}
	const refused = incomparable(evidence, before);
	const found = rows(before, after, refused === null);
	const [summary, reason] =
		refused === null ? behaviorSummary(found) : ['unknown' as const, refused];
	return { mode, rows: found, summary, reason, scenarios };
}
