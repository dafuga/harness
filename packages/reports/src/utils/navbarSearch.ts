import type { ExplorerLocation } from '../models/Explorer.types';
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

export { navbarSearch } from '../components/harness/harness-navbar/navbarSearch';
