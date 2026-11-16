import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import type { ContractHistoryOptions } from '../../src/commands/development-tooling/contracts-command/contractHistory.types';
import {
	contractComparison,
	firstContractParent,
	resolveContractRevision
} from '../../src/commands/development-tooling/contracts-command/contractRevisions';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

/**
 * Each state runs the real git binary in a temporary repository from withTempRepo, and calls the
 * three operations through a GitAdapter bound to that root, as readContractDiff and readContractLog
 * do. A row is [name, input, expected]: the call is recorded with its input and with what came back,
 * or the error class and message it threw, and the assertion compares that same outcome.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
type Result = { value: unknown } | { error: { type: string; message: string } };
type Row<I> = [name: string, input: I, expected: Result];
type Selectors = ContractHistoryOptions & { revisions?: string[] };

const zeroId = '0'.repeat(40);
const ok = (value: unknown): Result => ({ value });
const failed = (type: string, message: string): Result => ({ error: { type, message } });
const cliError = (message: string): Result => failed('ExpectedCliError', message);
const invalid = (revision: string): Result => cliError(`Invalid contract revision "${revision}".`);
const unresolved = (revision: string): Result =>
	cliError(
		`Invalid contract revision "${revision}"; expected an existing commit (HEAD may be missing).`
	);
const malformed = cliError('Expected <base>..<head>, two revisions, or one commit.');
const exclusive = cliError(
	'Cannot combine revision arguments, --since and --staged; these selectors are exclusive.'
);

/** git in a fixture repository, with commit signing off so commits do not depend on the machine. */
function fixtureGit(repo: TemporaryRepo, ...args: string[]): string {
	return repo.git('-c', 'commit.gpgsign=false', ...args);
}

/** Writes one file, commits it as a feat: change and returns the new HEAD id. */
function commitFile(repo: TemporaryRepo, file: string, subject: string): string {
	writeFileSync(join(repo.root, file), `${subject}\n`);
	repo.git('add', file);
	fixtureGit(repo, 'commit', '-q', '-m', subject);
	return repo.git('rev-parse', 'HEAD');
}

/**
 * first is the root, tagged v1; second follows it on main; feature branches from first; merge joins
 * feature into main. HEAD is merge, so its first parent is second and its second parent is feature.
 */
function buildHistory(repo: TemporaryRepo) {
	const first = commitFile(repo, 'a.txt', 'feat: first');
	repo.git('tag', 'v1');
	const second = commitFile(repo, 'b.txt', 'feat: second');
	repo.git('checkout', '-q', '-b', 'feature', first);
	const feature = commitFile(repo, 'c.txt', 'feat: feature');
	repo.git('checkout', '-q', 'main');
	fixtureGit(repo, 'merge', '-q', '--no-ff', '-m', 'merge feature', 'feature');
	return { first, second, feature, merge: repo.git('rev-parse', 'HEAD') };
}

/** Runs one call and keeps what it returned, or the class and message of what it threw. */
async function outcome(run: () => Promise<unknown>): Promise<Result> {
	try {
		return { value: await run() };
	} catch (error) {
		const { name, message } = error as Error;
		return { error: { type: name, message } };
	}
}

/** Runs each row's input through run, asserts its outcome, and returns the rows as recorded cases. */
async function exercise<I>(
	run: (input: I) => Promise<unknown>,
	rows: Row<I>[]
): Promise<ExampleCase[]> {
	const cases: ExampleCase[] = [];
	for (const [name, input, expected] of rows) {
		const result = await outcome(() => run(input));
		expect(result).toEqual(expected);
		cases.push(
			'error' in result
				? { name, input, error: result.error }
				: { name, input, output: result.value }
		);
	}
	return cases;
}

const resolver = (git: GitAdapter) => {
	return ({ revision }: { revision: string }) => resolveContractRevision(git, revision);
};
const comparer = (git: GitAdapter) => {
	return ({ revisions = [], ...options }: Selectors) => contractComparison(git, revisions, options);
};
const parser = (git: GitAdapter) => {
	return ({ commit }: { commit: string }) => firstContractParent(git, commit);
};

test('resolveContractRevision resolves refs to full commit ids and rejects bad input', async () => {
	const cases = await withTempRepo(async (repo) => {
		const { first, second, feature, merge } = buildHistory(repo);
		const git = new GitAdapter(repo.root);
		const tree = repo.git('rev-parse', 'HEAD^{tree}');
		repo.git('branch', second.slice(0, 7), first);
		const named = await exercise(resolver(git), [
			['HEAD is the full id of the checked-out commit', { revision: 'HEAD' }, ok(merge)],
			['a tag resolves to the commit it names', { revision: 'v1' }, ok(first)],
			['a short id resolves to the full id', { revision: feature.slice(0, 7) }, ok(feature)],
			['a full id comes back as the same id', { revision: second }, ok(second)],
			['a branch named like a short id wins', { revision: second.slice(0, 7) }, ok(first)],
			['a branch resolves to the commit it names', { revision: 'feature' }, ok(feature)]
		]);
		repo.git('branch', '-f', 'feature', second);
		const moved = await exercise(resolver(git), [
			['the same branch resolves again after it moves', { revision: 'feature' }, ok(second)]
		]);
		const rejects = await exercise(resolver(git), [
			['an empty revision', { revision: '' }, invalid('')],
			['an option-like revision', { revision: '--all' }, invalid('--all')],
			['a NUL byte in the revision', { revision: 'HEAD\0' }, invalid('HEAD\0')],
			['a carriage return in the revision', { revision: 'v1\r' }, invalid('v1\r')],
			['a name that resolves to no commit', { revision: 'no-such-ref' }, unresolved('no-such-ref')],
			['an all-zero id that names no object', { revision: zeroId }, unresolved(zeroId)],
			['a tree id, which is not a commit', { revision: tree }, unresolved(tree)]
		]);
		const empty = await withTempRepo((bare) =>
			exercise(resolver(new GitAdapter(bare.root)), [
				['HEAD in a repository with no commits', { revision: 'HEAD' }, unresolved('HEAD')]
			])
		);
		return [...named, ...moved, ...rejects, ...empty];
	});
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-contract-revisions',
			symbol: 'resolveContractRevision',
			state: 'resolvecontractrevision-resolves-refs-to-full-commit-ids-and',
			evidence: 'examples-cases',
			file: 'resolvecontractrevision-resolves-refs-to-full-commit-ids-and.json'
		},
		cases
	);
});

test('contractComparison returns base and head snapshot markers for every selector shape', async () => {
	const cases = await withTempRepo(async (repo) => {
		const { first, second, feature, merge } = buildHistory(repo);
		const git = new GitAdapter(repo.root);
		const chosen = await exercise(comparer(git), [
			['no selectors: HEAD to the working tree', {}, ok([merge, 'working-tree'])],
			['staged: HEAD to the index', { staged: true }, ok([merge, 'index'])],
			['since: that revision to the working tree', { since: 'v1' }, ok([first, 'working-tree'])],
			['two revisions, in the order given', { revisions: ['v1', 'HEAD'] }, ok([first, merge])],
			['a range, split into base and head', { revisions: ['v1..HEAD'] }, ok([first, merge])],
			['a lone merge: its first parent to it', { revisions: ['HEAD'] }, ok([second, merge])],
			['a lone commit: its one parent to it', { revisions: ['feature'] }, ok([first, feature])],
			['a lone root: the empty base to it', { revisions: ['v1'] }, ok(['empty', first])]
		]);
		const rejects = await exercise(comparer(git), [
			['a range with an empty side', { revisions: ['v1..'] }, malformed],
			['a range with three parts', { revisions: ['v1..HEAD..feature'] }, malformed],
			['an option-like selector', { revisions: ['--all'] }, invalid('--all')],
			['an unknown selector', { revisions: ['no-such-ref'] }, unresolved('no-such-ref')],
			['revisions with staged', { revisions: ['v1'], staged: true }, exclusive],
			['since with staged', { since: 'v1', staged: true }, exclusive],
			['two revisions with since', { revisions: ['v1', 'HEAD'], since: 'v1' }, exclusive]
		]);
		const empty = await withTempRepo((bare) =>
			exercise(comparer(new GitAdapter(bare.root)), [
				['HEAD in a repository with no commits', {}, unresolved('HEAD')]
			])
		);
		return [...chosen, ...rejects, ...empty];
	});
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-contract-revisions',
			symbol: 'contractComparison',
			state: 'contractcomparison-returns-base-and-head-snapshot-markers-fo',
			evidence: 'examples-cases',
			file: 'contractcomparison-returns-base-and-head-snapshot-markers-fo.json'
		},
		cases
	);
});

test('firstContractParent gives the first parent of a merge and the empty marker for a root', async () => {
	const cases = await withTempRepo(async (repo) => {
		const { first, second, feature, merge } = buildHistory(repo);
		return exercise(parser(new GitAdapter(repo.root)), [
			['a merge gives its first parent, the commit on main', { commit: merge }, ok(second)],
			['a commit with one parent gives that parent', { commit: feature }, ok(first)],
			['a root commit gives the empty marker', { commit: first }, ok('empty')],
			[
				'an unknown commit makes git fail',
				{ commit: 'no-such-commit' },
				failed(
					'GitCommandError',
					"git rev-list --parents -n 1 no-such-commit -- failed: fatal: bad revision 'no-such-commit'"
				)
			]
		]);
	});
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-contract-revisions',
			symbol: 'firstContractParent',
			state: 'firstcontractparent-gives-the-first-parent-of-a-merge-and-th',
			evidence: 'examples-cases',
			file: 'firstcontractparent-gives-the-first-parent-of-a-merge-and-th.json'
		},
		cases
	);
});
