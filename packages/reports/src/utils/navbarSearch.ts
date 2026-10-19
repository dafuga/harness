import type { ExplorerLocation, ExplorerScope } from '../models/Explorer.types';
import type { SearchEntry } from './entitySearch';

/** What the search of the bar is given, and where a result of it leads. */
export interface NavbarSearch {
	/** The entries of exactly the revision in view; null while they are read. */
	entries: SearchEntry[] | null;
	scope: { label: string; pinned: string | null };
	/**
	 * The location of a result: its entity in the branch and commit that are shown. Null for a result
	 * the accepted entries do not hold, such as one of an earlier revision or one listed while loading.
	 */
	at: (entry: SearchEntry) => ExplorerLocation | null;
}

/** One result as the search knows it: the same id, category and commit are the same result. */
const key = (entry: SearchEntry) => [entry.commit, entry.category, entry.id].join('\n');

/** Which revision is searched, in words. */
function said(scope: ExplorerScope | null, pinned: string | null): string {
	if (!scope) return 'Reading the history';
	return pinned ? `At commit ${pinned}` : `At the tip of ${scope.branch ?? 'the retained commits'}`;
}

/**
 * The search of the bar for the revision in view. Entries read at another commit are never
 * offered for this one, so a host that has not read the new revision yet offers nothing, and a
 * result is followed only while the accepted entries still hold it.
 */
export function navbarSearch(
	scope: ExplorerScope | null,
	given: SearchEntry[] | null | undefined
): NavbarSearch {
	const location = scope?.location ?? null;
	const current = given?.every((entry) => entry.commit === scope?.commit) ?? false;
	const pinned = location?.commit ? location.commit.slice(0, 7) : null;
	const entries = location && current ? given! : null;
	const held = new Set((entries ?? []).map(key));
	return {
		entries,
		scope: { label: said(scope, pinned), pinned },
		at: (entry) =>
			location && held.has(key(entry))
				? {
						branch: location.branch,
						commit: location.commit,
						category: entry.category,
						entity: entry.id
					}
				: null
	};
}
