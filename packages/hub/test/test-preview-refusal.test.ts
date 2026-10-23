import type { Preview } from './test-preview-refusal.test.types';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';

/**
 * A browser run owns its preview. The real configuration is read and run here against a port
 * that something else already answers on, and against a port that is no port: each time it
 * refuses before any test starts, and no browser is pointed at what this run did not serve.
 * A run is started only after the configuration is seen to take the port named here, so this
 * file never sends a browser to a server it did not start.
 */
const hub = fileURLToPath(new URL('..', import.meta.url));
const named = 'HARNESS_HUB_TEST_PORT';
const noPort = `${named} must be a port from 1024 to 65535`;
const asData =
	"import('./playwright.config.ts').then((read) => console.log(JSON.stringify(read.default)))";
const servers: Server[] = [];
afterEach(async () => {
	for (const server of servers.splice(0)) {
		server.closeAllConnections();
		await new Promise((closed) => server.close(closed));
	}
});

/** Another checkout's server: it answers every path as a page and keeps who asked. */
async function foreign() {
	const agents: string[] = [];
	const server = createServer((request, response) => {
		agents.push(request.headers['user-agent'] ?? '');
		response.writeHead(200, { 'content-type': 'text/html' }).end('<h1>Foreign content</h1>');
	});
	servers.push(server);
	await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
	return { port: String((server.address() as AddressInfo).port), agents };
}

/** A command of the package with the port named or left unnamed; the environment is kept. */
function ran(args: string[], port?: string) {
	const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
	if (port === undefined) delete env[named];
	else env[named] = port;
	return new Promise<{ code: number; out: string; said: string }>((resolve) => {
		execFile('bun', args, { cwd: hub, env }, (error, out, err) =>
			resolve({ code: error ? 1 : 0, out, said: out + err })
		);
	});
}
/** The configuration read as data: reading it starts nothing. */
const read = (port?: string) => ran(['-e', asData], port);
/** One real spec file as `bun run test:e2e` runs it, on a named port. */
const browserRun = (port: string) => ran(['run', 'test:e2e', 'hosted-access.spec.ts', '-x'], port);
const browsers = (agents: string[]) => agents.filter((agent) => /Mozilla|Chrome/.test(agent));

test('a server that already answers on the preview port is refused, and no test is run on it', async () => {
	const other = await foreign();
	const url = `http://127.0.0.1:${other.port}`;
	const aimed = JSON.parse((await read(other.port)).out || '{}') as Partial<Preview>;
	expect([aimed.webServer?.url, aimed.use?.baseURL]).toEqual([url, url]);
	const run = await browserRun(other.port);
	expect(browsers(other.agents)).toEqual([]);
	expect(run.said).toContain(`${url} is already used`);
	expect(run.code).not.toBe(0);
}, 120_000);

test('a port override that is no port is refused by its name before anything starts', async () => {
	for (const value of ['5795x', '', '80', '65536', '0x1700']) {
		const unread = await read(value);
		expect([value, unread.code, unread.out]).toEqual([value, 1, '']);
		expect(unread.said).toContain(`${noPort}, not "${value}".`);
	}
	const run = await browserRun('5795x');
	expect(run.said).toContain(noPort);
	expect(run.said).not.toContain('Running');
	expect(run.code).not.toBe(0);
}, 120_000);

test('with no port named the preview has a port of its own, apart from development, and is not reused', async () => {
	const { webServer, use } = JSON.parse((await read()).out) as Preview;
	const manifest = JSON.parse(readFileSync(join(hub, 'package.json'), 'utf8')) as {
		scripts: { dev: string };
	};
	const development = / --port (\d+)/.exec(manifest.scripts.dev)?.[1];
	const port = new URL(webServer.url).port;
	expect(development).toMatch(/^\d+$/);
	expect(port).not.toBe(development);
	expect(webServer).toMatchObject({
		command: `bun run dev --port ${port}`,
		url: `http://127.0.0.1:${port}`,
		reuseExistingServer: false
	});
	expect(use.baseURL).toBe(webServer.url);
}, 30_000);
