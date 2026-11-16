import { test } from 'vitest';
import type { TreeEntry } from '../../src/core/development-tooling/sourceTypes';
import { treeChanges } from '../../src/services/reports-media/impact-service/treeChanges';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * treeChanges compares a base listing (the earlier tree) with a head listing (the later one), as the
 * contract describes. Each state is one behaviour the contract states; its inputs and what came back
 * are asserted and recorded as the cases of that state.
 */

const readmeHash = '3f9c1a7e0b52d84c6e1f9a2b7d05c3e8a4b16f20';
const oldReportHash = '9d2e47b1c0a85f36e2d19b7c4a0f58e3b6d21c94';
const treeChangesBaseHash = 'e51b08c4a7d69f23b0c8e14d5a7f9e26c3b80d1a';
const treeChangesHeadHash = '5c0a7f2e9b41d36a8e02c7f5b9d14a6e0c3f82b7';
const impactHash = 'b7e3d1094fa26c8e5d07b3a9f1e46c2d8a95f0e3';
const renamedHash = 'a41e6f0c2d9b7853e1f04c6a8b2d7e95f3c10a4d';

const base: TreeEntry[] = [
	{ path: 'README.md', hash: readmeHash },
	{ path: 'src/legacy/oldReport.ts', hash: oldReportHash },
	{ path: 'src/utils/treeChanges.ts', hash: treeChangesBaseHash }
];
const head: TreeEntry[] = [
	{ path: 'README.md', hash: readmeHash },
	{ path: 'docs/impact.md', hash: impactHash },
	{ path: 'src/utils/treeChanges.ts', hash: treeChangesHeadHash }
];

test('treeChanges reports added, modified and removed paths', () => {
	const forward = treeChanges(base, head);
	const backward = treeChanges(head, base);
	expect(forward).toEqual([
		{ path: 'docs/impact.md', status: 'added' },
		{ path: 'src/legacy/oldReport.ts', status: 'removed' },
		{ path: 'src/utils/treeChanges.ts', status: 'modified' }
	]);
	expect(backward).toEqual([
		{ path: 'docs/impact.md', status: 'removed' },
		{ path: 'src/legacy/oldReport.ts', status: 'added' },
		{ path: 'src/utils/treeChanges.ts', status: 'modified' }
	]);
	recordExampleCases(
		{
			unitId: 'function.tree-changes',
			symbol: 'treeChanges',
			state: 'treechanges-reports-added-modified-and-removed-paths',
			evidence: 'examples-cases',
			file: 'treechanges-reports-added-modified-and-removed-paths.json'
		},
		[
			{
				name: 'head adds docs/impact.md, drops src/legacy/oldReport.ts, changes src/utils/treeChanges.ts and omits the unchanged README.md',
				input: { base, head },
				output: forward
			},
			{
				name: 'the same listings swapped, so the added and removed paths trade places',
				input: { base: head, head: base },
				output: backward
			}
		]
	);
});

test('treeChanges reports a rename as a removal and an addition', () => {
	const renameBase: TreeEntry[] = [
		{ path: 'README.md', hash: readmeHash },
		{ path: 'src/utils/oldName.ts', hash: renamedHash }
	];
	const renameHead: TreeEntry[] = [
		{ path: 'README.md', hash: readmeHash },
		{ path: 'src/utils/newName.ts', hash: renamedHash }
	];
	const renamed = treeChanges(renameBase, renameHead);
	expect(renamed).toEqual([
		{ path: 'src/utils/newName.ts', status: 'added' },
		{ path: 'src/utils/oldName.ts', status: 'removed' }
	]);
	recordExampleCases(
		{
			unitId: 'function.tree-changes',
			symbol: 'treeChanges',
			state: 'treechanges-reports-a-rename-as-a-removal-and-an-addition',
			evidence: 'examples-cases',
			file: 'treechanges-reports-a-rename-as-a-removal-and-an-addition.json'
		},
		[
			{
				name: 'src/utils/oldName.ts is renamed to src/utils/newName.ts with the same hash',
				input: { base: renameBase, head: renameHead },
				output: renamed
			}
		]
	);
});

test('treeChanges returns no changes when every hash matches', () => {
	const reordered: TreeEntry[] = [
		{ path: 'src/utils/treeChanges.ts', hash: treeChangesBaseHash },
		{ path: 'README.md', hash: readmeHash },
		{ path: 'src/legacy/oldReport.ts', hash: oldReportHash }
	];
	const same = treeChanges(base, base);
	const reorderedSame = treeChanges(base, reordered);
	expect(same).toEqual([]);
	expect(reorderedSame).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.tree-changes',
			symbol: 'treeChanges',
			state: 'treechanges-returns-no-changes-when-every-hash-matches',
			evidence: 'examples-cases',
			file: 'treechanges-returns-no-changes-when-every-hash-matches.json'
		},
		[
			{
				name: 'the same three files with the same hashes on both sides',
				input: { base, head: base },
				output: same
			},
			{
				name: 'the same three files with the same hashes, listed in a different order',
				input: { base, head: reordered },
				output: reorderedSame
			}
		]
	);
});

test('treeChanges reports every path against an empty listing', () => {
	const allAdded = treeChanges([], head);
	const allRemoved = treeChanges(base, []);
	expect(allAdded).toEqual([
		{ path: 'README.md', status: 'added' },
		{ path: 'docs/impact.md', status: 'added' },
		{ path: 'src/utils/treeChanges.ts', status: 'added' }
	]);
	expect(allRemoved).toEqual([
		{ path: 'README.md', status: 'removed' },
		{ path: 'src/legacy/oldReport.ts', status: 'removed' },
		{ path: 'src/utils/treeChanges.ts', status: 'removed' }
	]);
	recordExampleCases(
		{
			unitId: 'function.tree-changes',
			symbol: 'treeChanges',
			state: 'treechanges-reports-every-path-against-an-empty-listing',
			evidence: 'examples-cases',
			file: 'treechanges-reports-every-path-against-an-empty-listing.json'
		},
		[
			{
				name: 'an empty base lists all three head files as added, in plain string order',
				input: { base: [], head },
				output: allAdded
			},
			{
				name: 'an empty head lists all three base files as removed, in plain string order',
				input: { base, head: [] },
				output: allRemoved
			}
		]
	);
});

test('treeChanges keeps only the last hash of a repeated path', () => {
	const twiceInBase: TreeEntry[] = [
		{ path: 'src/utils/treeChanges.ts', hash: treeChangesBaseHash },
		{ path: 'src/utils/treeChanges.ts', hash: treeChangesHeadHash }
	];
	const onceInHead: TreeEntry[] = [
		{ path: 'src/utils/treeChanges.ts', hash: treeChangesHeadHash }
	];
	const onceInBase: TreeEntry[] = [
		{ path: 'src/utils/treeChanges.ts', hash: treeChangesBaseHash }
	];
	const twiceInHead: TreeEntry[] = [
		{ path: 'src/utils/treeChanges.ts', hash: treeChangesBaseHash },
		{ path: 'src/utils/treeChanges.ts', hash: treeChangesHeadHash }
	];
	const unchanged = treeChanges(twiceInBase, onceInHead);
	const modified = treeChanges(onceInBase, twiceInHead);
	expect(unchanged).toEqual([]);
	expect(modified).toEqual([{ path: 'src/utils/treeChanges.ts', status: 'modified' }]);
	recordExampleCases(
		{
			unitId: 'function.tree-changes',
			symbol: 'treeChanges',
			state: 'treechanges-keeps-only-the-last-hash-of-a-repeated-path',
			evidence: 'examples-cases',
			file: 'treechanges-keeps-only-the-last-hash-of-a-repeated-path.json'
		},
		[
			{
				name: 'the base lists src/utils/treeChanges.ts twice; its last hash matches the head, so nothing changed',
				input: { base: twiceInBase, head: onceInHead },
				output: unchanged
			},
			{
				name: 'the head lists src/utils/treeChanges.ts twice; its last hash differs from the base, so it is modified',
				input: { base: onceInBase, head: twiceInHead },
				output: modified
			}
		]
	);
});
