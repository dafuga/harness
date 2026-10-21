import {
	assertPreviewRoutes,
	publishedPreviewOwner,
	startingPreviewOwner,
	previewWorkerPid,
	sveltePreviewFixture,
	previewFixture as fixture,
	previewPort as port,
	startPreview as start,
	readyPreview as ready,
	exitedPreview as exited
} from './support/previewFixture';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { taskProfile } from '../../../test/support/taskProfiles';
import { previewOwner } from '../src/utils/previewOwner';
const reports = fileURLToPath(new URL('..', import.meta.url));
test('repeated starts on another requested port reuse the same owned preview', async () => {
	const f = await fixture(),
		firstPort = await port(),
		nextPort = await port();
	start(f, firstPort);
	await ready(firstPort);
	const second = start(f, nextPort);
	await exited(second);
	expect(second.child.exitCode).toBe(0);
	expect(second.text()).toContain(`Reusing Harness preview: http://127.0.0.1:${firstPort}`);
	await expect(fetch(`http://127.0.0.1:${nextPort}`)).rejects.toThrow();
	await ready(firstPort);
}, 30000);
test('another history configuration is refused without starting a second preview', async () => {
	const f = await fixture(),
		firstPort = await port(),
		nextPort = await port();
	start(f, firstPort);
	await ready(firstPort);
	const second = start(f, nextPort, 'other');
	await exited(second);
	expect(second.child.exitCode).not.toBe(0);
	expect(second.text()).toContain(`already running at http://127.0.0.1:${firstPort}`);
	await expect(fetch(`http://127.0.0.1:${nextPort}`)).rejects.toThrow();
	await ready(firstPort);
}, 30000);
test('an occupied preview port is refused instead of silently choosing another', async () => {
	const f = await fixture(),
		webPort = await port(),
		server = createServer((socket) => {
			socket.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code !== 'ECONNRESET') throw error; // The occupied fixture may reset readiness probes.
			});
		});
	server.listen(webPort, '127.0.0.1');
	await once(server, 'listening');
	try {
		const run = start(f, webPort);
		await exited(run);
		expect(run.child.exitCode).not.toBe(0);
		expect(run.text()).toContain('already in use');
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
	start(f, webPort);
	await ready(webPort);
}, 30000);
test('an owner that crashes can be restarted without a stale lock or orphan preview', async () => {
	const f = await fixture(),
		webPort = await port(),
		first = start(f, webPort);
	await ready(webPort);
	const ended = once(first.child, 'exit');
	process.kill(-first.child.pid!, 'SIGKILL');
	await ended;
	start(f, webPort);
	await ready(webPort);
}, 30000);
test('simultaneous launches elect one owner while the other reuses it', async () => {
	const f = await fixture(),
		webPort = await port();
	const runs = [start(f, webPort), start(f, webPort)];
	await ready(webPort);
	await expect
		.poll(() => runs.filter((run) => run.child.exitCode !== null).length, { timeout: 4000 })
		.toBe(1);
	const reused = runs.find((run) => run.child.exitCode !== null)!;
	expect(reused.child.exitCode).toBe(0);
	expect(reused.text()).toContain(`Reusing Harness preview: http://127.0.0.1:${webPort}`);
}, 30000);
test('a different checkout is refused without affecting the owner', async () => {
	const f = await fixture(),
		other = await fixture(),
		webPort = await port(),
		nextPort = await port();
	start(f, webPort);
	await ready(webPort);
	const owner = await publishedPreviewOwner(f.owner, webPort);
	const worker = await previewWorkerPid(webPort);
	expect(worker).toBeGreaterThan(0);
	await taskProfile('reports.function.preview-owner', 'ready-owner-http', () =>
		previewOwner(f.owner, owner.identity)
	);
	const starting = await startingPreviewOwner(owner);
	try {
		const second = start({ ...f, root: other.root, owner: starting.port }, nextPort);
		await exited(second);
		expect(second.child.exitCode).not.toBe(0);
		expect(second.text()).toContain(`already running at http://127.0.0.1:${webPort}`);
		expect(starting.reads()).toBeGreaterThan(1);
		await expect(fetch(`http://127.0.0.1:${nextPort}`)).rejects.toThrow();
		await ready(webPort);
		expect(await publishedPreviewOwner(f.owner, webPort)).toEqual(owner);
		expect(await previewWorkerPid(webPort)).toBe(worker);
	} finally {
		await starting.close();
	}
}, 30000);
test('normal shutdown releases both the preview and ownership listeners', async () => {
	const f = await fixture(),
		webPort = await port(),
		first = start(f, webPort);
	await ready(webPort);
	const ended = once(first.child, 'exit');
	process.kill(-first.child.pid!, 'SIGTERM');
	await ended;
	await expect
		.poll(async () => {
			try {
				await fetch(`http://127.0.0.1:${f.owner}/__harness_preview__`);
				return true;
			} catch {
				return false;
			}
		})
		.toBe(false);
	await expect(fetch(`http://127.0.0.1:${webPort}`)).rejects.toThrow();
	start(f, webPort);
	await ready(webPort);
}, 30000);
test('route indexes stay aligned after the normal SvelteKit sync command', async () => {
	const f = await fixture(),
		webPort = await port();
	const names = await sveltePreviewFixture(f.root, join(reports, '../../node_modules'));
	const run = start({ ...f, app: true }, webPort);
	await assertPreviewRoutes(f.root, `http://127.0.0.1:${webPort}`, names, run.text);
}, 30000);

for (const fault of ['crash', 'hang', 'module errors'] as const) {
	test(`the owned preview autonomously recovers after ${fault}`, async () => {
		const f = await fixture(),
			webPort = await port(),
			nextPort = await port();
		const history = join(f.root, 'history.json');
		await writeFile(history, 'existing committed history');
		const run = start(f, webPort, history);
		await ready(webPort);
		const owner = () =>
			fetch(`http://127.0.0.1:${f.owner}/__harness_preview__`).then((r) => r.json());
		const worker = () => previewWorkerPid(webPort);
		const before = await publishedPreviewOwner(f.owner, webPort),
			pid = await worker();
		expect(pid).toBeGreaterThan(0);
		try {
			if (fault === 'module errors')
				for (let i = 0; i < 3; i++) await fetch(`http://127.0.0.1:${webPort}/fixture-fail.js`);
			else process.kill(pid, fault === 'crash' ? 'SIGKILL' : 'SIGSTOP');
			await expect
				.poll(
					async () => {
						const current = await worker();
						return current > 0 && current !== pid;
					},
					{ timeout: 18000 }
				)
				.toBe(true);
			await ready(webPort);
			expect((await owner()).pid, 'the supervisor retains its ownership slot').toBe(before.pid);
			expect((await owner()).url, 'recovery preserves the published address').toBe(before.url);
			expect(await readFile(history, 'utf8')).toBe('existing committed history');
			const reused = start(f, nextPort, history);
			await exited(reused);
			expect(reused.child.exitCode).toBe(0);
			await expect(fetch(`http://127.0.0.1:${nextPort}`)).rejects.toThrow();
		} catch (cause) {
			throw new Error('Recovery did not complete: ' + run.text(), { cause });
		} finally {
			try {
				process.kill(pid, 'SIGCONT');
			} catch {
				/* Exited fixture worker. */
			}
		}
	}, 35000);
}
