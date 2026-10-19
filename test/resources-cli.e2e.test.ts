import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { runHarness } from './support/cli';
const homes: string[] = [];
afterEach(async () => {
	await Promise.all(homes.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function environment() {
	const home = await mkdtemp(join(tmpdir(), 'harness-resource-cli-'));
	homes.push(home);
	return { HARNESS_RESOURCES_HOME: home, HARNESS_RESOURCE_LEASE: '' };
}
test('resources status reports overall CPU, available cores, memory and the shared queue', async () => {
	const result = await runHarness(
		['resources', 'status', '--json'],
		process.cwd(),
		false,
		await environment()
	);
	expect(result.exitCode, result.stderr).toBe(0);
	const guidance = await runHarness(['info', 'resources', '--json'], process.cwd());
	expect(JSON.parse(guidance.stdout).rules.join(' ')).toContain('running test finishes');
	const status = JSON.parse(result.stdout);
	expect(status.config.cpuReservePercent).toBe(10);
	expect(status.config.memoryReservePercent).toBe(10);
	expect(status.config.minMemoryReserveMiB).toBe(2048);
	expect(status.snapshot.logicalCores).toBeGreaterThan(0);
	expect(status.snapshot.cpuUsedPercent).toBeGreaterThanOrEqual(0);
	expect(status.snapshot.cpuUsedPercent).toBeLessThanOrEqual(100);
	expect(status.snapshot.memoryTotalBytes).toBeGreaterThan(0);
	expect(status.jobs).toEqual([]);
}, 15000);
test('an impossible resource request is rejected before a command starts', async () => {
	const result = await runHarness(
		['resources', 'run', '--cpus', '999999', '--', 'bun', '-e', 'console.log("STARTED")'],
		process.cwd(),
		false,
		await environment()
	);
	expect(result.exitCode).toBe(1);
	expect(result.stderr).toContain('exceeds usable capacity');
	expect(result.stdout).not.toContain('STARTED');
}, 15000);
