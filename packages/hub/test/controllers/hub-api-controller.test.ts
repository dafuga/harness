import { expect, test } from 'vitest';
import {
	actor,
	outsider,
	project,
	unit,
	commit,
	projectionFixture
} from '../support/projectionFixture';
const base = 'https://fixture.example/api/projects/';
function post(path: string, body: unknown = {}) {
	return new Request(base + project.id + '/' + path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}
test('hosted routes refuse execution even for the owner and return safe auth errors', async () => {
	const f = projectionFixture();
	for (const operation of ['runs', 'plans', 'approve', 'changes'])
		expect((await f.controller.handle(post(operation))).status).toBe(403);
	f.setActor(null);
	expect((await f.controller.handle(new Request(base))).status).toBe(401);
	f.setActor(outsider);
	expect((await f.controller.handle(new Request(base + project.id))).status).toBe(403);
});
test('comments use verified server identity, actual GitHub acknowledgment and exact project', async () => {
	const f = projectionFixture(),
		anchor = {
			branch: 'feat/a/b',
			commit,
			entityId: unit.id,
			version: null,
			imageSha256: null,
			state: null,
			viewport: null,
			region: null
		};
	const body = {
		requestId: '8775318f-d765-4e78-9d40-6cb92e1f6b11',
		anchor,
		text: 'Please simplify this.'
	};
	const reply = await f.controller.handle(post('comments', body));
	expect(reply.status).toBe(201);
	const thread = (await reply.json()) as {
		collaborationCommit: string;
		comments: { actor: typeof actor }[];
	};
	expect(thread.collaborationCommit).toBe('f'.repeat(40));
	expect(thread.comments[0].actor.id).toBe(actor.id);
	expect(
		(await f.controller.handle(post('comments', { ...body, projectId: 'different-project' })))
			.status
	).toBe(400);
});
test('a forged actor or role is not accepted from request JSON', async () => {
	const f = projectionFixture();
	f.setActor(outsider);
	const reply = await f.controller.handle(
		post('invitations', {
			email: 'friend@gmail.com',
			role: 'commenter',
			actor,
			ownerId: outsider.id
		})
	);
	expect(reply.status).toBe(403);
	expect(await reply.json()).toEqual({ error: 'forbidden' });
});
