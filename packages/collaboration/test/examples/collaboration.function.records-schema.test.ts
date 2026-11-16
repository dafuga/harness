import { test } from 'vitest';
import { projectSchema, recordsSchema } from '../../src/utils/development-tooling/recordsSchema';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const projectInput = {
	id: '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
	name: '  Quarterly launch review  ',
	sourceRepository: {
		id: 202,
		owner: 'acme-platform',
		name: 'release-service',
		private: true,
		installationId: 7
	},
	createdAt: '2026-11-16T10:00:00.000Z',
	ownerId: ' owner-0142 '
};
const ownerMember = {
	projectId: projectInput.id,
	actorId: 'owner-0142',
	email: 'Owner@Example.test',
	name: ' Morgan Chen ',
	role: 'owner' as const
};
const comment = {
	id: '9b7d5f3a-1c2e-4a6b-8d0f-2e4c6a8b0d1f',
	requestId: '00000000-0000-4000-8000-000000000014',
	actor: {
		id: 'owner-0142',
		email: 'OWNER@Example.test',
		name: ' Morgan Chen ',
		emailVerified: true
	},
	text: '  Confirm the owner binding before launch.  ',
	createdAt: '2026-11-16T10:15:00.000Z'
};
const thread = {
	id: '3c5e7a9b-1d2f-4a6c-8e0b-2d4f6a8c0e1b',
	projectId: projectInput.id,
	anchor: {
		branch: 'main',
		commit: '0123456789abcdef0123456789abcdef01234567',
		entityId: 'collaboration.function.records-schema',
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	},
	comments: [comment]
};
const snapshotInput = {
	schemaVersion: 1,
	projects: [projectInput],
	members: [ownerMember],
	invitations: [],
	threads: [thread]
};
const invitation = {
	id: '4a6c8e0b-2d4f-4a6c-8e0b-2d4f6a8c0e1b',
	projectId: projectInput.id,
	expiresAt: '2026-12-01T10:00:00.000Z',
	codeHash: 'a'.repeat(64),
	email: 'invitee@example.test',
	role: 'writer',
	acceptedBy: null
};
const duplicateInput = {
	...snapshotInput,
	projects: [projectInput, projectInput],
	members: [ownerMember, ownerMember],
	invitations: [invitation, invitation],
	threads: [
		thread,
		{
			...thread,
			comments: [
				{
					...comment,
					id: '8a0c2e4f-6b1d-4a3c-9e5f-7b0d2a4c6e8f',
					requestId: '00000000-0000-4000-8000-000000000015'
				}
			]
		}
	]
};
const unboundInput = {
	...snapshotInput,
	members: [{ ...ownerMember, projectId: '7a9b1d3f-5c2e-4a6b-8d0f-1e3c5a7b9d2f' }],
	threads: [
		{
			...thread,
			comments: [comment, { ...comment, id: '8a0c2e4f-6b1d-4a3c-9e5f-7b0d2a4c6e8f' }]
		}
	]
};

function captureError(parse: () => unknown) {
	try {
		parse();
		return { name: 'NoError', issues: [] };
	} catch (error) {
		if (!(error instanceof Error)) return { name: 'UnknownError', issues: [] };
		const issues = (
			error as Error & {
				issues?: Array<{
					code: string;
					path: Array<string | number>;
					message: string;
				}>;
			}
		).issues;
		return {
			name: error.name,
			issues: (issues ?? []).map(({ code, path, message }) => ({ code, path, message }))
		};
	}
}

function summarizeRecords(records: ReturnType<typeof recordsSchema.parse>) {
	return {
		projects: records.projects.map(({ id, name }) => ({ id, name })),
		members: records.members.map(({ projectId, actorId, email, role }) => ({
			projectId,
			actorId,
			email,
			role
		})),
		comments: records.threads.flatMap(({ id, comments }) =>
			comments.map(({ requestId, text }) => ({ threadId: id, requestId, text }))
		)
	};
}

test('Parses a strict project record', () => {
	const accepted = projectSchema.parse(projectInput);
	const unknownField = { ...projectInput, visibility: 'team' };
	const rejected = captureError(() => projectSchema.parse(unknownField));
	const state = 'parses-a-strict-project-record';

	recordExampleCases(
		{
			unitId: 'collaboration.function.records-schema',
			symbol: 'projectSchema',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'valid project labels are trimmed and repository details are kept',
				input: projectInput,
				output: accepted
			},
			{ name: 'unknown project fields are rejected', input: unknownField, error: rejected }
		]
	);

	expect(accepted).toMatchObject({ name: 'Quarterly launch review', ownerId: 'owner-0142' });
	expect(rejected.name).toBe('ZodError');
	expect(rejected.issues.map(({ code }) => code)).toContain('unrecognized_keys');
});

test('Validates snapshot ownership and record integrity', () => {
	const accepted = recordsSchema.parse(snapshotInput);
	const duplicateError = captureError(() => recordsSchema.parse(duplicateInput));
	const unboundError = captureError(() => recordsSchema.parse(unboundInput));
	const parsedSummary = summarizeRecords(accepted);
	const state = 'validates-snapshot-ownership-and-record-integrity';

	recordExampleCases(
		{
			unitId: 'collaboration.function.records-schema',
			symbol: 'recordsSchema',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'owner member and comment are normalized in a valid snapshot',
				input: snapshotInput,
				output: parsedSummary
			},
			{
				name: 'duplicate record identities are rejected',
				input: duplicateInput,
				error: duplicateError
			},
			{
				name: 'missing owner, unbound member and repeated request are rejected',
				input: unboundInput,
				error: unboundError
			}
		]
	);

	expect(parsedSummary.comments).toEqual([
		{
			threadId: thread.id,
			requestId: comment.requestId,
			text: 'Confirm the owner binding before launch.'
		}
	]);
	expect(accepted.members[0].email).toBe('owner@example.test');
	expect(duplicateError.issues.map(({ message }) => message)).toContain(
		'Duplicate record identity'
	);
	expect(unboundError.issues.map(({ message }) => message)).toEqual([
		'Unbound record',
		'Missing owner',
		'Duplicate request'
	]);
});
