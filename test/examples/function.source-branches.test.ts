import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { sourceBranches } from '../../src/repositories/git-source-history/source-history-repository/sourceBranches';
import type { ListedRef } from '../../src/utils/git-source-history/sourceBranches';

const sharedTip = '4c1e7b09a2d35f8e6b1a0c9d7e2f4a6b8c0d1e3f';
const localTip = '9f2c4e1a7b3d5e6f8a0b1c2d3e4f5a6b7c8d9e0f';
const featureTip = 'a41e0c7d25b9f38e61d4a0c85b7e9f2d3c6a1b48';
const divergentTip = 'e83b5f0a1c7d9e2b4f6a8c0d3e5b7f9a1c2d4e6b';
const refsFor = (items: ListedRef[]): ListedRef[] => items;

test('Keeps matching remote tips under the local branch name', () => {
	const refs = refsFor([
		{ ref: 'refs/heads/main', head: sharedTip },
		{ ref: 'refs/remotes/origin/main', head: sharedTip }
	]);
	const output = sourceBranches(refs, ['origin']);
	expect(output).toEqual([{ name: 'main', head: sharedTip }]);
	recordExampleCases(
		{
			unitId: 'function.source-branches',
			symbol: 'sourceBranches',
			state: 'keeps-matching-remote-tips-under-the-local-branch-name',
			evidence: 'examples-cases',
			file: 'keeps-matching-remote-tips-under-the-local-branch-name.json'
		},
		[{ name: 'local and origin share main tip', input: { refs, remotes: ['origin'] }, output }]
	);
});

test('Names remote branches when their tips conflict', () => {
	const refs = refsFor([
		{ ref: 'refs/heads/main', head: localTip },
		{ ref: 'refs/heads/feature/login', head: featureTip },
		{ ref: 'refs/remotes/origin/main', head: divergentTip },
		{ ref: 'refs/remotes/upstream/main', head: divergentTip },
		{ ref: 'refs/remotes/origin/feature/login', head: divergentTip }
	]);
	const remotes = ['origin', 'upstream'];
	const output = sourceBranches(refs, remotes);
	expect(output).toEqual([
		{ name: 'feature/login', head: featureTip },
		{ name: 'main', head: localTip },
		{ name: 'origin:feature/login', head: divergentTip },
		{ name: 'origin:main', head: divergentTip },
		{ name: 'upstream:main', head: divergentTip }
	]);
	recordExampleCases(
		{
			unitId: 'function.source-branches',
			symbol: 'sourceBranches',
			state: 'names-remote-branches-when-their-tips-conflict',
			evidence: 'examples-cases',
			file: 'names-remote-branches-when-their-tips-conflict.json'
		},
		[{ name: 'different remote tip stays separately named', input: { refs, remotes }, output }]
	);
});

test('Lists agreed remote-only branches and filters other refs', () => {
	const refs = refsFor([
		{ ref: 'refs/remotes/origin/release/2.1', head: sharedTip },
		{ ref: 'refs/remotes/upstream/release/2.1', head: sharedTip },
		{ ref: 'refs/remotes/origin/HEAD', head: sharedTip, symbolic: 'refs/remotes/origin/main' },
		{ ref: 'refs/remotes/origin/harness-evidence', head: divergentTip },
		{ ref: 'refs/heads/harness-evidence', head: divergentTip },
		{ ref: 'refs/notes/harness', head: divergentTip },
		{ ref: 'refs/tags/v2.0.0', head: divergentTip }
	]);
	const remotes = ['origin', 'upstream'];
	const output = sourceBranches(refs, remotes);
	expect(output).toEqual([{ name: 'release/2.1', head: sharedTip }]);
	recordExampleCases(
		{
			unitId: 'function.source-branches',
			symbol: 'sourceBranches',
			state: 'lists-agreed-remote-only-branches-and-filters-other-refs',
			evidence: 'examples-cases',
			file: 'lists-agreed-remote-only-branches-and-filters-other-refs.json'
		},
		[{ name: 'agreed release survives while evidence and metadata refs are omitted', input: { refs, remotes }, output }]
	);
});
