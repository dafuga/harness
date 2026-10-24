import { expect } from '../../../../test/verificationExpect';
import { test, vi } from 'vitest';
import type { ProjectSummary } from 'collaboration';
import { HubAgentController, type HubAgentPort } from '../../src/controllers/HubAgentController';
import { outsider, project, commit, projectionFixture } from '../support/projectionFixture';

const origin = 'https://fixture.example';
const start = {
	method: 'startRun',
	requestId: '8775318f-d765-4e78-9d40-6cb92e1f6b11',
	revision: { branch: 'feat/a/b', commit },
	input: {
		intent: 'task',
		mode: 'ask',
		category: 'functions',
		projectId: project.id,
		provider: 'codex',
		model: 'fixture-model',
		effort: null,
		text: 'Inspect the project',
		branch: 'feat/a/b',
		commit
	}
};
function fixture(role: ProjectSummary['role'] = 'writer') {
	const f = projectionFixture();
	f.records.members.push({
		projectId: project.id,
		actorId: outsider.id,
		name: outsider.name,
		email: outsider.email,
		role
	});
	const execute = vi.fn<HubAgentPort['execute']>().mockResolvedValue({ runId: 'run' });
	const executor = {
		available: vi.fn().mockResolvedValue(true),
		revoke: vi.fn().mockResolvedValue(undefined),
		execute
	};
	const handle = (body: unknown = start, port: HubAgentPort | undefined = executor) =>
		new HubAgentController({
			api: f.api,
			projection: f.projection,
			actor: outsider,
			projectId: project.id,
			executor: port,
			request: new Request(`${origin}/api/projects/${project.id}/agent`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', origin },
				body: JSON.stringify(body)
			})
		}).handle();
	return { ...f, executor, handle };
}

test.each(['viewer', 'commenter'] as const)(
	'%s cannot execute and its existing runs are revoked',
	async (role) => {
		const f = fixture(role);
		await expect(f.handle()).rejects.toMatchObject({ code: 'forbidden' });
		expect(f.executor.available).not.toHaveBeenCalled();
		expect(f.executor.execute).not.toHaveBeenCalled();
		expect(f.executor.revoke).toHaveBeenCalledWith(outsider.id, project.id);
	}
);

test('Write dispatches only the verified actor and project through a bound executor', async () => {
	const f = fixture(),
		response = await f.handle();
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ runId: 'run' });
	expect(f.executor.execute).toHaveBeenCalledWith(
		expect.objectContaining({
			actor: outsider,
			project: expect.objectContaining({ id: project.id, role: 'writer' }),
			method: 'startRun',
			payload: expect.objectContaining({ requestId: start.requestId, revision: start.revision }),
			authorize: expect.any(Function)
		})
	);
});

test('an absent or unavailable executor fails closed', async () => {
	const f = fixture();
	const request = new Request(`${origin}/api/projects/${project.id}/agent`, { method: 'POST' });
	const response = await new HubAgentController({
		api: f.api,
		projection: f.projection,
		actor: outsider,
		projectId: project.id,
		request
	}).handle();
	expect(response.status).toBe(503);
	f.executor.available.mockResolvedValue(false);
	expect((await f.handle()).status).toBe(503);
	expect(f.executor.execute).not.toHaveBeenCalled();
});

test('forged project context and stale revisions never reach execution', async () => {
	const f = fixture();
	await expect(
		f.handle({ ...start, input: { ...start.input, projectId: 'another-project' } })
	).rejects.toMatchObject({ code: 'invalid-input' });
	await expect(
		f.handle({ ...start, revision: { ...start.revision, commit: 'b'.repeat(40) } })
	).rejects.toMatchObject({ code: 'revision-mismatch' });
	expect(f.executor.execute).not.toHaveBeenCalled();
});

test('removing membership cancels this actor’s runs and denies the running authorization callback', async () => {
	const f = fixture();
	await f.handle();
	const { authorize } = f.executor.execute.mock.calls[0][0];
	f.records.members = f.records.members.filter((member) => member.actorId !== outsider.id);
	await expect(authorize()).rejects.toMatchObject({ code: 'forbidden' });
	expect(f.executor.revoke).toHaveBeenCalledWith(outsider.id, project.id);
});

test('contract proposals reach only an authorized executor at the verified branch tip', async () => {
	const f = fixture();
	const definition = {
		method: 'createPlan',
		revision: start.revision,
		input: {
			category: 'functions',
			title: 'Format totals',
			goal: 'Format a total',
			contract: { inputs: [], outputs: [], errors: [] }
		}
	};
	expect((await f.handle(definition)).status).toBe(200);
	expect(f.executor.execute).toHaveBeenLastCalledWith(
		expect.objectContaining({
			method: 'createPlan',
			payload: expect.objectContaining({
				revision: start.revision,
				input: expect.objectContaining(definition.input)
			})
		})
	);
	await expect(fixture('viewer').handle(definition)).rejects.toMatchObject({ code: 'forbidden' });
	await expect(
		f.handle({ ...definition, revision: { ...start.revision, commit: 'b'.repeat(40) } })
	).rejects.toMatchObject({ code: 'revision-mismatch' });
});
