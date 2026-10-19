import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';

const reports = fileURLToPath(new URL('..', import.meta.url));
const roots: string[] = [],
	children: ChildProcess[] = [];
afterEach(async () => {
	for (const child of children.splice(0)) {
		if (child.exitCode !== null || child.signalCode !== null) continue;
		const ended = once(child, 'exit');
		process.kill(-child.pid!, 'SIGTERM');
		await ended;
	}
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function port() {
	const server = createServer();
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const value = (server.address() as AddressInfo).port;
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return value;
}
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-preview-lifecycle-'));
	roots.push(root);
	await writeFile(join(root, 'index.html'), '<h1>Managed preview fixture</h1>');
	await writeFile(join(root, 'vite.config.mjs'), 'export default {};');
	return { root, owner: await port() };
}
function start(f: Awaited<ReturnType<typeof fixture>>, webPort: number, history = 'one') {
	const child = spawn(
		'bun',
		['run', 'dev', f.root, '--config', join(f.root, 'vite.config.mjs'), '--port', String(webPort)],
		{
			cwd: reports,
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				NO_COLOR: '1',
				HARNESS_PREVIEW_OWNER_PORT: String(f.owner),
				HARNESS_CONSOLE_DATA: history
			}
		}
	);
	children.push(child);
	let text = '';
	child.stdout!.on('data', (data) => {
		text += String(data);
	});
	child.stderr!.on('data', (data) => {
		text += String(data);
	});
	return { child, text: () => text };
}
async function ready(webPort: number) {
	await expect
		.poll(
			async () => {
				try {
					return await (
						await fetch(`http://127.0.0.1:${webPort}`, { signal: AbortSignal.timeout(500) })
					).text();
				} catch {
					return '';
				}
			},
			{ timeout: 15000 }
		)
		.toContain('Managed preview fixture');
}
async function exited(run: ReturnType<typeof start>) {
	await expect.poll(() => run.child.exitCode, { timeout: 4000 }).not.toBeNull();
}

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
		server = createServer();
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
	const second = start({ ...f, root: other.root }, nextPort);
	await exited(second);
	expect(second.child.exitCode).not.toBe(0);
	expect(second.text()).toContain(`already running at http://127.0.0.1:${webPort}`);
	await ready(webPort);
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
