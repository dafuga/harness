import { test } from 'vitest';
import { readRecords } from '../../src/utils/projects-sessions/create-collaboration/readRecords';
import type {
	Actor,
	CollaborationDependencies,
	CollaborationRecords,
	CollaborationRepository
} from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

export const projectId = '7d4e1b9a-3c52-4f80-9a6e-b1c2d3e4f5a6';
export const owner: Actor = {
	id: 'google-110418263957201846395',
	email: 'maya.chen@example.com',
	name: 'Maya Chen',
	emailVerified: true
};
export const writer: Actor = {
	id: 'google-209884713522600918374',
	email: 'jonas.reyes@example.com',
	name: 'Jonas Reyes',
	emailVerified: true
};
const sourceRepository = {
	id: 612088341,
	owner: 'acme-design',
	name: 'design-system',
	private: true,
	installationId: 48213907
};
export const records: CollaborationRecords = {
	schemaVersion: 1,
	projects: [
		{
			id: projectId,
			name: 'Design system audit',
			sourceRepository,
			createdAt: '2026-09-08T16:42:10.000Z',
			ownerId: owner.id
		}
	],
	members: [
		{ projectId, actorId: owner.id, email: owner.email, name: owner.name, role: 'owner' },
		{ projectId, actorId: writer.id, email: writer.email, name: writer.name, role: 'writer' }
	],
	invitations: [],
	threads: []
};
export function summarizeRecords(value: CollaborationRecords) {
	return { project: value.projects[0]?.name, roles: value.members.map((member) => member.role) };
}
export function dependencies(repository: CollaborationRepository): CollaborationDependencies {
	return { repository } as CollaborationDependencies;
}
test('Reads and validates a repository snapshot', async () => {
	const snapshot = { revision: '4'.repeat(40), records };
	const repository: CollaborationRepository = {
		read: async () => snapshot,
		compareAndSwap: async () => null
	};
	const result = await readRecords(dependencies(repository));
	const output = summarizeRecords(result);
	recordExampleCases(
		{
			unitId: 'collaboration.function.current-project',
			symbol: 'readRecords',
			state: 'reads-and-validates-a-repository-snapshot',
			evidence: 'examples-cases',
			file: 'reads-and-validates-a-repository-snapshot.json'
		},
		[
			{
				name: 'reads a valid collaboration snapshot and returns its records',
				input: { revision: snapshot.revision, records: summarizeRecords(snapshot.records) },
				output
			}
		]
	);
	expect(output).toEqual(summarizeRecords(records));
});
