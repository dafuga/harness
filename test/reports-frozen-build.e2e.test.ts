import { recordCapture, evidenceRequested } from '../src/utils/record-capture/recordCapture';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { ownEnvironment, runCommand } from './support/cli';
import { freePort } from './support/workers';

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
	const frozen = await freezeCommand(true);
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
	const absent = await freezeCommand(false);
	expect(absent.exitCode).toBe(1);
	expect(absent.stderr).toContain('holds no build');
	expect(existsSync(standIn)).toBe(false);
});

/** Keep the normal cold script workload and observe its own process, including failed admission. */
async function freezeCommand(expectSuccess: boolean) {
	const args = ['bun', 'scripts/freeze-build.ts', standIn];
	const env = { HARNESS_E2E_ROOT: run };
	if (!evidenceRequested()) return runCommand(args, reports, expectSuccess, env);
	const usage = join(run, 'freeze-usage.txt');
	const started = performance.now();
	const result = await runCommand(
		['/usr/bin/time', process.platform === 'darwin' ? '-l' : '-v', '-o', usage, ...args],
		reports,
		expectSuccess,
		env
	);
	const duration = performance.now() - started;
	const text = await readFile(usage, 'utf8');
	const resident =
		process.platform === 'darwin'
			? /^\s*(\d+)\s+maximum resident set size/m.exec(text)
			: /Maximum resident set size \(kbytes\):\s*(\d+)/.exec(text);
	if (!resident) throw new Error('The frozen-build process did not report peak RSS.');
	recordFreezeUsage(
		expectSuccess,
		duration,
		Number(resident[1]) * (process.platform === 'darwin' ? 1 : 1024)
	);
	return result;
}

function recordFreezeUsage(copy: boolean, duration: number, resident: number) {
	const context = {
		unit: 'reports.script.freeze-build',
		workload: copy ? 'copy-build' : 'missing-build',
		target: 'process',
		samples: 1
	};
	const measurements = [
		{
			...context,
			metric: 'latency-cli-ms',
			unitOfMeasure: 'ms',
			value: duration,
			method:
				'Wall time of one cold frozen-build script process, including startup and build validation or copy; no warmup.'
		},
		{
			...context,
			metric: 'process-peak-rss-bytes',
			unitOfMeasure: 'bytes',
			value: resident,
			method:
				'Peak resident set of the cold Bun script process reported by system time; includes its runtime and dependencies.'
		}
	];
	recordCapture(
		{
			evidence: 'behavior-benchmarks',
			kind: 'benchmark',
			state: context.workload,
			file: 'freeze-usage-' + randomUUID() + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
