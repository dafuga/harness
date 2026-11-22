// @harness-uid u_hstrevaabc
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { fail } from '../../../core/development-tooling/errors';
import type { ContractHistoryOptions } from './contractHistory.types';

/** Resolve every ref afresh and pass it as data; no shell or revision option interpolation. */
export async function resolveContractRevision(git: GitAdapter, revision: string): Promise<string> {
	if (!revision || revision.startsWith('-') || /[\0\r\n]/.test(revision))
		return fail(`Invalid contract revision "${revision}".`);
	const resolved = await git.attempt([
		'rev-parse',
		'--verify',
		'--end-of-options',
		`${revision}^{commit}`
	]);
	return (
		resolved ??
		fail(
			`Invalid contract revision "${revision}"; expected an existing commit (HEAD may be missing).`
		)
	);
}

export async function contractComparison(
	git: GitAdapter,
	revisions: string[],
	options: ContractHistoryOptions
): Promise<string[]> {
	validateComparisonSelectors(revisions, options);
	if (options.staged) return [await resolveContractRevision(git, 'HEAD'), 'index'];
	if (options.since) return [await resolveContractRevision(git, options.since), 'working-tree'];
	if (!revisions.length) return [await resolveContractRevision(git, 'HEAD'), 'working-tree'];
	if (revisions.length === 2)
		return Promise.all(revisions.map((revision) => resolveContractRevision(git, revision)));
	const range = revisions[0].split('..');
	if (range.length === 2 && range.every(Boolean))
		return Promise.all(range.map((revision) => resolveContractRevision(git, revision)));
	if (range.length !== 1) return fail('Expected <base>..<head>, two revisions, or one commit.');
	const commit = await resolveContractRevision(git, revisions[0]);
	return [await firstContractParent(git, commit), commit];
}

function validateComparisonSelectors(revisions: string[], options: ContractHistoryOptions): void {
	const selected = [revisions.length > 0, Boolean(options.staged), Boolean(options.since)].filter(
		Boolean
	);
	if (selected.length > 1)
		fail('Cannot combine revision arguments, --since and --staged; these selectors are exclusive.');
}

export async function firstContractParent(git: GitAdapter, commit: string): Promise<string> {
	const parents = await git.run(['rev-list', '--parents', '-n', '1', commit, '--']);
	return parents.split(' ')[1] ?? 'empty';
}
