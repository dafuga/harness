import { GitAdapter } from '../adapters/GitAdapter';
import type { Explanation } from '../core/explanationTypes';
import { requiredReasons, type ReasonSide } from '../utils/required-reasons/requiredReasons';
import { ExplanationService, type ReasonReport } from './ExplanationService';

export interface ReasonRange {
	base: ReasonSide;
	head: ReasonSide;
	/** Null when the range starts from nothing. */
	baseCommit: string | null;
	/** Null when the head is the working tree. */
	headCommit: string | null;
}

/** Reads one commit as a side of a comparison. */
export type SideLoader = (commit: string) => Promise<ReasonSide>;

/** Commits nearer to the head than this are tried as steps; a longer history is judged directly. */
const maxSteps = 200;

/**
 * Decides whether a range is explained. It is when every change has a reason for the range as a
 * whole, or when the range can be walked along its first-parent history in steps that are each
 * explained in full: units as they were added, then every later change. A step without a reason
 * is never covered by the steps around it, so nothing can be left out this way. Each step is held
 * to the writing limits its own revision declares and the range as a whole to those of its head,
 * so a later, stricter version neither refuses an earlier note nor is escaped by a longer range.
 */
export class ReasonPathService {
	private readonly explanations = new ExplanationService();

	constructor(
		private readonly root: string,
		private readonly load: SideLoader
	) {}

	async report(range: ReasonRange, known: Explanation[]): Promise<ReasonReport> {
		const { base, head } = range;
		const direct = this.explanations.report(requiredReasons(base, head), known, head.writing);
		if (direct.failures.length === 0) return direct;
		const between = await this.between(range);
		const entries = between.length > 0 ? await this.walked(range, between, known) : undefined;
		if (!entries) return direct;
		const required = direct.required.map((status) => ({ ...status, state: 'explained' as const }));
		return { required, entries, overlong: [], failures: [] };
	}

	/** Commits strictly between the two ends on the first-parent path, oldest first. */
	private async between(range: ReasonRange): Promise<string[]> {
		const git = new GitAdapter(this.root);
		const tip =
			range.headCommit ?? (await git.attempt(['rev-parse', '--verify', '--quiet', 'HEAD']));
		if (!tip) return [];
		const span = range.baseCommit ? `${range.baseCommit}..${tip}` : tip;
		const listed = await git.attempt(['rev-list', '--first-parent', '--reverse', span]);
		const commits = (listed ?? '').split('\n').filter(Boolean);
		// The head itself is the last side already; the tip of a working tree is one more step.
		const inner = range.headCommit ? commits.slice(0, -1) : commits;
		return inner.filter((commit) => commit !== range.baseCommit).slice(-maxSteps);
	}

	/**
	 * The reasons of the steps from the base to the head, or undefined when no sequence of fully
	 * explained steps connects them. Only sides that were reached are kept while walking.
	 */
	private async walked(
		range: ReasonRange,
		between: string[],
		known: Explanation[]
	): Promise<Explanation[] | undefined> {
		const reached: Array<{ side: ReasonSide; entries: Explanation[] }> = [
			{ side: range.base, entries: [] }
		];
		const step = (side: ReasonSide): Explanation[] | undefined => {
			for (const from of [...reached].reverse()) {
				const required = requiredReasons(from.side, side);
				const told = this.explanations.report(required, known, side.writing);
				if (told.failures.length === 0) return [...from.entries, ...told.entries];
			}
			return undefined;
		};
		for (const commit of between) {
			const side = await this.load(commit);
			const entries = step(side);
			if (entries) reached.push({ side, entries });
		}
		return step(range.head);
	}
}
