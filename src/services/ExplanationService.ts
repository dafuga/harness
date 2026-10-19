import type { Explanation, ReasonStatus, RequiredReason } from '../core/explanationTypes';
import { explanationProblems, writingVersions, type WritingVersion } from '../utils/writingLimits';

export interface ReasonReport {
	required: ReasonStatus[];
	/** The reasons that satisfy a requirement, in requirement order. */
	entries: Explanation[];
	/** Changes whose reason exceeds the writing limits: explained, and open to a shorter reason. */
	overlong: RequiredReason[];
	failures: string[];
}

const verbs = { added: 'added', modified: 'modified', removed: 'removed' };

/**
 * Matches recorded reasons to the changes that need them, by exact content fingerprints. A
 * change made in several steps is explained by the reasons of every step, in order. `writing`
 * is the version of the limits the revision these changes lead to declares: a reason that is
 * relied on and exceeds that version is a failure, however and whenever it was stored. A
 * revision that declares none fails on no length; what the first version would refuse is still
 * named as open to a shorter reason, as it was before there were versions.
 */
export class ExplanationService {
	report(
		required: RequiredReason[],
		explanations: Explanation[],
		writing: WritingVersion | null = null
	): ReasonReport {
		const problems = (entry: Explanation) =>
			explanationProblems(entry, writing ?? writingVersions[0]);
		const entries: Explanation[] = [];
		const overlong: RequiredReason[] = [];
		const statuses = required.map((reason): ReasonStatus => {
			const subject = explanations.filter((entry) => sameSubject(entry, reason));
			const steps = chain(subject, reason.from, reason.to);
			entries.push(...(steps ?? []));
			if (steps?.some((entry) => problems(entry).length > 0)) overlong.push(reason);
			// A reason for the same starting point but other content was written before a later edit.
			const started = subject.some((entry) => entry.from === reason.from);
			const open = started ? 'stale' : 'missing';
			return { ...reason, state: steps ? 'explained' : open };
		});
		const open = statuses.filter((status) => status.state !== 'explained');
		const long = writing === null ? [] : [...new Set(entries.flatMap(problems))];
		return { required: statuses, entries, overlong, failures: [...open.map(describe), ...long] };
	}
}

type Fingerprint = Explanation['from'];

/** The fewest reasons from one content to another, exact first, each step by the last one given. */
function chain(
	entries: Explanation[],
	from: Fingerprint,
	to: Fingerprint
): Explanation[] | undefined {
	const latest = [...entries].reverse();
	const reached = new Set<Fingerprint>([from]);
	let frontier: Array<{ at: Fingerprint; steps: Explanation[] }> = [{ at: from, steps: [] }];
	while (frontier.length > 0) {
		const next = frontier.flatMap(({ at, steps }) =>
			latest
				.filter((entry) => entry.from === at && !reached.has(entry.to))
				.map((entry) => ({ at: entry.to, steps: [...steps, entry] }))
		);
		const arrived = next.find((step) => step.at === to);
		if (arrived) return arrived.steps;
		for (const step of next) reached.add(step.at);
		frontier = next;
	}
	return undefined;
}

function sameSubject(entry: Explanation, reason: RequiredReason): boolean {
	return entry.unit === reason.unit && entry.symbol === reason.symbol && entry.file === reason.file;
}

export function describe(status: ReasonStatus): string {
	const subject =
		status.symbol === '*'
			? 'the unit'
			: `${status.symbol}${status.file ? ` in ${status.file}` : ''}`;
	const tail = status.state === 'stale' ? 'after its reason was written' : 'without a reason';
	return `${status.unit}: ${subject} was ${verbs[status.change]} ${tail}`;
}
