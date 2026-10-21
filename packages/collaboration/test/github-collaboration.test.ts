import { expect, test } from 'vitest';
import { anchor, collaborationFixture, guest, owner } from './githubFixture';
import { recordsSchema, projectSchema } from '../src/utils/recordsSchema';
import { profilePublicEntry, taskProfile } from '../../../test/support/taskProfiles';
import { resolve } from 'node:path';
test('GitHub authority rejects unknown members and public storage; invitation is hashed and consumed once', async () => {
	const { api, remote } = collaborationFixture();
	const project = await api.createProject(owner, { name: 'Private project', repositoryId: 202 });
	await expect(api.getProject(guest, project.id)).rejects.toMatchObject({ code: 'forbidden' });
	const invite = await api.createInvitation(owner, {
		projectId: project.id,
		email: guest.email,
		role: 'commenter'
	});
	expect(JSON.stringify(remote.records())).not.toContain(invite.code);
	await expect(
		api.acceptInvitation(
			{ ...guest, email: 'other@example.test' },
			{ projectId: project.id, invitationId: invite.id, code: invite.code }
		)
	).rejects.toMatchObject({ code: 'invalid-invitation' });
	expect(
		(
			await api.acceptInvitation(guest, {
				projectId: project.id,
				invitationId: invite.id,
				code: invite.code
			})
		).role
	).toBe('commenter');
	await expect(
		api.acceptInvitation(guest, {
			projectId: project.id,
			invitationId: invite.id,
			code: invite.code
		})
	).rejects.toMatchObject({ code: 'invalid-invitation' });
	await expect(
		api.removeMember(owner, { projectId: project.id, memberId: owner.id })
	).rejects.toMatchObject({ code: 'sole-owner' });
	remote.public = true;
	await expect(api.listProjects(owner)).rejects.toMatchObject({ code: 'repository-denied' });
	expect(
		remote.scopes.every((s) => s.repositoryIds.length === 1 && s.repositoryIds[0] === 101)
	).toBe(true);
	const records = remote.records();
	await taskProfile(
		'collaboration.function.records-schema',
		'parse-two-member-project-records',
		() => {
			projectSchema.parse(records.projects[0]);
			return recordsSchema.parse(records);
		}
	);
	expect(recordsSchema.parse(records)).toEqual(records);
	await publicEntry();
});

async function publicEntry() {
	const names = [
		'createCollaboration',
		'createGitHubRepository',
		'createGitHubSource',
		'cacheKey',
		'readCache',
		'writeCache',
		'githubHistory',
		'githubHistoryPage'
	];
	expect(
		await profilePublicEntry(
			'collaboration.entry.index',
			resolve(import.meta.dirname, '../src/index.ts'),
			names
		)
	).toEqual(names);
}
test('concurrent comments retain all messages and same request is idempotent without agents', async () => {
	const { api, remote } = collaborationFixture();
	const project = await api.createProject(owner, { name: 'Project', repositoryId: 202 });
	const input = {
		projectId: project.id,
		requestId: crypto.randomUUID(),
		anchor,
		text: 'Human historical comment'
	};
	const first = await api.addComment(owner, input);
	const second = await api.addComment(owner, input);
	expect(second.id).toBe(first.id);
	expect(second.comments).toHaveLength(1);
	const results = await Promise.all(
		['A', 'B'].map((text) =>
			api.addComment(owner, { ...input, threadId: first.id, requestId: crypto.randomUUID(), text })
		)
	);
	expect(
		(
			await api.listThreads(owner, {
				projectId: project.id,
				entityId: anchor.entityId,
				commit: anchor.commit
			})
		)[0].comments
			.map((c) => c.text)
			.sort()
	).toEqual(['A', 'B', input.text].sort());
	expect(results.every((result) => /^[a-f0-9]{40}$/.test(result.collaborationCommit))).toBe(true);
	expect(
		remote.calls.filter((c) => c.method === 'PATCH').every((c) => c.body.force === false)
	).toBe(true);
	await expect(
		api.addComment(owner, { ...input, text: 'Different payload' })
	).rejects.toMatchObject({ code: 'request-conflict' });
});
test('revocation racing a comment prevents stale authorized write after Git conflict', async () => {
	const { api, remote } = collaborationFixture();
	const project = await api.createProject(owner, { name: 'Project', repositoryId: 202 });
	const invite = await api.createInvitation(owner, {
		projectId: project.id,
		email: guest.email,
		role: 'commenter'
	});
	await api.acceptInvitation(guest, {
		projectId: project.id,
		invitationId: invite.id,
		code: invite.code
	});
	remote.beforePatch = () => {
		const state = remote.records();
		state.members = state.members.filter((m) => m.actorId !== guest.id);
		remote.replace(state);
	};
	await expect(
		api.addComment(guest, {
			projectId: project.id,
			requestId: crypto.randomUUID(),
			anchor,
			text: 'Revoked race'
		})
	).rejects.toMatchObject({ code: 'forbidden' });
	expect(remote.records().threads).toEqual([]);
});

test('failed repository authorization never exposes provider errors or writes GitHub records', async () => {
	const { api, remote } = collaborationFixture();
	await expect(
		api.createProject(guest, { name: 'Unauthorized', repositoryId: 202 })
	).rejects.toMatchObject({ code: 'forbidden', message: 'Collaboration forbidden' });
	expect(remote.calls.some((call) => call.method !== 'GET')).toBe(false);
});

test('private missing collaboration branch bootstraps once without source-tree inheritance', async () => {
	const { api, remote } = collaborationFixture();
	remote.missing = true;
	await expect(
		api.addComment(owner, {
			projectId: crypto.randomUUID(),
			requestId: crypto.randomUUID(),
			anchor,
			text: 'Not yet authorized'
		})
	).rejects.toMatchObject({ code: 'forbidden' });
	expect(remote.calls.filter((c) => c.method !== 'GET')).toEqual([]);
	const projects = await Promise.all(
		['One', 'Two'].map((name) => api.createProject(owner, { name, repositoryId: 202 }))
	);
	expect((await api.listProjects(owner)).map((p) => p.id).sort()).toEqual(
		projects.map((p) => p.id).sort()
	);
	const roots = remote.calls.filter(
		(c) => c.path === '/git/commits' && (c.body.parents as string[]).length === 0
	);
	expect(roots.length).toBeGreaterThan(0);
	const trees = remote.calls.filter((c) => c.path === '/git/trees' && !c.body.base_tree);
	expect(
		trees.every(
			(c) =>
				(c.body.tree as Array<{ path: string }>).length === 1 &&
				(c.body.tree as Array<{ path: string }>)[0].path === 'records/state.json'
		)
	).toBe(true);
	expect(remote.calls.filter((c) => c.path === '/git/refs').length).toBeGreaterThan(0);
});
