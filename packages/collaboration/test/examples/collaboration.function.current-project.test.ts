import { test } from 'vitest';
import { readRecords } from '../../src/utils/projects-sessions/create-collaboration/readRecords';
import { currentProject, transaction } from '../../src/utils/projects-sessions/currentProject';
import type {
	Actor,
	CollaborationDependencies,
	CollaborationRecords,
	CollaborationRepository
} from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
const projectId = '7d4e1b9a-3c52-4f80-9a6e-b1c2d3e4f5a6';
const owner: Actor = {
	id: 'google-110418263957201846395',
	email: 'maya.chen@example.com',
	name: 'Maya Chen',
	emailVerified: true
};
const writer: Actor = {
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
const records: CollaborationRecords = {
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
function summarizeRecords(value: CollaborationRecords) {
	return { project: value.projects[0]?.name, roles: value.members.map((member) => member.role) };
}
function summarizeProject(value: ReturnType<typeof currentProject>) {
	return { id: value.id, name: value.name, ownerId: value.ownerId, role: value.role };
}
function dependencies(repository: CollaborationRepository): CollaborationDependencies {
	return { repository } as CollaborationDependencies;
}
function errorSummary(error: unknown) {
	if (!(error instanceof Error) || !('code' in error)) throw error;
	return { name: error.name, message: error.message, code: String(error.code) };
}
async function retryTransaction() {
	const latestRecords: CollaborationRecords = {
		...records,
		projects: records.projects.map((project) => ({
			...project,
			name: 'Design system audit (remote rename)'
		}))
	};
	const snapshots = [
		{ revision: '1'.repeat(40), records },
		{ revision: '2'.repeat(40), records: latestRecords }
	];
	const writes: Array<{ expected: string; projectName: string }> = [];
	let reads = 0;
	let attempts = 0;
	const repository: CollaborationRepository = {
		read: async () => snapshots[reads++] ?? snapshots[1]!,
		compareAndSwap: async (expected, next) => {
			writes.push({ expected, projectName: next.projects[0]?.name ?? '' });
			return writes.length === 1 ? null : '3'.repeat(40);
		}
	};
	const result = await transaction(dependencies(repository), async (current) => {
		attempts++;
		const project = current.projects[0];
		if (!project) throw new Error('Expected a project in the snapshot');
		project.name = `${project.name} — reviewed`;
		return project.name;
	});
	return {
		snapshots: snapshots.map(({ revision, records: value }) => ({
			revision,
			records: summarizeRecords(value)
		})),
		output: { value: result.value, revision: result.revision, attempts, reads, writes }
	};
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
test('Resolves project membership and enforces allowed roles', () => {
	const ownerProject = currentProject(records, owner, projectId);
	const writerProject = currentProject(records, writer, projectId, ['owner', 'writer']);
	let denied: ReturnType<typeof errorSummary> | undefined;
	try {
		currentProject(records, writer, projectId, ['owner']);
	} catch (error) {
		denied = errorSummary(error);
	}
	const ownerOutput = summarizeProject(ownerProject);
	const writerOutput = summarizeProject(writerProject);
	const cases = [
		{
			name: 'owner membership uses the default allowed roles',
			input: { records: summarizeRecords(records), actor: owner, projectId },
			output: ownerOutput
		},
		{
			name: 'writer membership is returned when the caller allows writers',
			input: {
				records: summarizeRecords(records),
				actor: writer,
				projectId,
				roles: ['owner', 'writer']
			},
			output: writerOutput
		},
		{
			name: 'writer membership is refused when only owners are allowed',
			input: { records: summarizeRecords(records), actor: writer, projectId, roles: ['owner'] },
			error: denied
		}
	];
	recordExampleCases(
		{
			unitId: 'collaboration.function.current-project',
			symbol: 'currentProject',
			state: 'resolves-project-membership-and-enforces-allowed-roles',
			evidence: 'examples-cases',
			file: 'resolves-project-membership-and-enforces-allowed-roles.json'
		},
		cases
	);
	expect(ownerOutput.role).toBe('owner');
	expect(writerOutput.role).toBe('writer');
	expect(denied).toEqual({
		name: 'CollaborationInputError',
		message: 'Collaboration forbidden',
		code: 'forbidden'
	});
});
test('Retries record changes against the current revision', async () => {
	const { snapshots, output } = await retryTransaction();
	recordExampleCases(
		{
			unitId: 'collaboration.function.current-project',
			symbol: 'transaction',
			state: 'retries-record-changes-against-the-current-revision',
			evidence: 'examples-cases',
			file: 'retries-record-changes-against-the-current-revision.json'
		},
		[
			{
				name: 'retries a compare-and-swap conflict from a fresh snapshot',
				input: { snapshots, change: 'append — reviewed to the project name' },
				output
			}
		]
	);
	expect(output).toEqual({
		value: 'Design system audit (remote rename) — reviewed',
		revision: '3'.repeat(40),
		attempts: 2,
		reads: 2,
		writes: [
			{ expected: '1'.repeat(40), projectName: 'Design system audit — reviewed' },
			{ expected: '2'.repeat(40), projectName: 'Design system audit (remote rename) — reviewed' }
		]
	});
});
test('Throws Error when repository records fail validation', async () => {
	const repository: CollaborationRepository = {
		read: async () => ({ revision: '4'.repeat(40), records: {} as CollaborationRecords }),
		compareAndSwap: async () => null
	};
	let failure: ReturnType<typeof errorSummary> | undefined;
	try {
		await readRecords(dependencies(repository));
	} catch (error) {
		failure = errorSummary(error);
	}
	expect(failure?.code).toBe('invalid-input');
	recordExampleCases(
		{
			unitId: 'collaboration.function.current-project',
			symbol: 'readRecords',
			state: 'throws-error-when-repository-records-fail-validation',
			evidence: 'examples-cases',
			file: 'throws-error-when-repository-records-fail-validation.json'
		},
		[
			{
				name: 'rejects a repository snapshot with missing record collections',
				input: { revision: '4'.repeat(40), records: {} },
				error: failure
			}
		]
	);
});
test('Throws Error after five unsuccessful compare-and-swap writes', async () => {
	const repository: CollaborationRepository = {
		read: async () => ({ revision: '5'.repeat(40), records }),
		compareAndSwap: async () => null
	};
	let failure: ReturnType<typeof errorSummary> | undefined;
	try {
		await transaction(dependencies(repository), async (current) => {
			current.projects[0]!.name += ' reviewed';
			return current.projects[0]!.name;
		});
	} catch (error) {
		failure = errorSummary(error);
	}
	expect(failure?.code).toBe('conflict');
	recordExampleCases(
		{
			unitId: 'collaboration.function.current-project',
			symbol: 'transaction',
			state: 'throws-error-after-five-unsuccessful-compare-and-swap-writes',
			evidence: 'examples-cases',
			file: 'throws-error-after-five-unsuccessful-compare-and-swap-writes.json'
		},
		[
			{
				name: 'reports conflict after every write loses the revision race',
				input: { revision: '5'.repeat(40), writeAttempts: 5 },
				error: failure
			}
		]
	);
});
