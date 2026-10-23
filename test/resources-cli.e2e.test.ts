import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
test.each(['.', 'packages/desktop'])(
	'managed %s scripts forward caller arguments within a bounded lease',
	async (workspace) => {
		const { version } = JSON.parse(
			await readFile(join(process.cwd(), 'node_modules/prettier/package.json'), 'utf8')
		) as { version: string };
		// Bound this fixture's parent lease so argument forwarding does not request whole-host capacity.
		const result = await runHarness(
			[
				'resources',
				'run',
				'--cpus',
				'1',
				'--memory-mib',
				'1024',
				'--wait-timeout',
				'5000',
				'--timeout',
				'5000',
				'--',
				'bun',
				'run',
				'format:check',
				'--version'
			],
			join(process.cwd(), workspace),
			false,
			await environment()
		);
		expect(result.stdout.trim(), result.stderr).toBe(version);
		expect(result.exitCode, result.stderr).toBe(0);
	},
	15000
);
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

test('an admitted command receives its bounded budget and releases its shared reservation', async () => {
	const env = await environment();
	const result = await runHarness(
		[
			'resources',
			'run',
			'--cpus',
			'1',
			'--memory-mib',
			'512',
			'--',
			'bun',
			'-e',
			'console.log(JSON.stringify({cpus:process.env.HARNESS_RESOURCE_CPUS,memory:process.env.HARNESS_RESOURCE_MEMORY_MIB,threads:process.env.CARGO_BUILD_JOBS,lease:process.env.HARNESS_RESOURCE_LEASE}))'
		],
		process.cwd(),
		true,
		env
	);
	expect(JSON.parse(result.stdout)).toEqual({
		cpus: '1',
		memory: '512',
		threads: '1',
		lease: expect.any(String)
	});
	const status = await runHarness(['resources', 'status', '--json'], process.cwd(), true, env);
	expect(JSON.parse(status.stdout).jobs).toEqual([]);
}, 15000);
