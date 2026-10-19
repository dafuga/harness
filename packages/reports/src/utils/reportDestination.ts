import { commitBranch, explorerHome } from '../../../../src/utils/consoleCanonical';
import { explorerRoutePath } from '../../../../src/utils/explorerRoute';
import type { HarnessIndex } from '../models/Harness.types';

/** What an earlier report address is known to name: the report, and the revision it recorded. */
export interface NamedReport {
	id: string;
	revision?: string | null;
}

/**
 * Where an earlier report address leads in the explorer, as the path after the route the console
 * is served under. A report that names a commit this history holds, itself or through the import
 * of earlier reports, opens Pages at that commit; any other opens Pages at the branch tip. Empty
 * when there is no history to open, so the root of the console answers.
 */
export function reportDestination(index: HarnessIndex | null, report: NamedReport | null): string {
	const home = index ? explorerHome(index) : undefined;
	if (!index || !home) return '';
	const linked = index.legacy.find((entry) => entry.id === report?.id)?.linked;
	const commit = [report?.revision, linked].find((named) =>
		index.revisions.some((revision) => revision.commit === named)
	);
	if (!commit) return explorerRoutePath(home);
	return explorerRoutePath({ branch: commitBranch(index, commit), commit, category: 'pages' });
}
