import type { Explanation, RequiredReason } from '../core/explanationTypes';
import { ExplanationService } from '../services/ExplanationService';
import { canonicalJson } from './canonicalJson';

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

type Held = Map<string, Explanation>;
const once = (entries: Explanation[]): Held =>
	new Map(entries.map((entry) => [canonicalJson(entry), entry]));
/** One step of the content of a symbol: reasons for the same step explain the same change. */
const step = (entry: Explanation) =>
	canonicalJson([entry.unit, entry.symbol, entry.file ?? null, entry.from, entry.to]);

/** Of the reasons held, those that explain a change of the commit, alone or as one of its steps. */
function explaining(own: RequiredReason[], held: Explanation[]): Explanation[] {
	const steps = new Set(new ExplanationService().report(own, held).entries.map(step));
	return held.filter((entry) => steps.has(step(entry)));
}

/**
 * The reasons of one commit among those its notes and its records hold. A record may verify a
 * longer range than its commit, and attaching it copies every reason of that range onto the
 * commit, so being held there does not make a reason this commit's. One is when it explains a
 * change the commit made against its first parent, by exact fingerprints, alone or as a step, or
 * when it satisfied a record that verified exactly that change. Where the change cannot be read,
 * a note that no longer record holds is kept as it was noted. The rest is counted and not shown:
 * it is the reason of another commit, or of the range as a whole.
 */
export function revisionReasons(sources: ReasonSources): RevisionReasons {
	const { parent, own, noted, records } = sources;
	const entries = (exact: boolean) =>
		records.filter((record) => (record.base === parent) === exact).flatMap((item) => item.entries);
	const [exact, longer] = [entries(true), once(entries(false))];
	const held = once([...noted, ...exact, ...longer.values()]);
	const told = own
		? explaining(own, [...held.values()])
		: noted.filter((entry) => !longer.has(canonicalJson(entry)));
	const shown = once([...told, ...exact]);
	const explanations = [...shown.keys()].sort().map((key) => shown.get(key) as Explanation);
	return { explanations, range: held.size - shown.size };
}
