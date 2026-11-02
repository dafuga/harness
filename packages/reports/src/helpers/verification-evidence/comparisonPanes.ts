// @harness-uid u_vcr3nrovbe
import type { ComparisonPane, ComparisonSide } from './comparisonPanes.types';
import { shortCommit } from '../strings/shortCommit';

/** @pure Bind each revision's label, content and gap to the same side before rendering. */
export function comparisonPanes<T>(
	before: ComparisonSide<T> | null,
	after: ComparisonSide<T>,
	paired = true
): ComparisonPane<T>[] {
	return paired
		? [pane('before', before ?? {}, true), pane('after', after, true)]
		: [pane('after', after, false)];
}

function pane<T>(
	side: 'before' | 'after',
	input: ComparisonSide<T>,
	paired: boolean
): ComparisonPane<T> {
	const phase = paired ? side : 'current';
	const commit = input.commit ?? '';
	const value = input.value;
	const name = paired ? sideLabel(side) : (input.currentLabel ?? 'Current snapshot');
	const heading = [name, commit && shortCommit(commit)].filter(Boolean).join(' · ');
	const role = paired ? sideRole(side) : (input.currentRole ?? 'Branch tip');
	return {
		key: input.key ?? `${side}-${commit}`,
		side,
		phase,
		commit,
		heading,
		role,
		value,
		gap: sideGap(input, value)
	};
}

const sideLabel = (side: 'before' | 'after') => (side === 'before' ? 'Before' : 'After');
const sideRole = (side: 'before' | 'after') =>
	side === 'before' ? 'Parent commit' : 'Selected commit';

function sideGap<T>(input: ComparisonSide<T>, value: T | undefined): string | undefined {
	return input.gap ?? (value === undefined ? 'No evidence is recorded for this side.' : undefined);
}
