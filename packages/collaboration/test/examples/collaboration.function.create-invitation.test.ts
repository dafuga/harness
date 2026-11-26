import { test } from 'vitest';
import {
	createInvitation,
	acceptInvitation
} from '../../src/utils/projects-sessions/create-collaboration/createInvitation';
import type { StoredInvitation } from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import {
	actor,
	member,
	codeDigest,
	projectId,
	recordsBranch,
	ownerMember,
	evidence,
	now,
	capture,
	owner,
	writerMember,
	writer
} from './collaboration.function.create-invitation.cases';

const invitationId = '7f08394f-65b9-4b87-94c6-1df28a6ce413';
const acceptedInvitationId = 'be19d2a1-8c70-4e63-9f52-3a6b1c4d8e20';
const sam = actor('actor_sam_02', 'sam@example.com', 'Sam Chen');
const samMember = member(sam, 'commenter');

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
