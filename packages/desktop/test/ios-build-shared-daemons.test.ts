import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { signalProcesses, type TrackedProcess } from '../../../src/utils/processDescendants';
import { runIsolated } from '../../../src/utils/runIsolated';

/**
 * Apple's Interface Builder daemons are shared: one that a build started is reused by any other
 * build of the same person. Having started one is therefore no right to end it. Everything here
 * is synthetic and owned by these tests: a stand-in daemon inside a made-up developer directory
 * that writes down every signal it is sent and retires by itself. Nothing of Xcode is started.
 */
const mac = process.platform === 'darwin';
const desktop = resolve(import.meta.dirname, '..');
const root = mkdtempSync(join(tmpdir(), 'harness-ios-shared-'));
const developer = join(root, 'Developer');
const daemonPath = join(developer, 'usr/bin/ibtoold');
const children: ChildProcess[] = [];
const daemons: TrackedProcess[] = [];

const daemonSource = `
#include <fcntl.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
static const char *journal;
static void note(const char *text) {
	int file = open(journal, O_WRONLY | O_CREAT | O_APPEND, 0600);
	if (file >= 0) { write(file, text, strlen(text)); close(file); }
}
static void signalled(int number) { (void)number; note("signalled\\n"); }
int main(int count, char **arguments) {
	if (count < 3) return 2;
	journal = arguments[2];
	int every[] = { SIGTERM, SIGINT, SIGHUP, SIGQUIT, SIGUSR1, SIGUSR2 };
	for (unsigned index = 0; index < sizeof every / sizeof *every; index++) signal(every[index], signalled);
	for (int left = atoi(arguments[1]) * 10; left > 0; left--) usleep(100000);
	note("retired\\n");
	return 0;
}
`;

beforeAll(() => {
	if (!mac) return;
	mkdirSync(join(developer, 'usr/bin'), { recursive: true });
	mkdirSync(join(root, 'another-build'), { recursive: true });
	writeFileSync(join(root, 'daemon.c'), daemonSource);
	execFileSync('xcrun', ['clang', join(root, 'daemon.c'), '-o', daemonPath], { stdio: 'pipe' });
	symlinkSync('/bin/sleep', join(root, 'another-build/ibtool'));
});
afterAll(async () => {
	for (const child of children) child.kill('SIGKILL');
	await signalProcesses(daemons, 'SIGKILL');
	rmSync(root, { recursive: true, force: true });
});

const pause = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds));
const journal = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

/** Whether exactly this process still runs: its id with the time it started, not the id alone. */
function alive(known: TrackedProcess): boolean {
	try {
		const shown = execFileSync('ps', ['-p', String(known.pid), '-o', 'lstart='], { stdio: 'pipe' });
		return shown.toString().trim() === known.started;
	} catch {
		return false;
	}
}

/** Another build's client of the shared tools, running for so many seconds. */
function anotherBuild(seconds: number): void {
	children.push(spawn(join(root, 'another-build/ibtool'), [String(seconds)], { stdio: 'ignore' }));
}

/**
 * One case: a stand-in build tool that starts the shared daemon for so many seconds and a
 * private helper, both in sessions of their own, and ends after a moment; and the script that
 * runs it through the build's own runner of tools, as the simulator build runs xcodebuild.
 */
function scene(name: string, daemonSeconds: number) {
	const home = join(root, name);
	mkdirSync(join(home, 'bin'), { recursive: true });
	const files = { journal: join(home, 'journal'), started: join(home, 'started') };
	const tool = `#!/usr/bin/env bun
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const known = (child) => child.pid + ' ' + execFileSync('/bin/ps', ['-p', String(child.pid), '-o', 'lstart=']).toString().trim();
const shared = spawn(${JSON.stringify(daemonPath)}, ['${daemonSeconds}', ${JSON.stringify(files.journal)}], { detached: true, stdio: 'ignore' });
const own = spawn('/bin/sleep', ['120'], { detached: true, stdio: 'ignore' });
shared.unref();
own.unref();
writeFileSync(${JSON.stringify(files.started)}, known(shared) + '\\n' + known(own));
await new Promise((done) => setTimeout(done, 1200));
`;
	writeFileSync(join(home, 'tool'), tool);
	chmodSync(join(home, 'tool'), 0o755);
	const script = `import { followed } from ${JSON.stringify(join(desktop, 'scripts/ios-build-processes.ts'))};
const ended = await followed([${JSON.stringify(join(home, 'tool'))}]);
process.exit(ended.code);
`;
	writeFileSync(join(home, 'run.ts'), script);
	const started = () => {
		const rows = readFileSync(files.started, 'utf8').split('\n');
		const [shared, own] = rows.map((row) => {
			const [pid, ...when] = row.split(' ');
			return { pid: Number(pid), started: when.join(' ') };
		});
		daemons.push(shared, own);
		return { shared, own };
	};
	return { home, journal: files.journal, started };
}

/** The scene under the Harness runner, as a verification runs a command. */
function verified(home: string, timeoutMs: number, path = process.env.PATH) {
	return runIsolated({
		command: 'bun',
		args: [join(home, 'run.ts')],
		cwd: desktop,
		env: { ...process.env, HARNESS_VERIFY: '1', DEVELOPER_DIR: developer, PATH: path },
		timeoutMs,
		log: join(home, 'log'),
		maxLogBytes: 1_000_000
	});
}

test.skipIf(!mac)(
	'a shared daemon that another build takes up later is never signalled; it retires by itself',
	async () => {
		const { home, journal: file, started } = scene('late', 6);
		const running = verified(home, 60_000);
		await pause(2500);
		anotherBuild(2);
		const result = await running;
		const { shared, own } = started();
		expect(journal(file)).toBe('retired\n');
		expect(result.durationMs).toBeGreaterThan(5500);
		expect(result.exitCode).toBe(0);
		expect(result.survivors).toEqual([]);
		expect(alive(shared)).toBe(false);
		expect(alive(own)).toBe(false);
	},
	90_000
);

test.skipIf(!mac)(
	'when the processes cannot be observed nothing is signalled and the build does not call itself done',
	async () => {
		const { home, journal: file, started } = scene('blind', 30);
		writeFileSync(join(home, 'bin/ps'), '#!/bin/sh\nexit 1\n');
		chmodSync(join(home, 'bin/ps'), 0o755);
		const running = verified(home, 7000, `${join(home, 'bin')}:${process.env.PATH}`);
		await pause(5000);
		const { shared, own } = started();
		const before = { journal: journal(file), shared: alive(shared), own: alive(own) };
		const result = await running;
		expect(before).toEqual({ journal: '', shared: true, own: true });
		expect(result.timedOut).toBe(true);
	},
	90_000
);

test.skipIf(!mac)(
	'a shared daemon that another build keeps using for long is waited for, not ended or abandoned',
	async () => {
		const { home, journal: file, started } = scene('long', 36);
		anotherBuild(33);
		const result = await verified(home, 90_000);
		const { shared } = started();
		expect(journal(file)).toBe('retired\n');
		expect(result.durationMs).toBeGreaterThan(35_000);
		expect(result.exitCode).toBe(0);
		expect(result.survivors).toEqual([]);
		expect(alive(shared)).toBe(false);
	},
	150_000
);
