import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import {
	chmodSync,
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, onTestFinished, test } from 'vitest';
import { observeResources } from '../../../test/support/resourceFixture';
import { signalProcesses, type TrackedProcess } from '../../../src/utils/processDescendants';
import { runIsolated } from '../../../src/utils/run-isolated/runIsolated';

/**
 * The simulator build under the Harness runner, which fails a command that leaves a process
 * behind. xcodebuild starts Interface Builder daemons that leave its process group and stay for
 * minutes; here a stand-in for xcodebuild does the same with a real, detached process, and the
 * real build script runs around it in a copy of its own. Nothing of Xcode is started.
 */
const mac = process.platform === 'darwin';
const desktop = resolve(import.meta.dirname, '..');
const root = mkdtempSync(join(tmpdir(), 'harness-ios-processes-'));
/** What these tests started themselves: their own children, and the stand-in's daemons. */
const children: ChildProcess[] = [];
const daemons: TrackedProcess[] = [];
afterAll(async () => {
	for (const child of children) child.kill('SIGKILL');
	await signalProcesses(daemons, 'SIGKILL');
	rmSync(root, { recursive: true, force: true });
});

const plist = (body: string) =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n${body}</dict>\n</plist>\n`;
const entry = (key: string, value: string) => `\t<key>${key}</key>\n\t<string>${value}</string>\n`;

/** Whether exactly this process still runs: its id with the time it started, not the id alone. */
function alive(known: TrackedProcess): boolean {
	try {
		const shown = execFileSync('ps', ['-p', String(known.pid), '-o', 'lstart='], { stdio: 'pipe' });
		return shown.toString().trim() === known.started;
	} catch {
		return false;
	}
}

/** The daemon a stand-in started, as it wrote it down while that daemon was certainly running. */
function daemonOf(home: string): TrackedProcess {
	const [pid, started] = readFileSync(join(home, 'daemon.pid'), 'utf8').split('\n');
	return { pid: Number(pid), started };
}

/** A signed product such as xcodebuild leaves, for the stand-in to put in place. */
function product(folder: string): void {
	const bundle = join(folder, 'App.app');
	mkdirSync(bundle, { recursive: true });
	writeFileSync(join(folder, 'main.c'), 'int main(void) { return 0; }\n');
	writeFileSync(join(folder, 'own.xcent'), plist(entry('application-identifier', 'com.example')));
	const described = entry('CFBundleIdentifier', 'com.example') + entry('CFBundleExecutable', 'App');
	writeFileSync(join(bundle, 'Info.plist'), plist(described));
	writeFileSync(join(bundle, 'capacitor.config.json'), '{}');
	const section = `-Wl,-sectcreate,__TEXT,__entitlements,${join(folder, 'own.xcent')}`;
	const link = ['clang', join(folder, 'main.c'), '-o', join(bundle, 'App'), section];
	execFileSync('xcrun', link, { stdio: 'pipe' });
	execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', bundle], {
		stdio: 'pipe'
	});
}

/**
 * A copy of the build scripts with a stand-in `xcodebuild` before the real one on the path. The
 * stand-in starts a process in a session of its own, as `ibtool` starts its daemon, stays long
 * enough to be seen as its parent, puts the product in place and ends as it is told to.
 */
function workspace(name: string): { cwd: string; path: string; daemon: () => TrackedProcess } {
	const home = join(root, name);
	const cwd = join(home, 'packages/desktop');
	mkdirSync(join(home, 'bin'), { recursive: true });
	cpSync(join(desktop, 'scripts'), join(cwd, 'scripts'), { recursive: true });
	symlinkSync(resolve(desktop, '../../src'), join(home, 'src'));
	product(join(home, 'product'));
	const standIn = `#!/usr/bin/env bun
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, writeFileSync } from 'node:fs';
const value = (flag) => process.argv[process.argv.indexOf(flag) + 1];
const daemon = spawn('/bin/sleep', ['120'], { detached: true, stdio: 'ignore' });
daemon.unref();
const started = execFileSync('ps', ['-p', String(daemon.pid), '-o', 'lstart=']).toString().trim();
writeFileSync(${JSON.stringify(join(home, 'daemon.pid'))}, daemon.pid + '\\n' + started);
const products = value('-derivedDataPath') + '/Build/Products/' + value('-configuration');
cpSync(${JSON.stringify(join(home, 'product/App.app'))}, products + '-iphonesimulator/App.app', { recursive: true });
if (value('-jobs') !== (process.env.CARGO_BUILD_JOBS ?? '1')) {
 console.error('Build escaped the managed worker budget');
 process.exit(66);
}
await new Promise((done) => setTimeout(done, 1200));
process.exit(Number(process.env.STAND_IN_EXIT ?? 0));
`;
	writeFileSync(join(home, 'bin/xcodebuild'), standIn);
	chmodSync(join(home, 'bin/xcodebuild'), 0o755);
	const daemon = () => {
		const known = daemonOf(home);
		daemons.push(known);
		return known;
	};
	return { cwd, path: `${join(home, 'bin')}:${process.env.PATH}`, daemon };
}

/** The build script as the native scenario runs it, under the runner that scenario uses. */
async function built(name: string, env: Record<string, string> = {}) {
	const finish = observeResources(
		['desktop.script.build-ios-simulator', 'desktop.script.ios-scan-fixture'],
		'simulator-script-and-scan-module-initialization-with-xcode-stand-in'
	);
	onTestFinished((context) => {
		if (context.task.result?.state === 'pass') finish();
	});
	const { cwd, path, daemon } = workspace(name);
	const log = join(root, `${name}.log`);
	const result = await runIsolated({
		command: 'bun',
		args: ['scripts/build-ios-simulator.ts'],
		cwd,
		env: { ...process.env, ...env, PATH: path },
		timeoutMs: 90_000,
		log,
		maxLogBytes: 1_000_000
	});
	return { result, output: readFileSync(log, 'utf8'), daemon: daemon() };
}

test.skipIf(!mac)(
	'a build that succeeds leaves no process behind',
	async () => {
		const { result, output, daemon } = await built('passing');
		expect(output).toContain('Debug simulator build; signature ad hoc, no team, no account.');
		expect(result.exitCode).toBe(0);
		expect(result.survivors).toEqual([]);
		expect(result.status).toBe('passed');
		expect(alive(daemon)).toBe(false);
	},
	120_000
);

test.skipIf(!mac)(
	'a build that fails leaves no process behind either, and still fails',
	async () => {
		const { result, output, daemon } = await built('failing', { STAND_IN_EXIT: '65' });
		expect(output).toContain('xcodebuild failed (65)');
		expect(result.exitCode).toBe(1);
		expect(result.survivors).toEqual([]);
		expect(alive(daemon)).toBe(false);
	},
	120_000
);

test.skipIf(!mac)(
	'a process the build did not start is never ended, whatever it is called',
	async () => {
		const bystander = spawn('/bin/sleep', ['120'], { detached: true, stdio: 'ignore' });
		children.push(bystander);
		const { result } = await built('bystander');
		expect(result.exitCode).toBe(0);
		expect(bystander.exitCode).toBeNull();
		expect(bystander.signalCode).toBeNull();
	},
	120_000
);

test.skipIf(!mac)(
	'while another build uses the shared Interface Builder tools, nothing is ended',
	async () => {
		// An idle daemon is reused by any ibtool or actool of the same person, so one that this
		// build did not start may be talking to a daemon that this build did start.
		const tools = join(root, 'another-build');
		mkdirSync(tools, { recursive: true });
		symlinkSync('/bin/sleep', join(tools, 'ibtool'));
		const client = spawn(join(tools, 'ibtool'), ['5'], { stdio: 'ignore' });
		children.push(client);
		const whenItEnded = new Promise<boolean>((done) =>
			client.once('exit', () => done(alive(daemonOf(join(root, 'shared')))))
		);
		const { result, daemon } = await built('shared');
		expect(await whenItEnded).toBe(true);
		expect(result.exitCode).toBe(0);
		expect(result.survivors).toEqual([]);
		expect(alive(daemon)).toBe(false);
	},
	120_000
);
