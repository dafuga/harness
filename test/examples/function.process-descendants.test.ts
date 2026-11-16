import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import {
	processDescendants,
	processTable,
	signalProcesses
} from '../../src/utils/development-tooling/processDescendants';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

type FixtureRow = { pid: number; parent: number; group: number; started: string };

async function installFakePs(directory: string, rows: FixtureRow[]): Promise<string> {
	const bin = join(directory, 'bin');
	await mkdir(bin);
	const output = rows.map(({ pid, parent, group, started }) => `${pid} ${parent} ${group} ${started}`);
	const executable = join(bin, 'ps');
	await writeFile(executable, `#!/bin/sh\nprintf '%s\\n' '${output.join("' '")}'\n`);
	await chmod(executable, 0o700);
	return bin;
}

async function processTableExample(directory: string): Promise<void> {
	const childPid = process.pid === 4243 ? 4244 : 4243;
	const child = {
		pid: childPid,
		parent: process.pid,
		group: process.pid,
		started: 'Fri Nov 13 09:32:11 2026'
	};
	const bin = await installFakePs(directory, [
		{
			pid: process.pid,
			parent: 1,
			group: process.pid,
			started: 'Fri Nov 13 09:32:10 2026'
		},
		child
	]);
	vi.stubEnv('PATH', bin);
	try {
		const rows = await processTable();
		const children = rows
			?.filter((row) => row.pid !== process.pid)
			.map(({ pid, started, parent, group }) => ({
				pid,
				started,
				parentIsCurrentProcess: parent === process.pid,
				groupIsCurrentProcess: group === process.pid
			}));
		expect(children).toEqual([
			{
				pid: childPid,
				started: child.started,
				parentIsCurrentProcess: true,
				groupIsCurrentProcess: true
			}
		]);
		recordTableExample(children);
	} finally {
		vi.unstubAllEnvs();
	}
}

function recordTableExample(output: unknown): void {
	recordExampleCases(
		{
			unitId: 'function.process-descendants',
			symbol: 'processTable',
			state: 'parses-bounded-ps-rows',
			evidence: 'examples-cases',
			file: 'parses-bounded-ps-rows.json'
		},
		[
			{
				name: 'reads process identity columns from ps',
				input: { args: ['-A', '-o', 'pid=,ppid=,pgid=,lstart='] },
				output
			}
		]
	);
}

test('Parses bounded ps rows', () =>
	withTempDir('process-descendants-table-', processTableExample)
);

test('Tracks survivors and marks group strangers', async () => {
	const root = { pid: 4242, started: 'Fri Nov 13 09:32:10 2026' };
	const child = { pid: 4243, parent: root.pid, group: 777, started: 'Fri Nov 13 09:32:11 2026' };
	const firstTable = [{ ...root, parent: 1, group: root.pid }, child];
	const afterRootExit = [
		{ ...child, parent: 1 },
		{ pid: 5000, parent: 1, group: root.pid, started: 'Fri Nov 13 09:32:12 2026' }
	];
	let reads = 0;
	const tracker = processDescendants(4242, async () => {
		reads++;
		return reads === 1 ? firstTable : afterRootExit;
	});
	await tracker.look();
	const survivors = await tracker.survivors();
	const alive = await tracker.alive();
	const aliveSummary = alive?.map(({ pid, origin, proven }) => ({ pid, origin, proven }));
	expect(survivors).toEqual([{ pid: child.pid, started: child.started }]);
	expect(aliveSummary).toEqual([
		{ pid: child.pid, origin: root, proven: true },
		{ pid: 5000, origin: null, proven: false }
	]);
	recordExampleCases(
		{
			unitId: 'function.process-descendants',
			symbol: 'processDescendants',
			state: 'tracks-survivors-and-marks-group-strangers',
			evidence: 'examples-cases',
			file: 'tracks-survivors-and-marks-group-strangers.json'
		},
		[
			{
				name: 'retains a parent-linked survivor and marks an unproven group member',
				input: { root: 4242, tables: [firstTable, afterRootExit, afterRootExit] },
				output: { survivors, alive: aliveSummary }
			}
		]
	);
});

async function signalExample(directory: string): Promise<void> {
	const matched = { pid: 4242, started: 'Fri Nov 13 09:32:10 2026' };
	const replaced = { pid: 4243, started: 'Fri Nov 13 09:32:11 2026' };
	const bin = await installFakePs(directory, [
		{ pid: process.pid, parent: 1, group: process.pid, started: 'Fri Nov 13 09:32:09 2026' },
		{ ...matched, parent: 1, group: matched.pid },
		{ pid: replaced.pid, parent: 1, group: replaced.pid, started: 'Fri Nov 13 09:32:12 2026' }
	]);
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		throw new Error('fixture process already ended');
	});
	vi.stubEnv('PATH', bin);
	try {
		const known = [matched, replaced];
		await signalProcesses(known, 'SIGTERM');
		const signals = kill.mock.calls
			.filter(([pid]) => pid === matched.pid || pid === replaced.pid)
			.map(([pid, signal]) => ({ pid, signal }));
		expect(signals).toEqual([{ pid: matched.pid, signal: 'SIGTERM' }]);
		recordExampleCases(
			{
				unitId: 'function.process-descendants',
				symbol: 'signalProcesses',
				state: 'checks-process-identities-before-signaling',
				evidence: 'examples-cases',
				file: 'checks-process-identities-before-signaling.json'
			},
			[
				{
					name: 'signals a matching start time and skips a reused pid',
					input: {
						known,
						signal: 'SIGTERM',
						freshRows: [matched, { ...replaced, started: 'Fri Nov 13 09:32:12 2026' }]
					},
					output: signals
				}
			]
		);
	} finally {
		vi.unstubAllEnvs();
		kill.mockRestore();
	}
}

test('Checks process identities before signaling', () =>
	withTempDir('process-descendants-signals-', signalExample)
);
