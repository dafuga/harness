import { test } from 'vitest';
import * as collaborationTypes from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The Collaboration model declares types only, so its real code is the module itself: a caller
 * imports it and gets no runtime value. The loaded module is checked for runtime exports, and each
 * type the model owns is looked up on it. What was given and what came back are the state's cases.
 */

/** Every type the model owns, as its manifest lists them. Each is declared as a type only. */
const ownedTypeNames = [
	'Role',
	'Actor',
	'RepositoryIdentity',
	'Project',
	'ProjectSummary',
	'Member',
	'Invitation',
	'Anchor',
	'Comment',
	'Thread',
	'CommittedThread',
	'StoredInvitation',
	'CollaborationRecords',
	'RecordSnapshot',
	'CollaborationRepository',
	'SourceCommit',
	'SourceEntry',
	'SourceAdapter',
	'CacheIdentity',
	'CacheEntry',
	'CollaborationCache',
	'CollaborationDependencies',
	'AddCommentInput',
	'CollaborationApi',
	'GitHubOptions',
	'GitHubRepositoryOptions',
	'SourceCommitFacts',
	'SourceHistoryAdapter',
	'SourceHistoryCommit',
	'SourceHistoryPage',
	'SourceHistoryPageInput'
];

test('Importing the Collaboration model returns no runtime value', () => {
	const runtimeExports = Object.keys(collaborationTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in collaborationTypes);
	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'collaboration.model.collaboration-types',
			symbol: 'Collaboration.types',
			state: 'importing-the-collaboration-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-collaboration-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/collaboration/src/models/planning-collaboration/Collaboration.types.ts'
				},
				output: { runtimeExports }
			},
			{
				name: 'look up each type the model owns in the loaded module',
				input: { names: ownedTypeNames },
				output: { runtimeValues }
			}
		]
	);
});
