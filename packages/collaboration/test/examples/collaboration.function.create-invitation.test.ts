import { test } from 'vitest';
import {
	createInvitation,
	acceptInvitation
} from '../../src/utils/projects-sessions/create-collaboration/createInvitation';
import type {
	Actor,
	CollaborationDependencies,
	CollaborationRecords,
	CollaborationRepository,
	Member,
	StoredInvitation
} from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const projectId = '90a2c6c7-238d-4f87-9f62-1ec17a7d0012';
const invitationId = '7f08394f-65b9-4b87-94c6-1df28a6ce413';
const acceptedInvitationId = 'be19d2a1-8c70-4e63-9f52-3a6b1c4d8e20';
const now = '2026-11-15T12:00:00.000Z';
const actor = (id: string, email: string, name: string): Actor => ({
	id,
	email,
	name,
	emailVerified: true
});
const owner = actor('actor_alex_01', 'alex@example.com', 'Alex Rivera');
const sam = actor('actor_sam_02', 'sam@example.com', 'Sam Chen');
const writer = actor('actor_writer_03', 'jules@example.net', 'Jules Morgan');
const repositoryIdentity = {
	id: 84235671,
	owner: 'acme-build',
	name: 'launch-planning',
	private: true,
	installationId: 5720001
};
const project = {
	id: projectId,
	name: 'Launch planning',
	sourceRepository: repositoryIdentity,
	createdAt: '2026-10-20T09:30:00.000Z',
	ownerId: owner.id
};
const member = (actor: Actor, role: Member['role']): Member => ({
	projectId,
	actorId: actor.id,
	email: actor.email,
	name: actor.name,
	role
});
const ownerMember = member(owner, 'owner');
const samMember = member(sam, 'commenter');
const writerMember = member(writer, 'writer');
const revision = (n: number) => n.toString(16).padStart(40, '0');

function recordsBranch(
	members: Member[] = [ownerMember],
	invitations: StoredInvitation[] = [],
	conflict = false
) {
	let currentRevision = 1;
	let records: CollaborationRecords = {
		schemaVersion: 1,
		projects: [project],
		members,
		invitations,
		threads: []
	};
	const repository: CollaborationRepository = {
		async read() {
			return { revision: revision(currentRevision), records };
		},
		async compareAndSwap(expected, next) {
			if (conflict) return null;
			if (expected !== revision(currentRevision)) return null;
			records = next;
			currentRevision++;
			return revision(currentRevision);
		}
	};
	const deps: CollaborationDependencies = {
		repository,
		source: {
			resolve: async () => ({ commit: 'a'.repeat(40), tree: 'b'.repeat(40) }),
			tree: async () => [],
			read: async () => new Uint8Array(),
			validateAnchor: async () => {}
		},
		cache: { get: async () => null, put: async () => {}, delete: async () => {} },
		authorizeRepository: async () => repositoryIdentity,
		now: () => new Date(now)
	};
	return { deps, records: () => records, revision: () => revision(currentRevision) };
}

async function codeDigest(code: string) {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function errorSummary(error: unknown) {
	if (!(error instanceof Error)) return { message: String(error) };
	return { code: 'code' in error ? String(error.code) : null, message: error.message };
}

async function capture<T>(call: Promise<T>) {
	try {
		return { output: await call };
	} catch (error) {
		return { error: errorSummary(error) };
	}
}

function evidence(symbol: string, state: string) {
	return {
		unitId: 'collaboration.function.create-invitation',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('creates a hashed one-day invitation for an owner', async () => {
	const store = recordsBranch([ownerMember, writerMember]);
	const input = { projectId, email: 'Sam@Example.com', role: 'writer' as const };
	const issued = await createInvitation(store.deps, owner, input);
	const refusalInput = { projectId, email: 'lee@example.org', role: 'viewer' as const };
	const refused = await capture(createInvitation(store.deps, writer, refusalInput));
	const stored = store.records().invitations[0];
	const state = 'creates-a-hashed-one-day-invitation-for-an-owner';
	recordExampleCases(evidence('createInvitation', state), [
		{
			name: 'project owner invites Sam with a mixed-case email',
			input: { actor: owner, input, now },
			output: {
				invitation: issued,
				stored: {
					id: stored.id,
					email: stored.email,
					role: stored.role,
					expiresAt: stored.expiresAt,
					codeHash: stored.codeHash,
					acceptedBy: stored.acceptedBy
				}
			}
		},
		{
			name: 'project writer cannot issue another invitation',
			input: { actor: writer, input: refusalInput, now },
			...refused
		}
	]);
	const expiresAt = new Date(Date.parse(now) + 86400000).toISOString();
	expect(issued).toMatchObject({
		id: expect.stringMatching(/^[0-9a-f-]{36}$/),
		projectId,
		expiresAt
	});
	expect(issued.code).toMatch(/^[a-f0-9]{64}$/);
	expect(stored).toMatchObject({ email: 'sam@example.com', role: 'writer', acceptedBy: null });
	expect(stored.codeHash).toBe(await codeDigest(issued.code));
	expect(refused.error).toEqual({ code: 'forbidden', message: 'Collaboration forbidden' });
	expect(store.records().invitations).toHaveLength(1);
	expect(store.revision()).toBe(revision(2));
});

test('accepts an invitation and retains an existing member role', async () => {
	const code = '4f8a2c1d9e7b3a605c4d8f2a1b6e9c073a5d1f8b2e4c6a901d3f5b7e8a2c4d6f';
	const codeHash = await codeDigest(code);
	const invitationFor = (id: string): StoredInvitation => ({
		id,
		projectId,
		expiresAt: '2026-11-16T12:00:00.000Z',
		codeHash,
		email: sam.email,
		role: 'writer',
		acceptedBy: null
	});
	const newMemberStore = recordsBranch([ownerMember], [invitationFor(invitationId)]);
	const existingMemberStore = recordsBranch(
		[ownerMember, samMember],
		[invitationFor(acceptedInvitationId)]
	);
	const accept = (store: ReturnType<typeof recordsBranch>, id: string) =>
		acceptInvitation(store.deps, sam, { projectId, invitationId: id, code });
	const added = await accept(newMemberStore, invitationId);
	const retained = await accept(existingMemberStore, acceptedInvitationId);
	const newMember = newMemberStore.records().members.find((member) => member.actorId === sam.id);
	const existingMember = existingMemberStore
		.records()
		.members.find((member) => member.actorId === sam.id);
	const state = 'accepts-an-invitation-and-retains-an-existing-member-role';
	recordExampleCases(evidence('acceptInvitation', state), [
		{
			name: 'verified invitee becomes a writer member',
			input: { actor: sam, input: { projectId, invitationId, code }, now },
			output: {
				project: { id: added.id, name: added.name, role: added.role },
				member: newMember,
				acceptedBy: newMemberStore.records().invitations[0].acceptedBy
			}
		},
		{
			name: 'existing commenter keeps that role after accepting a writer invitation',
			input: { actor: sam, input: { projectId, invitationId: acceptedInvitationId, code }, now },
			output: {
				project: { id: retained.id, name: retained.name, role: retained.role },
				member: existingMember,
				acceptedBy: existingMemberStore.records().invitations[0].acceptedBy
			}
		}
	]);
	expect(added).toMatchObject({ id: projectId, name: 'Launch planning', role: 'writer' });
	expect(newMember).toMatchObject({ actorId: sam.id, email: sam.email, role: 'writer' });
	expect(newMemberStore.records().invitations[0].acceptedBy).toBe(sam.id);
	expect(newMemberStore.records().members).toHaveLength(2);
	expect(retained.role).toBe('commenter');
	expect(existingMember?.role).toBe('commenter');
	expect(existingMemberStore.records().invitations[0].acceptedBy).toBe(sam.id);
});

test('Throws Error when invitation input is invalid', async () => {
	const store = recordsBranch();
	const input = { projectId: 'bad', email: 'nope', role: 'owner' as const };
	const result = await capture(createInvitation(store.deps, owner, input as never));
	const state = 'throws-error-when-invitation-input-is-invalid';
	recordExampleCases(evidence('createInvitation', state), [
		{ name: 'reject malformed invitation fields', input, ...result }
	]);
	expect(result.error).toEqual({ code: 'invalid-input', message: 'Collaboration invalid-input' });
});

test('Throws Error when invitation creation is forbidden', async () => {
	const store = recordsBranch([ownerMember, writerMember]);
	const input = { projectId, email: 'lee@example.org', role: 'viewer' as const };
	const result = await capture(createInvitation(store.deps, writer, input));
	const state = 'throws-error-when-invitation-creation-is-forbidden';
	recordExampleCases(evidence('createInvitation', state), [
		{ name: 'writer attempts to invite', input: { actor: writer, input }, ...result }
	]);
	expect(result.error).toEqual({ code: 'forbidden', message: 'Collaboration forbidden' });
});

test('Throws Error when invitation cannot be accepted', async () => {
	const store = recordsBranch();
	const input = {
		projectId,
		invitationId,
		code: '4f8a2c1d9e7b3a605c4d8f2a1b6e9c073a5d1f8b2e4c6a901d3f5b7e8a2c4d6f'
	};
	const result = await capture(acceptInvitation(store.deps, sam, input));
	const state = 'throws-error-when-invitation-cannot-be-accepted';
	recordExampleCases(evidence('acceptInvitation', state), [
		{ name: 'unknown invitation id is rejected', input, ...result }
	]);
	expect(result.error).toEqual({
		code: 'invalid-invitation',
		message: 'Collaboration invalid-invitation'
	});
});

test('Throws Error when invitation transaction conflicts repeatedly', async () => {
	const store = recordsBranch([ownerMember], [], true);
	const input = { projectId, email: 'sam@example.com', role: 'writer' as const };
	const result = await capture(createInvitation(store.deps, owner, input));
	const state = 'throws-error-when-invitation-transaction-conflicts-repeatedl';
	recordExampleCases(evidence('createInvitation', state), [
		{ name: 'five compare-and-swap attempts fail', input, ...result }
	]);
	expect(result.error).toEqual({ code: 'conflict', message: 'Collaboration conflict' });
});
