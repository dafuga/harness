import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createCollaboration } from '../../src/utils/projects-sessions/create-collaboration/createCollaboration';

const actor = {
	id: '1f2e3d4c-5b6a-4987-8a6b-5c4d3e2f1a0b',
	email: 'owner@example.com',
	name: 'Owner Example',
	emailVerified: true as const
};
const projectId = '5c1d9e2a-7b3f-4e8a-8d6c-1a2b3c4d5e6f';
const invitationId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const code = '3f9a'.repeat(16);
const emptyRecords = { schemaVersion: 1, projects: [], members: [], invitations: [], threads: [] };
const deps = {
	repository: {
		read: () => Promise.resolve({ revision: 'rev-1', records: emptyRecords }),
		compareAndSwap: () => Promise.resolve(null)
	}
} as unknown as Parameters<typeof createCollaboration>[0];

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

test('Throws invalid-invitation when invitation does not exist', async () => {
	const api = createCollaboration(deps);
	const state = 'throws-invalid-invitation-when-invitation-does-not-exist';
	const input = { projectId, invitationId, code };

	const error = await api.acceptInvitation(actor, input).catch((caught: unknown) => caught);

	expect(error).toMatchObject({ code: 'invalid-invitation' });
	recordExampleCases(
		{
			unitId: 'collaboration.function.create-collaboration',
			symbol: 'acceptInvitation',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'accept an invitation id that matches no record in an empty project',
				input: { actor: actor.email, ...input },
				error: { code: 'invalid-invitation' }
			}
		]
	);
});
