import { commitBranch, defaultCommit } from '../../../../src/utils/consoleCanonical';
import {
	consoleRoute,
	consoleRoutePath,
	type ConsoleRoute
} from '../../../../src/utils/consoleRoute';
import type { HarnessIndex, HarnessRevisionSummary } from '../models/Harness.types';

export type HarnessPage =
	/** The address stands for another one: the root, or a commit under the branchless form. */
	| { kind: 'redirect'; path: string }
	/** Nothing in this history is at the address; `home` is the newest commit, when there is one. */
	| { kind: 'missing'; message: string; home: string | null }
	| { kind: 'page'; route: ConsoleRoute; summary: HarnessRevisionSummary };

/** The page of the newest commit of the main branch, where the root of the console leads. */
export function homePath(index: HarnessIndex): string | null {
	const commit = defaultCommit(index, '');
	if (!commit) return null;
	return consoleRoutePath({ branch: commitBranch(index, commit), commit, view: 'map' });
}

/**
 * What a console path shows in this history. A path is a page only when its commit is in the
 * index and on the branch it names; a commit on no branch has the branchless form, and no
 * other commit keeps it. Anything else is reported as missing rather than shown as something.
 */
export function harnessPage(index: HarnessIndex, path: string): HarnessPage {
	const home = homePath(index);
	const missing = (message: string): HarnessPage => ({ kind: 'missing', message, home });
	if (path.replace(/\/+$/, '') === '') {
		return home ? { kind: 'redirect', path: home } : missing('This history holds no commit.');
	}
	const route = consoleRoute(path);
	if (!route) return missing('This address names no page of the console.');
	const summary = index.revisions.find((item) => item.commit === route.commit);
	const short = route.commit.slice(0, 7);
	if (!summary) return missing(`Commit ${short} is not in this history.`);
	if (route.branch === null) {
		const branch = commitBranch(index, route.commit);
		return branch === null
			? { kind: 'page', route, summary }
			: { kind: 'redirect', path: consoleRoutePath({ ...route, branch }) };
	}
	return summary.branches.includes(route.branch)
		? { kind: 'page', route, summary }
		: missing(`Branch ${route.branch} does not contain commit ${short}.`);
}
