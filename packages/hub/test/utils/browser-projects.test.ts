import { expect, test, vi } from 'vitest';
import { browserProjects } from '../../src/routes/-layout/browserProjects';
import { invitationLink } from '../../src/components/invitation-form/browserProjects';
import type { BrowserApi } from '../../src/utils/browserApi';

const project = '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f';
const invitation = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

test('membership and invitations use the addresses of the project', async () => {
	const get = vi.fn(async (_path: string) => []);
	const send = vi.fn(async (..._request: unknown[]) => ({}));
	const projects = browserProjects({ get, send } as unknown as BrowserApi);
	await projects.list();
	await projects.get(project);
	await projects.members(project);
	await projects.github();
	await projects.repositories();
	expect(get.mock.calls.map((call) => call[0])).toEqual([
		'/api/projects',
		`/api/projects/${project}`,
		`/api/projects/${project}/members`,
		'/api/github/status',
		'/api/github/repositories'
	]);
	await projects.create({ name: 'Atlas', repositoryId: 42 });
	await projects.invite(project, { email: 'ben@example.invalid', role: 'commenter' });
	await projects.accept(project, invitation, 'one-time-code');
	expect(send.mock.calls).toEqual([
		['POST', '/api/projects', { name: 'Atlas', repositoryId: 42 }],
		[
			'POST',
			`/api/projects/${project}/invitations`,
			{ email: 'ben@example.invalid', role: 'commenter' }
		],
		['POST', `/api/projects/${project}/invitations/${invitation}/accept`, { code: 'one-time-code' }]
	]);
});

test('an invitation link holds two identifiers and never the code', () => {
	const link = invitationLink('https://hub.example.invalid', {
		id: invitation,
		projectId: project,
		expiresAt: '2026-10-19T00:00:00.000Z',
		code: 'one-time-code'
	});
	expect(link).toBe(`https://hub.example.invalid/invite/${project}/${invitation}`);
	expect(link).not.toContain('one-time-code');
});
