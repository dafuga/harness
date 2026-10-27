import { expect } from '../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exampleDocument } from '../../game/src/utils/game-authoring/keyDoor';
import { remoteLimits } from '../../remote/src/index';
import type { RemoteBinary, WirePart } from '../../remote/src/index';
import type { EntityDetail, ProjectSnapshot } from '../src/models/Desktop.types';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { remoteBinary } from '../src/utils/remoteBinary';
import { committed, largeGame, localFixture } from './local-transport-fixture';
import { deferred } from './remote-fixture';
import { featureActions } from './run-fixture';
const settle = { timeout: 15000 },
	view = { branch: null, commit: null },
	pause = () => new Promise((resolve) => setTimeout(resolve, 0)),
	parts = (frames: string[]) => frames.map((frame) => JSON.parse(frame) as WirePart);
afterEach(() => vi.restoreAllMocks());
test('the bridge works over a socket that only this machine can reach', async () => {
	const f = await localFixture(),
		client = f.connect(f.window());
	expect(f.transport.address).toBe('127.0.0.1');
	expect(await client.request('deploymentActivities')).toEqual([]);
	await expect(client.request('startDeployment', { planId: 'invalid' })).rejects.toThrow('Invalid');
	const opened = await client.request<ProjectSnapshot>('openProject');
	expect(opened.project).toMatchObject({ root: f.root, id: f.project.id });
	expect(await client.request('projectWork' as never, { projectId: f.project.id })).toEqual({
		queueCommit: null,
		features: []
	});
	await expect(
		client.request('projectWork' as never, { projectId: 'another-project' })
	).rejects.toThrow();
	await featureActions(f, client);
	expect(await client.request('listProjects')).toMatchObject([{ id: f.project.id, kind: 'local' }]);
	expect((await client.request<ProjectSnapshot>('snapshot', view)).writable).toBe(true);
	expect(await client.request('deploymentStatus')).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ environment: 'dev', receipt: null, available: false })
		])
	);
	await expect(
		client.request('planDeployment', { environment: 'unknown', commit: opened.revision.commit })
	).rejects.toThrow('Invalid');
	await expect(client.request('deploy', { planId: 'no-review' })).rejects.toThrow('Invalid');
	expect(await client.request('deploymentProgress', { planId: 'a'.repeat(36) })).toBeNull();
	await expect(client.request('deploymentProgress', { planId: 'no-plan' })).rejects.toThrow(
		'Invalid'
	);
	const plan = { category: 'pages', title: 'Loopback', goal: 'Over a socket' };
	expect((await client.request<EntityDetail>('createPlan', plan)).title).toBe('Loopback');
	expect(client.wire.attachment).toMatchObject({ role: 'local', grant: null, device: null });
	await expect(client.request('snapshot', { branch: 5, commit: null })).rejects.toThrow('Invalid');
	await expect(client.request('shell.run' as never, { command: 'id' })).rejects.toMatchObject({
		code: 'unknown-method'
	});
	expect(f.transport.connections).toBe(1);
}, 40000);

test('an image of more than a mebibyte crosses the socket in bounded frames and arrives intact', async () => {
	const f = await localFixture(),
		{ bytes, query } = await committed(f),
		client = f.connect(f.window());
	await client.request('openProject');
	const before = f.frames.length,
		received = await remoteBinary(await client.request<RemoteBinary>('image', query)),
		frames = f.frames.slice(before);
	for (const option of ['o99', 'o1']) {
		const outcome = await client.request('image', { ...query, option } as never).then(
			() => 'accepted',
			() => 'rejected'
		);
		expect(outcome).toBe('rejected');
	}
	expect(bytes.length).toBeGreaterThan(1048576);
	expect(Buffer.compare(Buffer.from(received), Buffer.from(bytes))).toBe(0);
	expect(frames.length).toBeGreaterThan(8);
	expect(Math.max(...frames.map((frame) => frame.length))).toBeLessThanOrEqual(
		remoteLimits.frameBytes
	);
	expect(parts(frames).at(-1)).toMatchObject({ last: true, index: frames.length - 1 });
}, 60000);

test('two large answers take turns on the socket and a small one does not wait for them', async () => {
	const f = await localFixture(),
		{ bytes, query } = await committed(f),
		held: (() => void)[] = [],
		client = f.connect(f.window({ defer: (step) => held.push(step) }));
	await client.request('openProject');
	const before = f.frames.length,
		large = () => parts(f.frames.slice(before)).filter((part) => !(part.index === 0 && part.last)),
		reads = [
			client.request<RemoteBinary>('image', query),
			client.request<RemoteBinary>('image', query)
		];
	await expect.poll(() => large().filter((part) => part.index === 0).length, settle).toBe(2);
	expect(await client.request('listProjects')).toHaveLength(1);
	const done = Promise.all(reads).then((answers) => Promise.all(answers.map(remoteBinary)));
	let images: Uint8Array[] | null = null;
	void done.then((value) => (images = value));
	for (let step = 0; step < 4000 && images === null; step++) {
		held.shift()?.();
		await pause();
	}
	const [first, second] = await done,
		ids = large().map((part) => part.message);
	expect(first.length + second.length).toBe(bytes.length * 2);
	expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
	expect(new Set(ids).size).toBe(2);
	expect(ids.slice(0, 6)).toEqual([ids[0], ids[1], ids[0], ids[1], ids[0], ids[1]]);
}, 60000);

test('each window is its own client: its own project, its own run events, one repository lock', async () => {
	const gate = deferred(),
		f = await localFixture(() => gate.promise),
		one = f.connect(f.window()),
		two = f.connect(f.window()),
		seen = { one: [] as RunEvent[], two: [] as RunEvent[] };
	one.on('run', (event) => seen.one.push(event as RunEvent));
	two.on('run', (event) => seen.two.push(event as RunEvent));
	await one.request('openProject');
	await expect(two.request('snapshot', view)).rejects.toThrow('Open a project first.');
	try {
		await one.request('startRun', f.request);
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		await two.request('openProject');
		await expect(two.request('startRun', f.request)).rejects.toThrow('already active');
	} finally {
		gate.resolve();
	}
	await expect.poll(() => seen.one.at(-1)?.kind, settle).toBe('finished');
	expect(seen.two).toEqual([]);
	expect(f.run).toHaveBeenCalledOnce();
}, 40000);

test('a reload keeps the session of its window; closing the window ends its socket and its run only', async () => {
	const gate = deferred(),
		f = await localFixture(() => gate.promise),
		window = f.window(),
		first = f.connect(window);
	await first.request('openProject');
	first.close();
	const reloaded = f.connect(window);
	expect((await reloaded.request<ProjectSnapshot>('snapshot', view)).project.id).toBe(f.project.id);
	try {
		await reloaded.request('startRun', f.request);
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		window.end();
		f.transport.forget(window);
		expect(f.run.mock.calls[0][0].signal.aborted).toBe(true);
	} finally {
		gate.resolve();
	}
	await expect.poll(() => f.transport.connections, settle).toBe(0);
	await expect(reloaded.request('listProjects')).rejects.toThrow();
	expect(f.control.calls).toEqual([]);
	const other = f.connect(f.window());
	expect(await other.request('remote.status')).toEqual(f.control.status);
	expect(f.control.calls).toEqual([['status', undefined]]);
}, 40000);

test('a game of nearly a mebibyte crosses to the main process in bounded frames and reopens', async () => {
	const f = await localFixture(),
		client = f.connect(f.window()),
		file = join(f.root, 'game.json'),
		document = largeGame();
	await writeFile(file, JSON.stringify(exampleDocument()));
	const projectId = (await client.request<ProjectSnapshot>('openProject')).project.id,
		{ revision } = await client.request<{ revision: string }>('gameRead', { projectId });
	expect(Buffer.byteLength(JSON.stringify(document, null, '\t') + '\n')).toBeLessThanOrEqual(
		1048576
	);
	expect(Buffer.byteLength(JSON.stringify(document))).toBeGreaterThan(
		remoteLimits.requestBytes * 15
	);
	const saved = await client.request<{ revision: string }>('gameSave', {
		projectId,
		document,
		expectedRevision: revision
	});
	expect(await client.request('gameRead', { projectId })).toEqual({ document, ...saved });
	const beyond = { projectId, document: { pad: 'x'.repeat(1048576 + remoteLimits.requestBytes) } };
	await expect(client.request('gameSave', beyond)).rejects.toMatchObject({ code: 'too-large' });
	expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(document);
	expect(f.transport.connections).toBe(1);
}, 40000);

test('the control port travels over the same socket, with exactly what the page gave', async () => {
	const f = await localFixture(),
		client = f.connect(f.window()),
		approval = { pairingId: 'b'.repeat(32), projectIds: [f.project.id], agents: true };
	expect(await client.request('remote.approvePairing', approval)).toEqual(f.control.status);
	await client.request('remote.revokeDevice', { deviceId: 'd'.repeat(40) });
	await client.request('remote.enable');
	expect(f.control.calls).toEqual([
		['approvePairing', approval],
		['revokeDevice', { deviceId: 'd'.repeat(40) }],
		['enable', undefined]
	]);
}, 40000);

// One backend can be asked to start again by concurrent app/window startup paths.
test('repeated concurrent listens reuse one listener and closing releases it', async () => {
	const f = await localFixture();
	const ports = await Promise.all([f.transport.listen(), f.transport.listen()]);
	expect(ports).toEqual([f.port, f.port]);
	await f.transport.close();
	await expect(fetch(`http://127.0.0.1:${f.port}`)).rejects.toThrow();
	const next = await f.transport.listen();
	expect(next).toBeGreaterThan(0);
});
