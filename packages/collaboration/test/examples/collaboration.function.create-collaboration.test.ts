import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createCollaboration } from '../../src/utils/projects-sessions/create-collaboration/createCollaboration';

test('Creates the nine-operation API without calling adapters', () => {
	const api = createCollaboration({} as Parameters<typeof createCollaboration>[0]);
	const methods = Object.keys(api);
	const state = 'creates-the-nine-operation-api-without-calling-adapters';

	expect(methods).toEqual([
		'listProjects',
		'createProject',
		'getProject',
		'listMembers',
		'removeMember',
		'createInvitation',
		'acceptInvitation',
		'addComment',
		'listThreads'
	]);
	recordExampleCases(
		{
			unitId: 'collaboration.function.create-collaboration',
			symbol: 'createCollaboration',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'construct API using the dependency bundle without invoking it',
				input: { dependencyMethodsCalled: [] },
				output: { methods }
			}
		]
	);
});
