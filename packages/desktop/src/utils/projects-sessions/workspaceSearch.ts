import type { SearchEntry } from '../../../../reports/src/utils/entitySearch';

/** What the search of the top bar is given for the project and revision in view. */
export interface WorkspaceSearch {
	/** Every entity of the shown revision; null while a project or revision is being read. */
	entries: SearchEntry[] | null;
	scope: { label: string; pinned: string | null };
	/**
	 * The workspace address of a result, in the project, branch and commit these entries were read
	 * at. Null for anything these entries do not hold, such as a result of a project or revision left.
	 */
	at: (entry: SearchEntry) => string | null;
}

export { workspaceSearch } from '../../components/projects-sessions/nav-bar/workspaceSearch';
