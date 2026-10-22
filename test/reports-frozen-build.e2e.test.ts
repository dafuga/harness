import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { ownEnvironment, runCommand } from './support/cli';
import { freePort } from './support/workers';
import { measureProcess } from './support/cli-measurement/measureHarness';

/**
 * What a rebuild does to a built server: the files it has not loaded yet are replaced under
 * it. A stand-in for the checkout's build directory is used, a copy inside the checkout where
 * the server's packages resolve, so that the real one is never changed by this test.
 */
const reports = resolve('packages/reports');
const scratch = resolve('.cache', `frozen-build-test-${process.pid}`);
const standIn = join(scratch, 'build');
const page = `/harness/branch/main/commit/${'a'.repeat(40)}/pages`;
const servers: ChildProcess[] = [];
let run: string;

/** A server with no owner policy: every console address has to be refused with 403. */
async function locked(directory: string): Promise<string> {
	const port = await freePort();
	const env = {
		...ownEnvironment(),
		HOST: '127.0.0.1',
		PORT: String(port),
		HARNESS_OWNER_MODE: ''
	};
	servers.push(spawn('bun', [join(directory, 'index.js')], { cwd: reports, env, stdio: 'ignore' }));
	const origin = `http://127.0.0.1:${port}`;
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const answered = await fetch(`${origin}/harness/data/index.json`).then(
			(answer) => answer.status,
			() => 0
		);
		if (answered === 403) return origin;
		await new Promise((done) => setTimeout(done, 100));
	}
	throw new Error(`${directory} did not start`);
}
const status = (origin: string) =>
	fetch(origin + page, { redirect: 'manual' }).then((answer) => answer.status);
/** As a rebuild leaves it: the lazily loaded server files of before are no longer there. */
function rebuilt(directory: string): void {
	rmSync(join(directory, 'server'), { recursive: true, force: true });
	cpSync(join(reports, 'build', 'server'), join(directory, 'server-next'), { recursive: true });
}

beforeAll(async () => {
	run = await mkdtemp(join(tmpdir(), 'harness-frozen-run-'));
});
afterEach(() => {
	for (const server of servers.splice(0)) server.kill('SIGKILL');
	rmSync(scratch, { recursive: true, force: true });
});
afterAll(async () => {
	await rm(run, { recursive: true, force: true });
	rmSync(resolve('.cache/reports-e2e', run.split('/').at(-1) ?? ''), {
		recursive: true,
		force: true
	});
});
const standInBuild = () => {
	mkdirSync(scratch, { recursive: true });
	cpSync(join(reports, 'build'), standIn, { recursive: true });
};

test('a server on the build directory itself answers a refused page with an error once that directory is rebuilt', async () => {
	// The mechanism, kept as a control: it is why a run must not serve the directory directly.
	standInBuild();
	const origin = await locked(standIn);
	expect(await status(origin)).toBe(403);
	const fresh = await locked(standIn);
	rebuilt(standIn);
	expect(await status(fresh)).toBe(500);
});

test('a run serves its own copy of the build, which a rebuild of the directory does not reach', async () => {
	standInBuild();
	const env = { HARNESS_E2E_ROOT: run };
	const frozen = await measureProcess(
		{
			units: ['reports.script.freeze-build'],
			workload: 'freeze-built-report-server',
			target: 'module',
			command: ['bun', 'scripts/freeze-build.ts', standIn],
			cwd: reports,
			env
		},
		runCommand
	);
	const copy = (JSON.parse(frozen.stdout) as { build: string; buildId: string }).build;
	expect(copy).not.toBe(standIn);
	expect(readdirSync(copy)).toEqual(readdirSync(standIn));
	const origin = await locked(copy);
	rebuilt(standIn);
	// Refused as before, for a page the server had not loaded when the directory changed.
	expect(await status(origin)).toBe(403);
	expect(await status(origin)).toBe(403);
}, 60_000);

test('a directory that holds no build is named, and nothing is served from it', async () => {
	const env = { HARNESS_E2E_ROOT: run };
	const absent = await runCommand(['bun', 'scripts/freeze-build.ts', standIn], reports, false, env);
	expect(absent.exitCode).toBe(1);
	expect(absent.stderr).toContain('holds no build');
	expect(existsSync(standIn)).toBe(false);
});
