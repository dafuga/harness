import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test } from 'vitest';
import { measureProcess } from '../../../test/support/cli-measurement/measureHarness';

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
function ordinaryRun(port: string, verifying = false) {
	const env: NodeJS.ProcessEnv = { ...process.env, HARNESS_DESKTOP_TEST_PORT: port, NO_COLOR: '1' };
	if (verifying) env.HARNESS_VERIFY = '1';
	else delete env.HARNESS_VERIFY;
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

test.each([false, true])(
	'public and owner config honor the named port in verification=%s',
	async (verifying) => {
		const other = await foreign();
		const env = {
			...process.env,
			HARNESS_DESKTOP_TEST_PORT: other.port,
			HARNESS_VERIFY: verifying ? '1' : ''
		};
		const program = `
		const { default: entry } = await import('./playwright.config.ts');
		const { default: owner } = await import('./src/config/development-tooling/desktopPlaywrightConfig.ts');
		console.log(JSON.stringify({ same: entry === owner, url: entry.use.baseURL, reuse: entry.webServer.reuseExistingServer, serverPort: entry.webServer.env?.HARNESS_DESKTOP_TEST_PORT ?? null }));
	`;
		const cold = await measuredConfiguration(program, env, verifying);
		expect(cold.exitCode, cold.stderr).toBe(0);
		expect(JSON.parse(cold.stdout), 'Every browser mode must honor its owned port').toEqual({
			same: true,
			url: `http://127.0.0.1:${other.port}`,
			reuse: false,
			serverPort: other.port
		});
		const run = await ordinaryRun(other.port, verifying);
		expect(browsers(other.agents)).toEqual([]);
		expect(run.said).toContain(`http://127.0.0.1:${other.port} is already used`);
		expect(run.code).not.toBe(0);
	},
	120_000
);

test('a port override that is no port is refused by its name before anything starts', async () => {
	const run = await ordinaryRun('5796x');
	expect(run.said).toContain('HARNESS_DESKTOP_TEST_PORT must be a port from 1024 to 65535');
	expect(run.said).not.toContain('Running');
	expect(run.code).not.toBe(0);
}, 120_000);

function measuredConfiguration(
	program: string,
	environment: NodeJS.ProcessEnv,
	verifying: boolean
) {
	const env = Object.fromEntries(
		Object.entries(environment).filter(
			(entry): entry is [string, string] => typeof entry[1] === 'string'
		)
	);
	return measureProcess(
		{
			units: ['desktop.config.development-tooling-desktop-playwright'],
			workload: `cold-browser-configuration-${verifying ? 'verified' : 'ordinary'}`,
			target: 'module',
			command: ['bun', '--eval', program],
			cwd: desktop,
			env,
			partial:
				'Actual cold public and canonical configuration imports in Bun, including Playwright and dependency startup and whole-child OS RSS. Excludes browser, app and isolated configuration memory.'
		},
		(command, cwd) =>
			new Promise((done) => {
				execFile(
					command[0],
					command.slice(1),
					{ cwd, env, timeout: 60000 },
					(error, stdout, stderr) => done({ exitCode: error ? 1 : 0, stdout, stderr })
				);
			})
	);
}
