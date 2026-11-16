import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectOperationsService } from '../../src/lib/development-tooling/desktop-bridge/ProjectOperationsService';

const projectId = 'local-e3af8a7251583e76fee1fc45993af40a380512ed7b704d61e7869aa9b57391ad';
const commit = '4f3c2a1908b7e6d5c4a3928170605f4e3d2c1b0a';

function service(session: Record<string, unknown>) {
	return new ProjectOperationsService(session as never);
}

test('Lists registered local projects', () => {
	const projects = [{ id: projectId, name: 'project', kind: 'local', root: '/workspace/project' }];
	const operations = service({ registry: { list: () => projects } });
	const output = operations.listProjects();
	expect(output).toEqual(projects);
	recordExampleCases(
		{ unitId: 'desktop.service.project-operations', symbol: 'listProjects', state: 'lists-registered-local-projects', evidence: 'examples-cases', file: 'lists-registered-local-projects.json' },
		[{ name: 'Returns registered local projects', input: {}, output }]
	);
});

test('Reports local project capabilities', async () => {
	const operations = service({
		projectId,
		assertProject: () => undefined,
		requireProject: () => ({})
	});
	const output = await operations.capabilities({ projectId });
	expect(output).toEqual({ comments: true, agents: true, planning: true, approval: true, source: 'local', reason: 'Human comments are local pending drafts, not synced.' });
	recordExampleCases(
		{ unitId: 'desktop.service.project-operations', symbol: 'capabilities', state: 'reports-local-project-capabilities', evidence: 'examples-cases', file: 'reports-local-project-capabilities.json' },
		[{ name: 'Reports capabilities for the selected local project', input: { projectId }, output }]
	);
});

test('Saves a project discussion comment locally', async () => {
	const saved = { kind: 'pending', projectId, draftId: '92f25f28-7cb0-4f6e-a073-c2da8cbf2ae1' };
	const operations = service({
		projectId,
		assertProject: () => undefined,
		requireProject: () => ({ source: { revision: async () => ({ commit }) } }),
		outbox: { save: async (draft: unknown) => ({ ...saved, input: draft }) }
	});
	const input = {
		projectId,
		requestId: 'de7a3f4d-a61a-4d15-8b68-55fbd24e3c17',
		anchor: { branch: 'main', commit, entityId: 'harness.project.discussion', version: null, imageSha256: null, state: null, viewport: null, region: null },
		text: 'Please review the project discussion.'
	};
	const output = await operations.addComment(input);
	expect(output).toMatchObject(saved);
	recordExampleCases(
		{ unitId: 'desktop.service.project-operations', symbol: 'addComment', state: 'saves-a-project-discussion-comment-locally', evidence: 'examples-cases', file: 'saves-a-project-discussion-comment-locally.json' },
		[{ name: 'Saves a discussion draft to the local outbox', input, output }]
	);
});

test('Lists pending comments for the selected project', async () => {
	const drafts = [{ kind: 'pending', projectId, draftId: '92f25f28-7cb0-4f6e-a073-c2da8cbf2ae1' }];
	const operations = service({
		projectId,
		assertProject: () => undefined,
		requireProject: () => ({}),
		outbox: { list: async (id: string) => id === projectId ? drafts : [] }
	});
	const output = await operations.pendingComments({ projectId });
	expect(output).toEqual(drafts);
	recordExampleCases(
		{ unitId: 'desktop.service.project-operations', symbol: 'pendingComments', state: 'lists-pending-comments-for-the-selected-project', evidence: 'examples-cases', file: 'lists-pending-comments-for-the-selected-project.json' },
		[{ name: 'Returns locally pending drafts', input: { projectId }, output }]
	);
});
