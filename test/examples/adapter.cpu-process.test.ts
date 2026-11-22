import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type * as OperatingSystem from 'node:os';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { CpuProcessAdapter } from '../../src/services/development-tooling/cpu-usage-service/cpu-process-adapter/CpuProcessAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

// Overrides only the host readings the adapter takes; every other node:os function stays real.
const host = vi.hoisted(() => ({
	platform: undefined as ReturnType<typeof OperatingSystem.platform> | undefined,
	cpus: undefined as OperatingSystem.CpuInfo[] | undefined
}));

vi.mock('node:os', async (importOriginal) => {
	const real = await importOriginal<typeof OperatingSystem>();
	return {
		...real,
		platform: () => host.platform ?? real.platform(),
		cpus: () => host.cpus ?? real.cpus()
	};
});

afterEach(() => {
	host.platform = undefined;
	host.cpus = undefined;
	vi.unstubAllEnvs();
});

const processor: OperatingSystem.CpuInfo = {
	model: 'Fixture CPU',
	speed: 2400,
	times: { user: 8000, nice: 0, sys: 8000, idle: 44000, irq: 0 }
};
const processors = [processor, processor, processor, processor];
const cpu = { idle: 176000, total: 240000, cores: 4 };
const psTable = [
	'  101     1 0:01.50 /usr/local/bin/harness dev',
	'  202     1 1-02:03:04 /Applications/Codex.app/Contents/MacOS/Codex --type=renderer',
	'  303     1 00:05.25 codex app-server --listen stdio://',
	'  404   303 00:00.40 codex exec --json',
	'  505     1 00:12.00 /opt/homebrew/bin/claude --resume',
	'  606     1 00:02.00 /usr/sbin/cron -f',
	'not a process row'
].join('\n');
const processes = [
	{ pid: 101, parentPid: 1, cpuMs: 1500, role: 'harness', label: 'Harness' },
	{ pid: 202, parentPid: 1, cpuMs: 93784000, role: 'codex', label: 'Codex app' },
	{ pid: 303, parentPid: 1, cpuMs: 5250, role: 'codex', label: 'Codex app' },
	{ pid: 404, parentPid: 303, cpuMs: 400, role: 'agent', label: 'Codex CLI' },
	{ pid: 505, parentPid: 1, cpuMs: 12000, role: 'agent', label: 'Claude' },
	{ pid: 606, parentPid: 1, cpuMs: 2000 }
];
const catTable = (table: string) => `/bin/cat '${table}'`;

/** A fake ps first on PATH: it records its arguments and LC_ALL in argv, then runs its tail. */
function installPs(root: string, tail: (table: string) => string): { argv: string; table: string } {
	const bin = join(root, 'bin');
	const argv = join(root, 'argv.txt');
	const table = join(root, 'table.txt');
	mkdirSync(bin, { recursive: true });
	writeFileSync(table, psTable);
	const script = join(bin, 'ps');
	writeFileSync(
		script,
		`#!/bin/sh\nprintf '%s\\n' "$@" "LC_ALL=$LC_ALL" > '${argv}'\n${tail(table)}\n`
	);
	chmodSync(script, 0o700);
	vi.stubEnv('PATH', bin);
	return { argv, table };
}

/** Resolves to the error a call rejects with; a call that resolves fails the test. */
async function rejectionOf(run: () => Promise<unknown>): Promise<unknown> {
	try {
		await run();
	} catch (error) {
		return error;
	}
	throw new Error('Expected the call to reject.');
}

/** The name and message that JSON evidence keeps, since an Error serialises to {}. */
function plain(error: unknown): { name: string; message: string } {
	const { name, message } = error as Error;
	return { name, message };
}

test('Samples CPU counters and recognized ps process rows.', async () => {
	await withTempDir('cpu-process-examples-', async (directory) => {
		const ps = installPs(directory, catTable);
		host.platform = 'darwin';
		host.cpus = processors;
		const output = await new CpuProcessAdapter().sample();
		const later = await new CpuProcessAdapter().sample();
		expect(output.at).toBeGreaterThan(0);
		expect(later.at).toBeGreaterThanOrEqual(output.at);
		expect(output).toEqual({ at: output.at, cpu, processes });
		expect(readFileSync(ps.argv, 'utf8')).toBe('-axo\npid=,ppid=,time=,args=\nLC_ALL=C\n');
		host.platform = 'linux';
		const linux = await new CpuProcessAdapter().sample();
		expect(linux.at).toBeGreaterThanOrEqual(later.at);
		expect(linux).toEqual({ at: linux.at, cpu, processes });
		host.platform = 'darwin';
		writeFileSync(ps.table, '');
		const empty = await new CpuProcessAdapter().sample();
		expect(empty.at).toBeGreaterThanOrEqual(linux.at);
		expect(empty).toEqual({ at: empty.at, cpu, processes: [] });
		recordExampleCases(
			{
				unitId: 'adapter.cpu-process',
				symbol: 'CpuProcessAdapter.sample',
				state: 'samples-cpu-counters-and-recognized-ps-process-rows',
				evidence: 'examples-cases',
				file: 'samples-cpu-counters-and-recognized-ps-process-rows.json'
			},
			[
				{
					name: 'ps rows with Harness, Codex, Claude and unknown commands',
					input: { platform: 'darwin', processors, psTable: psTable.split('\n') },
					output
				},
				{
					name: 'linux hosts read the same ps rows',
					input: { platform: 'linux', processors, psTable: psTable.split('\n') },
					output: linux
				},
				{
					name: 'empty ps table keeps the CPU counters',
					input: { platform: 'darwin', processors, psTable: [] },
					output: empty
				}
			]
		);
	});
});

test('Rejects when the bounded ps command fails or overflows.', async () => {
	await withTempDir('cpu-process-examples-', async (directory) => {
		host.platform = 'darwin';
		host.cpus = processors;
		installPs(join(directory, 'exit'), () => 'exit 1');
		const exited = await rejectionOf(() => new CpuProcessAdapter().sample());
		installPs(join(directory, 'overflow'), () => '/bin/dd if=/dev/zero bs=1048576 count=5');
		const overflowed = await rejectionOf(() => new CpuProcessAdapter().sample());
		expect(plain(exited)).toEqual({
			name: 'BoundedCommandFailure',
			message: 'Command failed with exit code 1.'
		});
		expect(plain(overflowed)).toEqual({
			name: 'BoundedCommandFailure',
			message: 'Command output limit exceeded.'
		});
		recordExampleCases(
			{
				unitId: 'adapter.cpu-process',
				symbol: 'CpuProcessAdapter.sample',
				state: 'rejects-when-the-bounded-ps-command-fails-or-overflows',
				evidence: 'examples-cases',
				file: 'rejects-when-the-bounded-ps-command-fails-or-overflows.json'
			},
			[
				{ name: 'ps exits with status 1', input: { psExitStatus: 1 }, error: plain(exited) },
				{
					name: 'ps writes 5 MiB, past the 4 MiB output cap',
					input: { psOutputBytes: 5242880 },
					error: plain(overflowed)
				}
			]
		);
	});
});

test('Rejects an unsupported platform before running ps.', async () => {
	await withTempDir('cpu-process-examples-', async (directory) => {
		const ps = installPs(directory, () => 'exit 0');
		host.platform = 'win32';
		const error = await rejectionOf(() => new CpuProcessAdapter().sample());
		expect(error).toBeInstanceOf(Error);
		expect(plain(error)).toEqual({
			name: 'UnsupportedCpuProcessPlatformError',
			message: 'Unsupported CPU process platform.'
		});
		expect(existsSync(ps.argv)).toBe(false);
		recordExampleCases(
			{
				unitId: 'adapter.cpu-process',
				symbol: 'CpuProcessAdapter.sample',
				state: 'rejects-an-unsupported-platform-before-running-ps',
				evidence: 'examples-cases',
				file: 'rejects-an-unsupported-platform-before-running-ps.json'
			},
			[
				{
					name: 'win32 is neither darwin nor linux',
					input: { platform: 'win32' },
					error: plain(error)
				}
			]
		);
	});
});

test('Rejects when CPU counters are unavailable after ps.', async () => {
	await withTempDir('cpu-process-examples-', async (directory) => {
		const ps = installPs(directory, catTable);
		host.platform = 'darwin';
		host.cpus = [];
		const error = await rejectionOf(() => new CpuProcessAdapter().sample());
		expect(error).toBeInstanceOf(Error);
		expect(plain(error)).toEqual({
			name: 'CpuCountersUnavailableError',
			message: 'CPU counters unavailable.'
		});
		expect(existsSync(ps.argv)).toBe(true);
		recordExampleCases(
			{
				unitId: 'adapter.cpu-process',
				symbol: 'CpuProcessAdapter.sample',
				state: 'rejects-when-cpu-counters-are-unavailable-after-ps',
				evidence: 'examples-cases',
				file: 'rejects-when-cpu-counters-are-unavailable-after-ps.json'
			},
			[
				{
					name: 'no processors are reported after ps succeeds',
					input: { platform: 'darwin', processors: [], psExitStatus: 0 },
					error: plain(error)
				}
			]
		);
	});
});
