import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { processTable } from '../../src/utils/processDescendants';
import { runIsolated } from '../../src/utils/run-isolated/runIsolated';

const node = process.execPath;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const started: number[] = [];
/** True while a process with this id exists; signal 0 only asks. */
function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
// Nothing this file starts is left behind, whatever the code under test did with it.
afterEach(() => {
	for (const pid of started.splice(0)) if (alive(pid)) process.kill(pid, 'SIGKILL');
});

/**
 * The processes as the runner reads them. Once a look shows the child that a command named in
 * `family` under that command, `seen` is written: the command may wait for it before it ends.
 */
function observing(directory: string) {
	return async () => {
		const rows = await processTable();
		const family = join(directory, 'family');
		const [parent, child] = existsSync(family) ? readFileSync(family, 'utf8').split(' ') : [];
		const shown = rows?.find((row) => row.pid === Number(child));
		const under = shown?.parent === Number(parent) && rows?.some((row) => row.pid === shown.parent);
		if (under) writeFileSync(join(directory, 'seen'), '');
		return rows;
	};
}
/** For a command: names itself and its child `kid`, and ends once the runner saw both. */
const leaveOnceSeen =
	'const fs = require("fs"), at = (name) => require("path").join(process.argv[1], name); ' +
	'fs.writeFileSync(at("family.part"), process.pid + " " + kid.pid); ' +
	'fs.renameSync(at("family.part"), at("family")); ' +
	'setInterval(() => fs.existsSync(at("seen")) && process.exit(0), 10);';

async function run(
	script: string,
	timeoutMs = 5000,
	maxLogBytes = 64_000,
	options: { onSpawn?: (pid: number) => void; signal?: AbortSignal } = {}
) {
	const directory = await mkdtemp(join(tmpdir(), 'harness-isolated-'));
	const log = join(directory, 'run.log');
	const result = await runIsolated({
		...options,
		command: node,
		args: ['-e', script, directory],
		cwd: directory,
		env: { ...process.env },
		timeoutMs,
		log,
		maxLogBytes,
		platform: { table: observing(directory) }
	});
	return { directory, log, result };
}

test.each([
	[0, 0],
	[100, 0],
	[0, 150],
	[100, 150]
])(
	'commands retain exit codes and output with %i ms spawn and %i ms table observers',
	async (delay, tableDelay) => {
		let pid: number | undefined;
		const passed = await run('console.log("out"); console.error("err")', 5000, 64000, {
			onSpawn: (own) => {
				pid = own;
				if (delay) execFileSync('sleep', [String(delay / 1000)]);
			}
		});
		expect(pid).toBeGreaterThan(0);
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
		const native = await observedBunExit(delay, tableDelay);
		expect(native.result).toMatchObject({ status: 'passed', exitCode: 0, timedOut: false });
		expect(native.output).toBe('out\nerr\n');
	}
);

/** Native Bun can deliver a child's events while a synchronous observer asks another process. */
async function observedBunExit(delay: number, tableDelay: number) {
	const directory = await mkdtemp(join(tmpdir(), 'harness-observed-exit-'));
	const source = new URL('../../src/utils/runIsolated.ts', import.meta.url).href;
	const table = new URL('../../src/utils/processDescendants.ts', import.meta.url).href;
	const script = `import {runIsolated} from ${JSON.stringify(source)};
		import {processTable} from ${JSON.stringify(table)};
		import {execFileSync} from 'node:child_process';
		import {readFileSync} from 'node:fs';
		const result = await runIsolated({command:'sh',args:['-c','printf "out\\n"; printf "err\\n" >&2'],
		cwd:${JSON.stringify(directory)},env:process.env,timeoutMs:500,
		log:${JSON.stringify(join(directory, 'run.log'))},maxLogBytes:1000,
		platform:{table:()=>{if (${tableDelay}) execFileSync('sleep',[String(${tableDelay}/1000)]);return processTable();}},
		onSpawn:()=>{if (${delay}) execFileSync('sleep',[String(${delay}/1000)])}});
		console.log(JSON.stringify({result,output:readFileSync(result.log.path,'utf8')}));`;
	return JSON.parse(execFileSync('bun', ['-e', script], { encoding: 'utf8', timeout: 6000 })) as {
		result: { status: string; exitCode: number; timedOut: boolean };
		output: string;
	};
}

test('a command that ignores termination is still stopped at its limit', async () => {
	const started = Date.now();
	const { result } = await run('process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)', 300);
	expect(result).toMatchObject({ status: 'timeout', timedOut: true });
	expect(Date.now() - started).toBeLessThan(5000);
	expect(result.durationMs).toBeGreaterThanOrEqual(300);
	const abort = new AbortController();
	const cancelled = run('setInterval(()=>{},1000)', 5000, 64000, { signal: abort.signal });
	setTimeout(() => abort.abort(), 100);
	expect((await cancelled).result).toMatchObject({ status: 'failed', timedOut: false });
});

test('children of a timed-out or finished command are torn down with it', async () => {
	const child = (name: string, delay: number) =>
		`const kid = require("child_process").spawn(process.execPath, ["-e", ` +
		`"setTimeout(() => require('fs').writeFileSync(process.argv[1], 'late'), ${delay})", ` +
		`require("path").join(process.argv[1], "${name}")], { stdio: "ignore" });`;
	const hung = await run(`${child('hung.txt', 1200)} setInterval(() => {}, 1000)`, 300);
	expect(hung.result.status).toBe('timeout');
	// A child counts as the command's once it was seen under it: the command ends only then.
	const finished = await run(`${child('finished.txt', 1200)} ${leaveOnceSeen}`);
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

test('a process that left the group of a finished command is stopped and reported, never left running', async () => {
	// A daemon: its own session, no shared output, and the command that started it exits cleanly.
	const daemon =
		'const child = require("child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], ' +
		'{ detached: true, stdio: "ignore" }); child.unref(); ' +
		'require("fs").writeFileSync(require("path").join(process.argv[1], "pid"), String(child.pid)); ' +
		'setTimeout(() => process.exit(0), 700);';
	const left = await run(daemon);
	const pid = Number(await readFile(join(left.directory, 'pid'), 'utf8'));
	started.push(pid);
	expect(left.result).toMatchObject({ exitCode: 0, survivors: [{ pid }] });
	expect(left.result.status).toBe('failed');
	expect(alive(pid)).toBe(false);
	// A command whose children stay with it, and end with it, has left nothing.
	const kept =
		'require("child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }); ' +
		'setTimeout(() => process.exit(0), 500);';
	const clean = await run(kept);
	expect(clean.result).toMatchObject({ status: 'passed', exitCode: 0, survivors: [] });
}, 30_000);
