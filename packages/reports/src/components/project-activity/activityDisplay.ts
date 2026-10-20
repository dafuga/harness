import { consoleRoutePath } from './consoleRoute';

/** The history page of a commit in the console served under `base`, at its own path. */
export function commitHref(base: string, commit: string, branches: string[]): string {
	return base + consoleRoutePath({ branch: branches[0] ?? null, commit, view: 'history' });
}
