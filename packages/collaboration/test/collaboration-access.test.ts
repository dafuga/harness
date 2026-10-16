import { expect, test } from 'vitest';
import { anchor, collaborationFixture, guest, owner } from './githubFixture';
test('viewer grants never authorize writes or another project and revocation takes effect immediately', async () => {
	const { api } = collaborationFixture();
	const first = await api.createProject(owner, { name: 'One', repositoryId: 202 });
	const second = await api.createProject(owner, { name: 'Two', repositoryId: 202 });
	const invitation = await api.createInvitation(owner, {
		projectId: first.id,
		email: guest.email.toUpperCase(),
		role: 'viewer'
	});
	await api.acceptInvitation(guest, {
		projectId: first.id,
		invitationId: invitation.id,
		code: invitation.code
	});
	expect((await api.listProjects(guest)).map((p) => p.id)).toEqual([first.id]);
	await expect(api.getProject(guest, second.id)).rejects.toMatchObject({ code: 'forbidden' });
	await expect(
		api.addComment(guest, {
			projectId: first.id,
			requestId: crypto.randomUUID(),
			anchor,
			text: 'Denied viewer'
		})
	).rejects.toMatchObject({ code: 'forbidden' });
	await expect(
		api.createInvitation(guest, {
			projectId: first.id,
			email: 'next@example.test',
			role: 'commenter'
		})
	).rejects.toMatchObject({ code: 'forbidden' });
	await api.removeMember(owner, { projectId: first.id, memberId: guest.id });
	await expect(
		api.listThreads(guest, {
			projectId: first.id,
			entityId: anchor.entityId,
			commit: anchor.commit
		})
	).rejects.toMatchObject({ code: 'forbidden' });
	await expect(
		api.acceptInvitation(guest, {
			projectId: first.id,
			invitationId: invitation.id,
			code: invitation.code
		})
	).rejects.toMatchObject({ code: 'invalid-invitation' });
});
test('invitations reject expiry, action/project mismatch and unverified identities without writes', async () => {
	const { api, clock, remote } = collaborationFixture();
	const first = await api.createProject(owner, { name: 'One', repositoryId: 202 });
	const second = await api.createProject(owner, { name: 'Two', repositoryId: 202 });
	const invitation = await api.createInvitation(owner, {
		projectId: first.id,
		email: guest.email,
		role: 'commenter'
	});
	const before = remote.revision();
	await expect(
		api.acceptInvitation(guest, {
			projectId: second.id,
			invitationId: invitation.id,
			code: invitation.code
		})
	).rejects.toMatchObject({ code: 'invalid-invitation' });
	await expect(
		api.listProjects({ ...guest, emailVerified: false } as unknown as typeof guest)
	).rejects.toMatchObject({ code: 'invalid-input' });
	clock.value = new Date('2026-10-14T00:00:00Z');
	await expect(
		api.acceptInvitation(guest, {
			projectId: first.id,
			invitationId: invitation.id,
			code: invitation.code
		})
	).rejects.toMatchObject({ code: 'invalid-invitation' });
	expect(remote.revision()).toBe(before);
	expect(remote.records().invitations[0].acceptedBy).toBeNull();
});
