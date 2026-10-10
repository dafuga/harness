import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runIsolated } from '../../src/utils/runIsolated';

const node = process.execPath;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(script: string, timeoutMs = 5000, maxLogBytes = 64_000) {
	const directory = await mkdtemp(join(tmpdir(), 'harness-isolated-'));
	const log = join(directory, 'run.log');
	const result = await runIsolated({
		command: node,
		args: ['-e', script, directory],
		cwd: directory,
		env: { ...process.env },
		timeoutMs,
		log,
		maxLogBytes
	});
	return { directory, log, result };
}

test('a passing and a failing command report their exit codes and output', async () => {
	const passed = await run('console.log("out"); console.error("err")');
	expect(passed.result).toMatchObject({ status: 'passed', exitCode: 0, timedOut: false });
	expect(await readFile(passed.log, 'utf8')).toBe('out\nerr\n');
	const failed = await run('process.exit(7)');
	expect(failed.result).toMatchObject({ status: 'failed', exitCode: 7, timedOut: false });
	const absent = await runIsolated({
		command: '/nonexistent/harness-check',
		args: [],
		cwd: tmpdir(),
		env: {},
		timeoutMs: 1000,
		log: join(passed.directory, 'absent.log'),
		maxLogBytes: 1000
	});
	expect(absent).toMatchObject({ status: 'failed', exitCode: null, timedOut: false });
});

test('a command that ignores termination is still stopped at its limit', async () => {
	const started = Date.now();
	const { result } = await run('process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)', 300);
	expect(result).toMatchObject({ status: 'timeout', timedOut: true });
	expect(Date.now() - started).toBeLessThan(5000);
	expect(result.durationMs).toBeGreaterThanOrEqual(300);
});

test('children of a timed-out or finished command are torn down with it', async () => {
	const child = (name: string, delay: number) =>
		`require("child_process").spawn(process.execPath, ["-e", ` +
		`"setTimeout(() => require('fs').writeFileSync(process.argv[1], 'late'), ${delay})", ` +
		`require("path").join(process.argv[1], "${name}")], { stdio: "ignore" });`;
	const hung = await run(`${child('hung.txt', 1200)} setInterval(() => {}, 1000)`, 300);
	expect(hung.result.status).toBe('timeout');
	const finished = await run(`${child('finished.txt', 1200)} process.exit(0)`);
	expect(finished.result.status).toBe('passed');
	await sleep(2000);
	expect(existsSync(join(hung.directory, 'hung.txt'))).toBe(false);
	expect(existsSync(join(finished.directory, 'finished.txt'))).toBe(false);
}, 20_000);

test('output beyond the log limit is cut off without stalling the command', async () => {
	const flood = 'for (let i = 0; i < 20000; i += 1) console.log("x".repeat(100));';
	const { result, log } = await run(flood, 10_000, 5000);
	expect(result.status).toBe('passed');
	const text = await readFile(log, 'utf8');
	expect(text.length).toBeLessThanOrEqual(5100);
	expect(text).toContain('[output truncated]');
	expect(result.log.bytes).toBe(Buffer.byteLength(text));
	expect(result.log.sha256).toMatch(/^[0-9a-f]{64}$/);
});
