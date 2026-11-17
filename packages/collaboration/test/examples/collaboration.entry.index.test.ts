import { test } from 'vitest';
import * as collaborationEntry from '../../src/index';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('Exports the collaboration entry operations', () => {
	const exportedOperations = Object.keys(collaborationEntry).sort();
	expect(exportedOperations).toEqual([
		'cacheKey',
		'createCollaboration',
		'createGitHubRepository',
		'createGitHubSource',
		'githubHistory',
		'githubHistoryPage',
		'readCache',
		'writeCache'
	]);
	recordExampleCases(
		{
			unitId: 'collaboration.entry.index',
			symbol: 'index',
			state: 'exports-the-collaboration-entry-operations',
			evidence: 'examples-cases',
			file: 'exports-the-collaboration-entry-operations.json'
		},
		[
			{
				name: 'load the collaboration package entry point',
				input: { module: 'packages/collaboration/src/index.ts' },
				output: { exportedOperations }
			}
		]
	);
});
