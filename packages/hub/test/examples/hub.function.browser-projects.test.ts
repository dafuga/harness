import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { invitationLink } from '../../src/components/projects-sessions/invitation-form/browserProjects';
import { browserProjects } from '../../src/routes/browserProjects';
import type { BrowserProjects } from '../../src/utils/projects-sessions/browserProjects';
import type { Invite, Call, Api, InviteInput } from './hub.function.browser-projects.test.types';

const PROJECT = '0d8f3c2e-7a61-4b5d-9c0e-2e4f6a8b1c3d';
const INVITE_ID = '5b1e7d2a-3c4f-4a9b-8e6d-1f2a3b4c5d6e';
const CODE = '9c41e0b7a25f38d6c0e1f4a7b92d58e3f16a0c4b7d9e2f85a1c3b6d0e4f7a291';
const ORIGIN = 'https://hub.example.com';

const invitation = {
	id: INVITE_ID,
	projectId: PROJECT,
	expiresAt: '2026-11-16T14:05:31.218Z',
	code: CODE
} as unknown as Invite;

const oddIdInvitation = { id: 'invite 1/x', projectId: 'proj#2?' } as unknown as Invite;

function meta(symbol: string, state: string) {
	return {
		unitId: 'hub.function.browser-projects',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

/** A stand-in client that records each request and resolves with a fixed reply. */
function fakeApi(calls: Call[]): Api {
	const reply = (method: string, path: string, body?: unknown) => {
		calls.push({ method, path, body });
		return Promise.resolve({ ok: true });
	};
	return {
		get: (path: string) => reply('GET', path),
		send: (method: string, path: string, body?: unknown) => reply(method, path, body)
	} as unknown as Api;
}

test('Invitation link carries origin and both ids, never the code', () => {
	const hostedLink = `${ORIGIN}/invite/${PROJECT}/${INVITE_ID}`;
	const localLink = `http://localhost:3000/invite/${PROJECT}/${INVITE_ID}`;
	const hosted = invitationLink(ORIGIN, invitation);
	const local = invitationLink('http://localhost:3000', invitation);
	expect([hosted, local]).toEqual([hostedLink, localLink]);
	expect(`${hosted} ${local}`).not.toContain(CODE);
	recordExampleCases(
		meta('invitationLink', 'invitation-link-carries-origin-and-both-ids-never-the-code'),
		[
			{
				name: 'hosted hub origin',
				input: { origin: ORIGIN, projectId: PROJECT, id: INVITE_ID },
				output: hosted
			},
			{
				name: 'local dev origin with port',
				input: { origin: 'http://localhost:3000', projectId: PROJECT, id: INVITE_ID },
				output: local
			}
		]
	);
});

test('Invitation link percent-encodes unusual path characters', () => {
	const link = invitationLink(ORIGIN, oddIdInvitation);
	expect(link).toBe(`${ORIGIN}/invite/proj%232%3F/invite%201%2Fx`);
	recordExampleCases(
		meta('invitationLink', 'invitation-link-percent-encodes-unusual-path-characters'),
		[
			{
				name: 'spaces, slash, hash and question mark in ids',
				input: { origin: ORIGIN, projectId: 'proj#2?', id: 'invite 1/x' },
				output: link
			}
		]
	);
});

test('Project reads call the project and GitHub routes', async () => {
	const calls: Call[] = [];
	const api = browserProjects(fakeApi(calls));
	await api.list();
	await api.get(PROJECT);
	await api.members(PROJECT);
	await api.github();
	await api.repositories();
	expect(calls).toEqual([
		{ method: 'GET', path: '/api/projects' },
		{ method: 'GET', path: `/api/projects/${PROJECT}` },
		{ method: 'GET', path: `/api/projects/${PROJECT}/members` },
		{ method: 'GET', path: '/api/github/status' },
		{ method: 'GET', path: '/api/github/repositories' }
	]);
	recordExampleCases(meta('browserProjects', 'project-reads-call-the-project-and-github-routes'), [
		{ name: 'list projects for the signed-in person', input: { call: 'list' }, output: calls[0] },
		{ name: 'get one project by id', input: { call: 'get', projectId: PROJECT }, output: calls[1] },
		{
			name: 'list members of a project',
			input: { call: 'members', projectId: PROJECT },
			output: calls[2]
		},
		{ name: 'read GitHub connection status', input: { call: 'github' }, output: calls[3] },
		{ name: 'list GitHub repositories', input: { call: 'repositories' }, output: calls[4] }
	]);
});

test('Project writes send bodies to create, invite and accept', async () => {
	const calls: Call[] = [];
	const api = browserProjects(fakeApi(calls));
	const inviteInput = { email: 'reviewer@example.com', role: 'viewer' } as unknown as InviteInput;
	await api.create({ name: 'Field notes', repositoryId: 4217 });
	await api.invite(PROJECT, inviteInput);
	await api.accept(PROJECT, INVITE_ID, CODE);
	expect(calls).toEqual([
		{ method: 'POST', path: '/api/projects', body: { name: 'Field notes', repositoryId: 4217 } },
		{
			method: 'POST',
			path: `/api/projects/${PROJECT}/invitations`,
			body: { email: 'reviewer@example.com', role: 'viewer' }
		},
		{
			method: 'POST',
			path: `/api/projects/${PROJECT}/invitations/${INVITE_ID}/accept`,
			body: { code: CODE }
		}
	]);
	recordExampleCases(
		meta('browserProjects', 'project-writes-send-bodies-to-create-invite-and-accept'),
		[
			{
				name: 'create a project from a listed repository',
				input: { name: 'Field notes', repositoryId: 4217 },
				output: calls[0]
			},
			{
				name: 'invite a viewer by email',
				input: { projectId: PROJECT, email: 'reviewer@example.com', role: 'viewer' },
				output: calls[1]
			},
			{
				name: 'accept an invitation with its code',
				input: { projectId: PROJECT, invitationId: INVITE_ID, code: CODE },
				output: calls[2]
			}
		]
	);
});

test('Browser project calls reject a surrogate id before sending', () => {
	const calls: Call[] = [];
	const api = browserProjects(fakeApi(calls));
	const lone = '\uD800';
	expect(() => api.get(lone)).toThrow(URIError);
	expect(() => api.members(lone)).toThrow(URIError);
	expect(calls).toEqual([]);
	recordExampleCases(
		meta('browserProjects', 'browser-project-calls-reject-a-surrogate-id-before-sending'),
		[
			{
				name: 'get with a lone surrogate project id',
				input: { call: 'get', projectId: lone },
				error: { name: 'URIError' }
			},
			{
				name: 'members with a lone surrogate project id',
				input: { call: 'members', projectId: lone },
				error: { name: 'URIError' }
			}
		]
	);
});
