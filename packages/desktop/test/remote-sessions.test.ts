import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { ProjectSnapshot } from '../src/models/Desktop.types';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { deferred, remoteFixture } from './remote-fixture';
import { fixture, git } from './run-fixture';

const settle = { timeout: 15000 };

test('a run of one client refuses runs and planning writes of every other client of the repository', async () => {
	const gate = deferred(),
		f = await remoteFixture(() => gate.promise),
		a = f.local(),
		b = f.local();
	await a.session.open(f.root);
	await b.session.open(f.root);
	try {
		await a.runs.start(f.request);
		await expect(b.runs.start(f.request)).rejects.toThrow('already active');
		await expect(
			b.bridge.createPlan({ category: 'pages', title: 'Second', goal: 'Concurrent write' })
		).rejects.toThrow('current run');
		expect(f.arbiter.held(f.root)).toBe(true);
		expect(b.session.busy).toBe(false);
	} finally {
		gate.resolve();
	}
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
	expect(f.run).toHaveBeenCalledOnce();
	expect(b.events).toEqual([]);
	expect(a.events.at(-1)).toMatchObject({ kind: 'finished' });
	await b.runs.start(f.request);
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
	expect(b.events.at(-1)).toMatchObject({ kind: 'finished' });
}, 40000);

test('each client keeps its own project and revision', async () => {
	const f = await remoteFixture(),
		other = await fixture(),
		second = await f.registry.register(other.root),
		desktop = f.local();
	await desktop.session.open(f.root);
	const grant = {
		projects: [
			{ id: f.project.id, name: f.project.name },
			{ id: second.id, name: second.name }
		],
		agents: true
	};
	const phone = await f.device(grant).connect();
	const view = (projectId: string, commit: string | null = null) =>
		phone.client.request<ProjectSnapshot>('snapshot', { projectId, branch: null, commit });
	const [one, two] = await Promise.all([view(f.project.id), view(second.id)]);
	expect([one.project.id, two.project.id]).toEqual([f.project.id, second.id]);
	expect(desktop.session.projectId).toBe(f.project.id);
	await desktop.session.open(other.root);
	expect((await view(f.project.id)).project.id).toBe(f.project.id);
	expect(desktop.session.projectId).toBe(second.id);
	await desktop.session.open(f.root);
	const first = git(f.root, 'rev-list', '--max-parents=0', 'HEAD');
	expect((await view(f.project.id, first)).revision.commit).toBe(first);
	expect((await desktop.session.mutable()).revision.commit).toBe(f.revision().commit);
}, 40000);

test('a device run reports to its device only, and only that device can cancel it', async () => {
	const gate = deferred(),
		f = await remoteFixture(() => gate.promise),
		a = await f.device().connect(),
		b = await f.device().connect(),
		seen = { a: [] as RunEvent[], b: [] as RunEvent[] },
		projectId = f.project.id;
	a.client.on('run', (event) => seen.a.push(event as RunEvent));
	b.client.on('run', (event) => seen.b.push(event as RunEvent));
	let runId = '';
	try {
		({ runId } = await a.client.request<{ runId: string }>('startRun', f.start()));
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		await expect(b.client.request('startRun', f.start())).rejects.toMatchObject({ code: 'busy' });
		expect(await b.client.request('cancelRun', { runId, projectId })).toBe(false);
		expect(f.run.mock.calls[0][0].signal.aborted).toBe(false);
		expect(await a.client.request('cancelRun', { runId, projectId })).toBe(true);
		expect(f.run.mock.calls[0][0].signal.aborted).toBe(true);
	} finally {
		gate.resolve();
	}
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
	expect(f.run).toHaveBeenCalledOnce();
	expect(seen.a.length).toBeGreaterThan(0);
	expect(seen.a.every((event) => event.runId === runId)).toBe(true);
	expect(seen.b).toEqual([]);
}, 40000);
