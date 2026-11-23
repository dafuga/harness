import type { Repository, Environment, Case } from './script.debt-ratchet-base.test.types';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { ratchetBaseVariable, selectRatchetBase } from '../../scripts/debt-ratchet-base';
import type { GitRead } from '../../scripts/debt-ratchet-base.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const zeroCommit = '0'.repeat(40);
const unknownCommit = '9b4e1d07a3c85f2e6d91b0f47c2a8e5d3f106b8c';
const refFormat = '--format=%(refname:short)=%(subject)';
const viaOriginMain = 'Ratchet base: merge-base of HEAD and origin/main.';
const lastCommitOnly =
	'Ratchet base: HEAD^, so only the last commit is compared. Set HARNESS_DEBT_RATCHET_BASE to compare a wider range.';
const viaOverride = (hash: string) => `Ratchet base: ${ratchetBaseVariable}=${hash}.`;

/** One read-only git command in the checkout, as check-debt-ratchets passes it. */
function gitReader(root: string, commands: string[][]): GitRead {
	return (args) => {
		commands.push([...args]);
		return execFileSync('git', [...args], {
			cwd: root,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
	};
}

/** Commits one file named after the subject and returns the new commit. */
function commit({ root, git }: Repository, subject: string): string {
	writeFileSync(join(root, subject), `${subject}\n`);
	git('add', subject);
	git('-c', 'commit.gpgSign=false', 'commit', '-q', '-m', subject);
	return git('rev-parse', 'HEAD');
}

/**
 * main holds root, fork and upstream, and origin/main names upstream. The feature branch forks at
 * fork and holds first and second, so HEAD is second and its merge-base with upstream is fork.
 */
function forkedHistory(repository: Repository) {
	const root = commit(repository, 'root');
	const fork = commit(repository, 'fork');
	const upstream = commit(repository, 'upstream');
	repository.git('update-ref', 'refs/remotes/origin/main', upstream);
	repository.git('checkout', '-q', '-b', 'feature', fork);
	const first = commit(repository, 'first');
	const second = commit(repository, 'second');
	return { root, fork, upstream, first, second };
}

/** The branches as name=subject of their commit, which each case records as the refs it saw. */
function refsOf({ git }: Repository): string[] {
	const listing = git('for-each-ref', refFormat, 'refs/heads', 'refs/remotes');
	return listing ? listing.split('\n') : [];
}

/** Runs selectRatchetBase in the checkout for one case, keeping the environment and refs it saw. */
function caseRunner(repository: Repository, commands: string[][] = []) {
	return (name: string, env: Environment): Case => {
		const refs = refsOf(repository);
		const output = selectRatchetBase(gitReader(repository.root, commands), env);
		return { name, input: { env, refs }, output };
	};
}

/** Records the cases of one state; state is the state id derived from the test title. */
function recordState(state: string, cases: Case[]): void {
	const meta = { unitId: 'script.debt-ratchet-base', symbol: 'selectRatchetBase' };
	recordExampleCases({ ...meta, state, evidence: 'examples-cases', file: `${state}.json` }, cases);
}

test('Chooses the merge-base with the protected branch', () =>
	withTempRepo((repository) => {
		const { fork, root } = forkedHistory(repository);
		const unrelated = repository.git('commit-tree', emptyTree, '-m', 'unrelated history');
		const commands: string[][] = [];
		const select = caseRunner(repository, commands);
		const byDefault = select('no GITHUB_BASE_REF: origin/main is compared', {});
		const byMain = select('GITHUB_BASE_REF main names origin/main, tried first', {
			GITHUB_BASE_REF: 'main'
		});
		repository.git('update-ref', 'refs/remotes/origin/release', root);
		const byRelease = select('GITHUB_BASE_REF release is tried before origin/main', {
			GITHUB_BASE_REF: 'release'
		});
		repository.git('update-ref', '-d', 'refs/remotes/origin/release');
		repository.git('update-ref', 'refs/remotes/origin/main', unrelated);
		const byLocal = select('origin/release missing, origin/main shares no history: main', {
			GITHUB_BASE_REF: 'release'
		});
		expect(byDefault.output).toEqual({ commit: fork, message: viaOriginMain });
		expect(byMain.output).toEqual({ commit: fork, message: viaOriginMain });
		expect(byRelease.output).toEqual({
			commit: root,
			message: 'Ratchet base: merge-base of HEAD and origin/release.'
		});
		expect(byLocal.output).toEqual({
			commit: fork,
			message:
				'origin/release does not exist. origin/main shares no fetched history with HEAD. Ratchet base: merge-base of HEAD and main.'
		});
		const names = [...new Set(commands.map(([name]) => name))].sort();
		expect(names).toEqual(['merge-base', 'rev-parse']);
		const cases = [byDefault, byMain, byRelease, byLocal];
		recordState('chooses-the-merge-base-with-the-protected-branch', cases);
	}));

test('The override commit wins, or its merge-base with HEAD', () =>
	withTempRepo((repository) => {
		const { fork, first, upstream } = forkedHistory(repository);
		const orphan = repository.git('commit-tree', emptyTree, '-m', 'unrelated history');
		const select = caseRunner(repository);
		const padded = select('an ancestor padded with blanks is trimmed, then used as it is', {
			[ratchetBaseVariable]: `  ${first}  `
		});
		const diverged = select('a diverged commit is compared from its merge-base with HEAD', {
			[ratchetBaseVariable]: upstream
		});
		const missing = select('a commit this checkout lacks is noted, then origin/main', {
			[ratchetBaseVariable]: unknownCommit
		});
		const noHistory = select('a commit with no shared history is used as it is', {
			[ratchetBaseVariable]: orphan
		});
		expect(ratchetBaseVariable).toBe('HARNESS_DEBT_RATCHET_BASE');
		expect(padded.output).toEqual({ commit: first, message: viaOverride(first) });
		expect(diverged.output).toEqual({ commit: fork, message: viaOverride(upstream) });
		expect(missing.output).toEqual({
			commit: fork,
			message: `HARNESS_DEBT_RATCHET_BASE=${unknownCommit} is not a commit in this checkout. ${viaOriginMain}`
		});
		expect(noHistory.output).toEqual({ commit: orphan, message: viaOverride(orphan) });
		const cases = [padded, diverged, missing, noHistory];
		recordState('the-override-commit-wins-or-its-merge-base-with-head', cases);
	}));

test('An all-zero or blank override is passed over', () =>
	withTempRepo((repository) => {
		const { fork } = forkedHistory(repository);
		const select = caseRunner(repository);
		const zero = select('an all-zero value from a branch-creating push', {
			[ratchetBaseVariable]: zeroCommit
		});
		const blank = select('a blank value, as sent when the event has no before commit', {
			[ratchetBaseVariable]: ''
		});
		const padded = select('an all-zero value padded with blanks is trimmed first', {
			[ratchetBaseVariable]: `  ${zeroCommit}  `
		});
		const cases = [zero, blank, padded];
		for (const { output } of cases) {
			expect(output).toEqual({ commit: fork, message: viaOriginMain });
		}
		expect(zero.output.message).not.toContain(ratchetBaseVariable);
		recordState('an-all-zero-or-blank-override-is-passed-over', cases);
	}));

test('No protected branch falls back to the first parent', () =>
	withTempRepo((repository) => {
		const { first, second } = forkedHistory(repository);
		const select = caseRunner(repository);
		repository.git('update-ref', 'refs/remotes/origin/main', second);
		const onProtected = select('HEAD already on origin/main: its first parent, not main', {});
		repository.git('update-ref', '-d', 'refs/remotes/origin/main');
		repository.git('checkout', '-q', '--detach');
		repository.git('branch', '-q', '-D', 'main');
		const noBranch = select('detached HEAD, no origin/main or main: the last commit', {});
		expect(onProtected.output).toEqual({
			commit: first,
			message: `HEAD is already part of origin/main. ${lastCommitOnly}`
		});
		expect(noBranch.output).toEqual({
			commit: first,
			message: `origin/main does not exist. main does not exist. ${lastCommitOnly}`
		});
		recordState('no-protected-branch-falls-back-to-the-first-parent', [onProtected, noBranch]);
	}));

test('HEAD with no parent has no base unless overridden', () =>
	withTempRepo((repository) => {
		const select = caseRunner(repository);
		const empty = select('an empty repository has no HEAD commit, so no base', {});
		const root = commit(repository, 'root');
		repository.git('checkout', '-q', '--detach');
		repository.git('branch', '-q', '-D', 'main');
		const noParent = select('a root commit with no protected branch has no base', {});
		const overridden = select('an override naming the root commit is the base', {
			[ratchetBaseVariable]: root
		});
		expect(empty.output).toEqual({
			commit: null,
			message: 'No HEAD commit: debt ratchets have no base.'
		});
		expect(noParent.output).toEqual({
			commit: null,
			message:
				'origin/main does not exist. main does not exist. HEAD has no parent: debt ratchets have no base. Set HARNESS_DEBT_RATCHET_BASE to compare a wider range.'
		});
		expect(overridden.output).toEqual({ commit: root, message: viaOverride(root) });
		const cases = [empty, noParent, overridden];
		recordState('head-with-no-parent-has-no-base-unless-overridden', cases);
	}));
