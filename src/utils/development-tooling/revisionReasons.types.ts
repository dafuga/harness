import type { RequiredReason } from '../../core/development-tooling/explanationTypes';
import type { Explanation } from '../../core/development-tooling/explanationTypes';

/** The reasons a commit holds, and what is known of the change it made itself. */
export interface ReasonSources {
	/** The first parent of the commit; null for a commit that has none. */
	parent: string | null;
	/** What the commit changed against that parent; undefined when its source cannot be read. */
	own: RequiredReason[] | undefined;
	/** The reasons in the notes of the commit, whoever wrote them there. */
	noted: Explanation[];
	/** The intact records of the commit: the revision each was verified against, and its reasons. */
	records: Array<{ base: string | null; entries: Explanation[] }>;
}

export interface RevisionReasons {
	/** The reasons of this commit, each once, in a stable order. */
	explanations: Explanation[];
	/** How many more its notes and records hold that explain no change of this commit. */
	range: number;
}

export type Held = Map<string, Explanation>;
