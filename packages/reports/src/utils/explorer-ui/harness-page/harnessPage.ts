import {
	commitBranch,
	explorerAddress,
	explorerHome
} from '../../../../../../src/utils/console-canonical/consoleCanonical';
import { explorerRoute, explorerRoutePath } from '../../../../../../src/utils/explorerRoute';
import type { ExplorerScope } from '../../../models/explorer-ui/Explorer.types';
import type { HarnessIndex } from '../../../models/explorer-ui/Harness.types';
import { explorerScope } from './explorerScope';

export type HarnessPage =
	/** The address stands for another one: the root, an earlier page, a branch or commit alone. */
	| { kind: 'redirect'; path: string }
	/** Nothing in this history is at the address; `home` is where the explorer opens, if anywhere. */
	| { kind: 'missing'; message: string; home: string | null }
	| { kind: 'page'; scope: ExplorerScope };

/** Pages at the tip of the main branch, where the root of the console leads. */
export function homePath(index: HarnessIndex): string | null {
	const home = explorerHome(index);
	return home ? explorerRoutePath(home) : null;
}

/**
 * What a console path shows in this history. An address that stands for another one leads to
 * it. An explorer address is a page only when the history holds its branch and its commit, and
 * the branch contains the commit; a commit on no branch has the form without one, and no other
 * commit keeps it. Anything else is reported as missing rather than shown as something.
 */
export function harnessPage(index: HarnessIndex, path: string, search = ''): HarnessPage {
	const home = homePath(index);
	const missing = (message: string): HarnessPage => ({ kind: 'missing', message, home });
	const address = explorerAddress(index, path, search);
	if (address !== undefined) return { kind: 'redirect', path: address };
	if (path.replace(/\/+$/, '') === '') return missing('This history holds no commit.');
	const location = explorerRoute(path, search);
	if (!location) return missing('This address names no page of the explorer.');
	const branch = location.branch === null ? commitBranch(index, location.commit ?? '') : null;
	if (branch !== null)
		return { kind: 'redirect', path: explorerRoutePath({ ...location, branch }) };
	const resolved = explorerScope(index, location);
	return resolved.kind === 'scope'
		? { kind: 'page', scope: resolved.scope }
		: missing(resolved.message);
}
