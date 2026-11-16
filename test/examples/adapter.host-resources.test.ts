import type * as OperatingSystem from 'node:os';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import type { ResourceSnapshot } from '../../src/core/execution-runtimes/resourceTypes';
import { HostResourcesAdapter } from '../../src/services/execution-runtimes/resource-queue-service/resource-monitor-service/host-resources-adapter/HostResourcesAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * The platform is fixed to macOS, so every host runs the adapter's vm_stat and sysctl probes.
 * Those probes are fake executables on PATH; the CPU counters are read from the real host.
 */
const host = vi.hoisted(() => ({ platform: (): string => 'darwin' }));
vi.mock('node:os', async (original) => ({
	...(await original<typeof OperatingSystem>()),
	platform: () => host.platform()
}));

const unitId = 'adapter.host-resources';
const symbol = 'HostResourcesAdapter.sample';
const evidence = 'examples-cases';
const vmStat = [
	'Mach Virtual Memory Statistics: (page size of 16384 bytes)',
	'Pages free: 1000.',
	'Pages active: 9000.',
	'Pages inactive: 2000.',
	'Pages speculative: 500.',
	'Pages purgeable: 100.'
];
/** Free, inactive and speculative pages at 16384 bytes each. */
const availableBytes = (1000 + 2000 + 500) * 16384;
/** The contract's unavailable snapshot: zero counts, no CPU reading and an unknown pressure. */
const unavailableFields = {
	status: 'unavailable',
	logicalCores: 0,
	usableCores: 0,
	cpuUsedPercent: null,
	cpuAvailableCores: 0,
	memoryTotalBytes: 0,
	memoryAvailableBytes: 0,
	memoryPressure: 'unknown'
};

afterEach(() => {
	vi.unstubAllEnvs();
	host.platform = () => 'darwin';
});

/**
 * Writes a fake executable that prints the given lines; no real vm_stat or sysctl is started.
 * The lines are single-quoted for the shell, so they must not contain single quotes.
 */
function writeProbe(path: string, lines: string[]): void {
	const quoted = lines.map((line) => `'${line}'`).join(' ');
	writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' ${quoted}\n`);
	chmodSync(path, 0o755);
}

/** Puts the fake probes first on PATH, where the adapter's vm_stat and sysctl calls look. */
function installProbes(directory: string, counters: string[], pressureLevel: string): void {
	const bin = join(directory, 'bin');
	mkdirSync(bin, { recursive: true });
	writeProbe(join(bin, 'vm_stat'), counters);
	writeProbe(join(bin, 'sysctl'), [pressureLevel]);
	vi.stubEnv('PATH', bin);
}

/** The snapshot's fields as recorded; sampledAt is a clock reading and is left out. */
function summary(snapshot: ResourceSnapshot): Record<string, unknown> {
	return Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'sampledAt'));
}

function expectAvailable(snapshot: ResourceSnapshot, pressure: string): void {
	expect(snapshot.status).toBe('available');
	expect(snapshot.logicalCores).toBe(cpus().length);
	expect(snapshot.usableCores).toBe(Math.min(cpus().length, availableParallelism()));
	expect(snapshot.cpuUsedPercent).toBeGreaterThanOrEqual(0);
	expect(snapshot.cpuUsedPercent).toBeLessThanOrEqual(100);
	expect(snapshot.cpuAvailableCores).toBeLessThanOrEqual(snapshot.usableCores);
	expect(snapshot.memoryTotalBytes).toBe(totalmem());
	expect(snapshot.memoryAvailableBytes).toBe(availableBytes);
	expect(snapshot.memoryPressure).toBe(pressure);
}

test('Reports available CPU and memory from two counter reads', async () => {
	await withTempDir('host-resources-examples-', async (directory) => {
		const cases: Array<{ name: string; input: unknown; output: unknown }> = [];
		for (const [level, pressure] of [
			['1', 'normal'],
			['4', 'critical']
		]) {
			installProbes(directory, vmStat, level);
			const started = performance.now();
			const snapshot = await new HostResourcesAdapter().sample();
			// With no earlier read, the adapter waits 250 ms between its two counter reads.
			expect(performance.now() - started).toBeGreaterThanOrEqual(240);
			expectAvailable(snapshot, pressure);
			cases.push({
				name: `vm_stat counters with memory pressure level ${level}`,
				input: { platform: 'darwin', vm_stat: vmStat, sysctl_vm_pressure_level: level },
				output: summary(snapshot)
			});
		}
		recordExampleCases(
			{
				unitId,
				symbol,
				state: 'reports-available-cpu-and-memory-from-two-counter-reads',
				evidence,
				file: 'reports-available-cpu-and-memory-from-two-counter-reads.json'
			},
			cases
		);
	});
});

test('Reports unavailable with the error message when memory fails', async () => {
	await withTempDir('host-resources-examples-', async (directory) => {
		const counters = [
			'Mach Virtual Memory Statistics: (no page size reported)',
			'Pages free: 1000.'
		];
		installProbes(directory, counters, '1');
		const pending = new HostResourcesAdapter().sample();
		await expect(pending).resolves.toMatchObject({
			...unavailableFields,
			reason: 'Cannot read macOS memory counters'
		});
		const snapshot = await pending;
		recordExampleCases(
			{
				unitId,
				symbol,
				state: 'reports-unavailable-with-the-error-message-when-memory-fails',
				evidence,
				file: 'reports-unavailable-with-the-error-message-when-memory-fails.json'
			},
			[
				{
					name: 'vm_stat output without a page size',
					input: { platform: 'darwin', vm_stat: counters, sysctl_vm_pressure_level: '1' },
					output: summary(snapshot)
				}
			]
		);
	});
});

test('Reports the fixed probe reason when a non-Error is thrown', async () => {
	host.platform = () => {
		throw 'probe offline';
	};
	const snapshot = await new HostResourcesAdapter().sample();
	expect(snapshot).toMatchObject({ ...unavailableFields, reason: 'Resource probe failed' });
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'reports-the-fixed-probe-reason-when-a-non-error-is-thrown',
			evidence,
			file: 'reports-the-fixed-probe-reason-when-a-non-error-is-thrown.json'
		},
		[
			{
				name: 'platform probe throws the string probe offline',
				input: { platform_probe: 'throws the string "probe offline"' },
				output: summary(snapshot)
			}
		]
	);
});

test('Shares one in-flight measurement between concurrent calls', async () => {
	await withTempDir('host-resources-examples-', async (directory) => {
		installProbes(directory, vmStat, '1');
		const adapter = new HostResourcesAdapter();
		const first = adapter.sample();
		const second = adapter.sample();
		expect(second).toBe(first);
		const [snapshot, shared] = await Promise.all([first, second]);
		expect(shared).toBe(snapshot);
		expectAvailable(snapshot, 'normal');
		recordExampleCases(
			{
				unitId,
				symbol,
				state: 'shares-one-in-flight-measurement-between-concurrent-calls',
				evidence,
				file: 'shares-one-in-flight-measurement-between-concurrent-calls.json'
			},
			[
				{
					name: 'two calls made before the first one resolves',
					input: { calls: 2, platform: 'darwin', vm_stat: vmStat, sysctl_vm_pressure_level: '1' },
					output: { sharedMeasurement: true, ...summary(snapshot) }
				}
			]
		);
	});
});
