import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { historyRefs } from '../../src/cli/program/history-sync-service/historyRefs';
import { sourceArchiveRef, refKind } from '../../src/utils/git-source-history/historyRefs';
import type { RefKind } from '../../src/utils/git-source-history/historyRefs.types';

const commitA = '3f9a1c7e2b4d8a06c5e1f92b7d3a8c4e6f0b1d25';
const commitB = '9c2e4b7f1a0d3e8c5b6a2f9d1e7c4b3a8f0d6e21';

const classifiedRefs: Array<[string, RefKind]> = [
	['refs/heads/main', 'source'],
	['refs/heads/harness-evidence', 'evidence'],
	['refs/notes/harness', 'notes'],
	[`refs/harness/source/${commitA}`, 'archive'],
	['refs/harness/internal-cache', 'internal'],
	['refs/tags/v1.2.0', 'tag'],
	['refs/remotes/origin/main', 'remote'],
	['main', 'other']
];

test('Archive ref keeps each tested commit', () => {
	const archives = [commitA, commitB].map((commit) => sourceArchiveRef(commit));

	expect(archives).toEqual([`refs/harness/source/${commitA}`, `refs/harness/source/${commitB}`]);
	recordExampleCases(
		{
			unitId: 'function.history-refs',
			symbol: 'sourceArchiveRef',
			state: 'archive-ref-keeps-each-tested-commit',
			evidence: 'examples-cases',
			file: 'archive-ref-keeps-each-tested-commit.json'
		},
		[
			{ name: 'first tested commit', input: commitA, output: archives[0] },
			{ name: 'second tested commit', input: commitB, output: archives[1] }
		]
	);
});

test('Reference kind separates code branches from history', () => {
	const kinds = classifiedRefs.map(([ref]) => refKind(ref));

	expect(kinds).toEqual(classifiedRefs.map(([, kind]) => kind));
	recordExampleCases(
		{
			unitId: 'function.history-refs',
			symbol: 'refKind',
			state: 'reference-kind-separates-code-branches-from-history',
			evidence: 'examples-cases',
			file: 'reference-kind-separates-code-branches-from-history.json'
		},
		classifiedRefs.map(([ref, kind]) => ({
			name: `classifies ${ref}`,
			input: ref,
			output: kind
		}))
	);
});

test('History refs names the evidence, notes and archive patterns', () => {
	const names = historyRefs();

	expect(names).toEqual({
		evidence: 'refs/heads/harness-evidence',
		notes: 'refs/notes/harness',
		archives: 'refs/harness/source/*'
	});
	recordExampleCases(
		{
			unitId: 'function.history-refs',
			symbol: 'historyRefs',
			state: 'history-refs-names-the-evidence-notes-and-archive-patterns',
			evidence: 'examples-cases',
			file: 'history-refs-names-the-evidence-notes-and-archive-patterns.json'
		},
		[{ name: 'history names take no input', input: {}, output: names }]
	);
});
