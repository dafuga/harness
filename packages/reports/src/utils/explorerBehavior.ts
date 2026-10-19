import type { ExplorerBehaviorRow, ExplorerChange } from "../models/Explorer.types";

/** The kinds of capture that record what a unit did; a benchmark is a measurement, not behaviour. */
export const behaviorKinds = ['output', 'assertions', 'trace'];

const nothing = 'Neither side recorded an output, assertions or a trace for this unit.';

const unread =
	'The recorded results differ in bytes; reading them says whether the behaviour does.';

const doubtful = 'A result of one side is rejected, stale or not stored, so it cannot be compared.';

/** What the rows come to; the least certain of them decides. */
export function behaviorSummary(found: ExplorerBehaviorRow[]): [ExplorerChange, string | null] {
	const some = (change: ExplorerChange) => found.some((row) => row.change === change);
	if (found.length === 0) return ['unknown', nothing];
	if (some('unknown')) return ['unknown', doubtful];
	if (some('differs')) return ['differs', unread];
	return [found.every((row) => row.change === 'unchanged') ? 'unchanged' : 'changed', null];
}

export { explorerBehavior } from '../../../desktop/src/utils/recorded-answer/explorerBehavior';
