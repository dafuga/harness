import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import manifest from '../package.json' with { type: 'json' };
import playwright from '../playwright.config';

/**
 * An ordinary browser run owns its preview. The real configuration is run here against a port
 * that something else already answers on, and against a port that is no port: each time it
 * refuses before any test starts, and no browser is pointed at what this run did not serve.
 */
const desktop = fileURLToPath(new URL('..', import.meta.url));
const servers: Server[] = [];
afterEach(async () => {
	for (const server of servers.splice(0)) await new Promise((closed) => server.close(closed));
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

/** One real spec file as `bun run test:e2e` runs it outside a verification, on a named port. */
function ordinaryRun(port: string) {
	const env: NodeJS.ProcessEnv = { ...process.env, HARNESS_DESKTOP_TEST_PORT: port, NO_COLOR: '1' };
	delete env.HARNESS_VERIFY;
	const args = ['run', 'test:e2e', 'ui-hosted.spec.ts', '-x'];
	return new Promise<{ code: number; said: string }>((resolve) => {
		execFile('bun', args, { cwd: desktop, env }, (error, stdout, stderr) =>
			resolve({ code: error ? 1 : 0, said: stdout + stderr })
		);
	});
}
const browsers = (agents: string[]) => agents.filter((agent) => /Mozilla|Chrome/.test(agent));

test('a server that already answers on the preview port is refused, and no test is run on it', async () => {
	const other = await foreign();
	const run = await ordinaryRun(other.port);
	expect(browsers(other.agents)).toEqual([]);
	expect(run.said).toContain(`http://127.0.0.1:${other.port} is already used`);
	expect(run.code).not.toBe(0);
}, 120_000);

test('a port override that is no port is refused by its name before anything starts', async () => {
	const run = await ordinaryRun('5796x');
	expect(run.said).toContain('HARNESS_DESKTOP_TEST_PORT must be a port from 1024 to 65535');
	expect(run.said).not.toContain('Running');
	expect(run.code).not.toBe(0);
}, 120_000);

/** Whether a project's pattern takes a spec, matched as Playwright does on its absolute path. */
const takes = (pattern: unknown, spec: string) =>
	pattern instanceof RegExp && pattern.test(resolve(desktop, playwright.testDir ?? '', spec));
const e2e = resolve(desktop, playwright.testDir ?? '');

/** Whether a spec launches the Electron app, itself or through a local fixture it imports. */
function launchesElectron(spec: string): boolean {
	const source = readFileSync(resolve(e2e, spec), 'utf8');
	const fixtures = [...source.matchAll(/from '\.\/([\w-]+)'/g)].map(([, name]) =>
		readFileSync(resolve(e2e, `${name}.ts`), 'utf8')
	);
	return [source, ...fixtures].some((text) => /\b_electron\b/.test(text));
}

test('test:e2e runs headless chromium without the Electron spec, which only test:native runs', () => {
	const project = (name: string) => playwright.projects?.find((item) => item.name === name);
	const chromium = project('chromium');
	const native = project('native');
	for (const [script, project] of [
		['test:e2e', 'chromium'],
		['test:native', 'native']
	] as const) {
		expect(manifest.scripts[script]).toMatch(/^bun \.\.\/\.\.\/src\/index\.ts resources run /);
		expect(manifest.scripts[script]).toContain(
			`-- sh -c 'playwright test --project=${project} "$@"' --`
		);
	}
	expect(chromium?.use).toMatchObject({ browserName: 'chromium', headless: true });
	expect(launchesElectron('native-desktop.spec.ts')).toBe(true);
	expect(launchesElectron('ui-hosted.spec.ts')).toBe(false);
	for (const spec of readdirSync(e2e).filter((file) => file.endsWith('.spec.ts'))) {
		const electron = launchesElectron(spec);
		expect(takes(chromium?.testIgnore, spec), `chromium ignores ${spec}`).toBe(electron);
		expect(takes(native?.testMatch, spec), `native matches ${spec}`).toBe(electron);
	}
});
