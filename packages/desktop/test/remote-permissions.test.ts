import type { Client } from './remote-permissions.test.types';
import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { agentMethods, controlMethods, localMethods } from '../../remote/src/index';
import type { EntityDetail, ProjectSnapshot } from '../src/models/Desktop.types';
import { remoteFixture } from './remote-fixture';
import { fixture, git } from './run-fixture';
/** The refusal code of a request, or `accepted`. */
const outcome = (client: Client, method: string, input: Record<string, unknown> = {}) =>
	client.request(method as never, input).then(
		() => 'accepted',
		(error: { code?: string }) => error.code ?? 'threw'
	);
const hosted = 'a6196e55-8746-4bc5-bfeb-5e2c8771e241';

test('a device reaches only the local projects it was granted', async () => {
	const f = await remoteFixture(),
		other = await fixture(),
		ungranted = await f.registry.register(other.root),
		{ client } = await f.device().connect(),
		view = { branch: null, commit: null };
	expect(await client.request('listProjects')).toEqual([
		{ id: f.project.id, name: f.project.name, kind: 'local' }
	]);
	expect(await outcome(client, 'snapshot', { ...view, projectId: f.project.id })).toBe('accepted');
	expect(await outcome(client, 'snapshot', view)).toBe('project-required');
	for (const projectId of [ungranted.id, hosted, other.root, '../' + f.project.id])
		expect(await outcome(client, 'snapshot', { ...view, projectId })).toBe('project-denied');
	expect(await outcome(client, 'startRun', { ...f.start(), projectId: hosted })).toBe(
		'project-denied'
	);
	expect(f.run).not.toHaveBeenCalled();
}, 30000);

test('folders, hosted credentials and the control port are not device methods', async () => {
	const f = await remoteFixture(),
		{ client, attachment } = await f.device().connect();
	for (const method of [...localMethods, ...controlMethods]) {
		expect(attachment.methods).not.toContain(method);
		expect(await outcome(client, method, { projectId: f.project.id })).toBe('method-denied');
	}
	expect(await outcome(client, 'projectWork', { projectId: f.project.id })).toBe('method-denied');
	for (const method of ['selectFeaturePlan', 'approveFeaturePlan'])
		expect(await outcome(client, method, { projectId: f.project.id })).toBe('method-denied');
	expect(await outcome(client, 'shell.run', { command: 'id' })).toBe('unknown-method');
	expect(attachment).toMatchObject({
		role: 'device',
		host: { name: 'Fixture Mac' },
		device: { name: 'Fixture phone' },
		grant: { projects: [{ id: f.project.id }], agents: true }
	});
}, 30000);

test.each([true, false])(
	'a non-writer device has comments=%s and never runs an agent',
	async (comments) => {
		const f = await remoteFixture(),
			grant = { projects: [{ id: f.project.id, name: f.project.name }], agents: false, comments },
			{ client, attachment } = await f.device(grant).connect(),
			projectId = f.project.id;
		for (const method of agentMethods) {
			expect(attachment.methods).not.toContain(method);
			expect(await outcome(client, method, f.start())).toBe('method-denied');
		}
		const snapshot = await client.request<ProjectSnapshot>('snapshot', {
			projectId,
			branch: null,
			commit: null
		});
		expect(snapshot.capabilities).toMatchObject({
			comments,
			agents: false,
			planning: false,
			approval: false
		});
		expect(snapshot.writable).toBe(false);
		expect(await client.request('capabilities', { projectId })).toEqual(snapshot.capabilities);
		expect(await client.request('providers')).toEqual([]);
		if (!comments) {
			expect(await outcome(client, 'addComment', { projectId })).toBe('method-denied');
			expect(await outcome(client, 'openThread', { projectId })).toBe('method-denied');
		}
		expect(f.run).not.toHaveBeenCalled();
	},
	30000
);

test('a change needs the checked-out tip: history and other branches are read-only', async () => {
	const f = await remoteFixture(),
		{ client } = await f.device().connect(),
		plan = { projectId: f.project.id, category: 'pages', title: 'Remote plan', goal: 'Phone' },
		first = git(f.root, 'rev-list', '--max-parents=0', 'HEAD'),
		tip = f.revision().commit;
	expect(await outcome(client, 'createPlan', plan)).toBe('revision-required');
	const refusals = [
		[{ branch: 'main', commit: first }, 'read-only'],
		[{ branch: 'other', commit: tip }, 'read-only'],
		[{ branch: 'main', commit: 'f'.repeat(40) }, 'revision-mismatch']
	] as const;
	for (const [revision, code] of refusals)
		expect(await outcome(client, 'createPlan', { ...plan, revision })).toBe(code);
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(tip);
	const historical = { projectId: f.project.id, branch: 'main', commit: first };
	expect(await outcome(client, 'snapshot', historical)).toBe('accepted');
	expect(await outcome(client, 'createPlan', { ...plan, revision: f.revision() })).toBe(
		'read-only'
	);
	await client.request('snapshot', { projectId: f.project.id, branch: 'main', commit: null });
	const created = await client.request<EntityDetail>('createPlan', {
		...plan,
		revision: f.revision()
	});
	expect(created.title).toBe('Remote plan');
	expect(git(f.root, 'rev-parse', 'HEAD')).not.toBe(tip);
	expect(
		await outcome(client, 'createPlan', { ...plan, revision: { branch: 'main', commit: tip } })
	).toBe('read-only');
}, 40000);

test('answers and refusals carry no local path', async () => {
	const f = await remoteFixture(),
		{ client, frames } = await f.device().connect(),
		projectId = f.project.id,
		commit = f.revision().commit;
	const snapshot = await client.request<ProjectSnapshot>('snapshot', {
		projectId,
		branch: null,
		commit: null
	});
	expect(snapshot.project).toEqual({ name: f.project.name, root: '', id: projectId });
	await client.request('listProjects');
	await client.request('entity', { projectId, entityId: f.request.entityId, commit });
	const missing = { projectId, entityId: 'page.missing', commit };
	const failure = (await client.request('entity', missing).catch((error: unknown) => error)) as {
		code: string;
		message: string;
	};
	expect(failure.code).toBe('failed');
	expect(failure.message.length).toBeGreaterThan(0);
	expect(frames.join('\n')).not.toContain(f.root);
	expect(frames.length).toBeGreaterThan(3);
}, 30000);

test('bridge inputs follow the same rules as on the desktop', async () => {
	const f = await remoteFixture(),
		{ client } = await f.device().connect(),
		projectId = f.project.id;
	expect(await outcome(client, 'snapshot', { projectId, branch: 5, commit: null })).toBe(
		'invalid-message'
	);
	expect(await outcome(client, 'entity', { projectId, entityId: '../x', commit: 'abc' })).toBe(
		'invalid-message'
	);
	expect(await outcome(client, 'startRun', { ...f.start(), mode: 'change', approval: null })).toBe(
		'invalid-message'
	);
	expect(await outcome(client, 'startRun', { ...f.start(), text: 'x'.repeat(20001) })).toBe(
		'invalid-message'
	);
	expect(f.run).not.toHaveBeenCalled();
}, 30000);
