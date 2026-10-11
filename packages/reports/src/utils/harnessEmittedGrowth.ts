import type { HarnessIndex } from '../models/Harness.types';
import type { HarnessReview } from '../models/HarnessBudget.types';
import { emittedKey, emittedLabel, emittedTargets } from './harnessEmitted';

export interface EmittedCell {
	value?: number;
	/** Change since the last commit that had a size for this target. */
	delta?: number;
	/** Why there is no size at this commit. */
	note?: string;
	/** The limit the commit was verified under: the one reviewed before it. */
	limit?: number;
	/** Why no limit applied although the target was reviewed. */
	unlimited?: string;
}

export interface EmittedReview {
	type: HarnessReview['type'];
	reviewer: string;
	reason: string;
	/** What the review said about each target, in words: its size, or the sizes before and after. */
	changes: string[];
}

export interface EmittedRow {
	commit: string;
	subject: string;
	cells: Record<string, EmittedCell>;
	/** The reviews that measured this commit: its first baseline, or the approval of its growth. */
	reviews: EmittedReview[];
	/** True when a size differs from the commit before, appears or is gone. */
	changed: boolean;
}

export interface EmittedGrowth {
	targets: Array<{ id: string; label: string }>;
	rows: EmittedRow[];
}

/** What one review said about the targets, or nothing when it did not concern them. */
function reviewOf(review: HarnessReview, targets: string[]): EmittedReview[] {
	const changes = targets.flatMap((target) => {
		const key = emittedKey(target);
		const [before, after] = [review.before?.[key], review.after[key]];
		const label = emittedLabel(target);
		if (review.unmeasured?.[key]) return [`${label} not buildable: ${review.unmeasured[key]}`];
		if (after === undefined) return [];
		return [before === undefined ? `${label} ${after}` : `${label} ${before} → ${after}`];
	});
	if (changes.length === 0) return [];
	return [{ type: review.type, reviewer: review.reviewer, reason: review.reason, changes }];
}

type Point = HarnessIndex['units'][number]['growth'][number];

/** The limit a target had when a commit was verified: what the last earlier review said of it. */
function limitOf(key: string, earlier: HarnessReview[]): Pick<EmittedCell, 'limit' | 'unlimited'> {
	const frozen = earlier.findLast(
		(review) => key in review.after || Boolean(review.unmeasured?.[key])
	);
	const limit = frozen?.after[key];
	if (limit !== undefined) return { limit };
	const unlimited = frozen?.unmeasured?.[key];
	return unlimited ? { unlimited } : {};
}

/** One target at one commit: its size, the change since the last size, and the limit in force. */
function cellOf(
	point: Point,
	target: string,
	known: { last: number | undefined; earlier: HarnessReview[] }
): EmittedCell {
	const key = emittedKey(target);
	const value = point.emitted?.[target];
	const cell: EmittedCell = limitOf(key, known.earlier);
	if (point.notes?.[key]) cell.note = point.notes[key];
	if (value === undefined) return cell;
	const delta = known.last === undefined ? 0 : value - known.last;
	return delta ? { ...cell, value, delta } : { ...cell, value };
}

/**
 * The size of what one unit emits, commit by commit and oldest first, one column for each
 * execution target. Each size has the limit its commit was verified under, which is the one the
 * ledger held before that commit was reviewed, and each commit has the reviews that measured it.
 * A size nobody could measure stays absent with its reason; it is never a zero.
 */
export function harnessEmittedGrowth(index: HarnessIndex, unit: string): EmittedGrowth {
	const targets = emittedTargets(index, unit);
	const found = index.units.find((item) => item.id === unit);
	// The index lists the newest commit first: a larger position is an older commit.
	const age = new Map(index.revisions.map((revision, position) => [revision.commit, position]));
	const at = (commit: string) => age.get(commit) ?? 0;
	const points = [...(found?.growth ?? [])].sort(
		(left, right) => at(right.commit) - at(left.commit)
	);
	const reviews = found?.reviews ?? [];
	// The last size each target had, and what the commit before this one showed for it.
	const last: Record<string, number | undefined> = {};
	let before: Record<string, EmittedCell> | undefined;
	const rows = points.map((point): EmittedRow => {
		const earlier = reviews.filter((review) => at(review.commit) > at(point.commit));
		const cells = Object.fromEntries(
			targets.map((target) => [target, cellOf(point, target, { last: last[target], earlier })])
		);
		const changed = targets.some(
			(target) => before !== undefined && cells[target].value !== before[target].value
		);
		for (const target of targets) last[target] = cells[target].value ?? last[target];
		before = cells;
		return {
			commit: point.commit,
			subject: index.revisions.find((item) => item.commit === point.commit)?.subject ?? '',
			cells,
			reviews: reviews
				.filter((review) => review.commit === point.commit)
				.flatMap((review) => reviewOf(review, targets)),
			changed
		};
	});
	return { targets: targets.map((id) => ({ id, label: emittedLabel(id) })), rows };
}
